const mongoose = require('mongoose');
const { categoryNames } = require('../utils/categories');
const Coupon = require('../model/Coupon');
const CouponUsage = require('../model/CouponUsage');
const Product = require('../model/Product');
const User = require('../model/User');
const { couponStatus, describeCoupon } = require('../utils/pricing');

const { DISCOUNT_TYPES, PAYMENT_METHODS } = Coupon;
const MAX_MONEY = 10000000;

class CouponInputError extends Error {}

const optionalNumber = (value, name, { min, max, integer = false }) => {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
        throw new CouponInputError(`${name} must be ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}`);
    }
    return number;
};
const optionalDate = (value, name) => {
    if (value === '' || value === null || value === undefined) return null;
    // "2026-10-05T10:00" would be read in the server's time zone (UTC on Render), not the
    // admin's, moving the date by hours; only accept times that say which zone they are in.
    if (typeof value === 'string' && /T\d{2}:\d{2}/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
        throw new CouponInputError(`${name} must include a time zone`);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new CouponInputError(`${name} is not a valid date`);
    return date;
};
const list = (value, name, max = 500) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.length > max) throw new CouponInputError(`${name} must be a list of up to ${max} items`);
    return value;
};

// Validates the admin form and resolves product IDs and customer emails to documents.
const parseCoupon = async (body) => {
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new CouponInputError('The code must be 3 to 30 letters, numbers, dashes, or underscores');
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (description.length > 200) throw new CouponInputError('The description can be at most 200 characters');
    if (!DISCOUNT_TYPES.includes(body.discountType)) throw new CouponInputError('Choose a discount type');

    const data = {
        code,
        description,
        discountType: body.discountType,
        discountValue: 0,
        buyQuantity: undefined,
        getQuantity: undefined,
        minCartValue: optionalNumber(body.minCartValue, 'Minimum cart value', { min: 0, max: MAX_MONEY }) || 0,
        maxDiscount: optionalNumber(body.maxDiscount, 'Maximum discount', { min: 1, max: MAX_MONEY }),
        startsAt: optionalDate(body.startsAt, 'Start date') || new Date(),
        expiresAt: optionalDate(body.expiresAt, 'Expiry date'),
        usageLimit: optionalNumber(body.usageLimit, 'Usage limit', { min: 1, max: 1000000, integer: true }),
        perUserLimit: optionalNumber(body.perUserLimit, 'Per user limit', { min: 1, max: 1000, integer: true }),
        isActive: body.isActive !== false,
        showToCustomers: body.showToCustomers !== false,
    };

    if (data.discountType === 'percentage') {
        data.discountValue = optionalNumber(body.discountValue, 'Discount percentage', { min: 1, max: 100 });
        if (data.discountValue === null) throw new CouponInputError('Enter the discount percentage');
    } else if (data.discountType === 'fixed') {
        data.discountValue = optionalNumber(body.discountValue, 'Discount amount', { min: 1, max: MAX_MONEY });
        if (data.discountValue === null) throw new CouponInputError('Enter the discount amount');
        data.maxDiscount = null; // the amount itself is the cap
    } else if (data.discountType === 'buy_x_get_y') {
        data.buyQuantity = optionalNumber(body.buyQuantity, 'Buy quantity', { min: 1, max: 20, integer: true });
        data.getQuantity = optionalNumber(body.getQuantity, 'Free quantity', { min: 1, max: 20, integer: true });
        if (!data.buyQuantity || !data.getQuantity) throw new CouponInputError('Enter how many to buy and how many are free');
    } else {
        data.maxDiscount = null;
    }
    if (data.expiresAt && data.expiresAt <= data.startsAt) throw new CouponInputError('The expiry date must be after the start date');

    const productIds = [...new Set(list(body.applicableProducts, 'Products', 200).map(String))];
    if (productIds.some((id) => !mongoose.isValidObjectId(id))) throw new CouponInputError('One of the selected products is invalid');
    if (productIds.length && await Product.countDocuments({ _id: { $in: productIds } }) !== productIds.length) {
        throw new CouponInputError('One of the selected products no longer exists');
    }
    data.applicableProducts = productIds;

    const categories = [...new Set(list(body.applicableCategories, 'Categories', 20))];
    const shopCategories = await categoryNames();
    if (categories.some((category) => !shopCategories.includes(category))) throw new CouponInputError('Unknown category selected');
    data.applicableCategories = categories;

    const emails = [...new Set(list(body.applicableUserEmails, 'Customers')
        .map((email) => (typeof email === 'string' ? email.trim().toLowerCase() : ''))
        .filter(Boolean))];
    const users = emails.length ? await User.find({ email: { $in: emails } }).select('_id email').lean() : [];
    const missing = emails.filter((email) => !users.some((user) => user.email === email));
    if (missing.length) throw new CouponInputError(`No account found for: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
    data.applicableUsers = users.map((user) => user._id);

    const methods = [...new Set(list(body.paymentMethods, 'Payment methods', 4))];
    if (methods.some((method) => !PAYMENT_METHODS.includes(method))) throw new CouponInputError('Unknown payment method selected');
    data.paymentMethods = methods;
    return data;
};

const serializeForAdmin = (coupon) => ({
    ...coupon,
    status: couponStatus(coupon),
    summary: describeCoupon(coupon),
    applicableProducts: (coupon.applicableProducts || []).map((product) => ({ _id: product._id || product, name: product.name })),
    applicableUserEmails: (coupon.applicableUsers || []).map((user) => user.email).filter(Boolean),
    applicableUsers: undefined,
});

const loadForAdmin = (filter) => Coupon.find(filter)
    .populate('applicableProducts', 'name')
    .populate('applicableUsers', 'email')
    .sort({ createdAt: -1 })
    .lean();

const handle = (res, error, fallback) => {
    if (error instanceof CouponInputError) return res.status(400).json({ message: error.message });
    if (error.code === 11000) return res.status(409).json({ message: 'A coupon with this code already exists' });
    console.error(`${fallback}:`, error.message);
    return res.status(500).json({ message: fallback });
};

const listCoupons = async (req, res) => {
    try {
        return res.json((await loadForAdmin({})).map(serializeForAdmin));
    } catch (error) {
        return handle(res, error, 'Unable to load coupons');
    }
};

const createCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.create(await parseCoupon(req.body));
        const [saved] = await loadForAdmin({ _id: coupon._id });
        return res.status(201).json(serializeForAdmin(saved));
    } catch (error) {
        return handle(res, error, 'Unable to create the coupon');
    }
};

const updateCoupon = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid coupon ID' });
    try {
        const data = await parseCoupon(req.body);
        // usedCount is only ever changed by paid orders, never by the form.
        const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: data }, { returnDocument: 'after', runValidators: true });
        if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
        const [saved] = await loadForAdmin({ _id: coupon._id });
        return res.json(serializeForAdmin(saved));
    } catch (error) {
        return handle(res, error, 'Unable to update the coupon');
    }
};

// Pause / Resume. Only the switch changes, so the dates and rules are never re-sent and re-parsed.
const setCouponActive = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid coupon ID' });
    if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ message: 'isActive must be true or false' });
    try {
        const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: { isActive: req.body.isActive } });
        if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
        const [saved] = await loadForAdmin({ _id: coupon._id });
        return res.json(serializeForAdmin(saved));
    } catch (error) {
        return handle(res, error, 'Unable to update the coupon');
    }
};

// Orders keep the coupon code and discount they were placed with, so history is unaffected.
const deleteCoupon = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid coupon ID' });
    try {
        const coupon = await Coupon.findByIdAndDelete(req.params.id);
        if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
        await CouponUsage.deleteMany({ coupon: coupon._id });
        return res.json({ message: `Coupon ${coupon.code} deleted` });
    } catch (error) {
        return handle(res, error, 'Unable to delete the coupon');
    }
};

// "My coupons": active coupons the admin chose to show, limited to this customer when the
// coupon is for specific accounts, minus those the customer has used up.
const myCoupons = async (req, res) => {
    try {
        const now = new Date();
        const coupons = await Coupon.find({
            isActive: true,
            showToCustomers: true,
            startsAt: { $lte: now },
            $and: [
                { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
                { $or: [{ applicableUsers: { $size: 0 } }, { applicableUsers: req.user._id }] },
                { $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
            ],
        }).populate('applicableProducts', 'name').sort({ expiresAt: 1, createdAt: -1 }).lean();
        const usage = await CouponUsage.find({ user: req.user._id, coupon: { $in: coupons.map((coupon) => coupon._id) } }).lean();
        const usedByCoupon = new Map(usage.map((entry) => [String(entry.coupon), entry.count]));

        return res.json(coupons
            .map((coupon) => {
                const used = usedByCoupon.get(String(coupon._id)) || 0;
                return {
                    code: coupon.code,
                    description: coupon.description,
                    summary: describeCoupon(coupon),
                    minCartValue: coupon.minCartValue,
                    expiresAt: coupon.expiresAt,
                    products: (coupon.applicableProducts || []).map((product) => product.name),
                    categories: coupon.applicableCategories,
                    paymentMethods: coupon.paymentMethods,
                    personal: coupon.applicableUsers.length > 0,
                    usesLeft: coupon.perUserLimit ? coupon.perUserLimit - used : null,
                };
            })
            .filter((coupon) => coupon.usesLeft === null || coupon.usesLeft > 0));
    } catch (error) {
        return handle(res, error, 'Unable to load your coupons');
    }
};

module.exports = { listCoupons, createCoupon, updateCoupon, setCouponActive, deleteCoupon, myCoupons };
