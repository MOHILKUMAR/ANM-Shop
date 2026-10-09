const mongoose = require('mongoose');
const Product = require('../model/Product');
const Coupon = require('../model/Coupon');
const CouponUsage = require('../model/CouponUsage');
const beautyCategories = require('../constants/beautyCategories');

// All money here is in paise (integers) so totals never pick up floating-point errors.
const rupeesToPaise = (value) => Math.round(Number(value) * 100);
// An unset or empty variable (as in .env.example) uses the default; Number('') would be 0.
const envRupees = (name, fallback) => {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
};
// ₹49 shipping below ₹499 of items (before any discount); change with SHIPPING_FEE / FREE_SHIPPING_ABOVE.
const shippingFeePaise = () => rupeesToPaise(envRupees('SHIPPING_FEE', 49));
const freeShippingAbovePaise = () => rupeesToPaise(envRupees('FREE_SHIPPING_ABOVE', 499));
const MIN_CHARGE_PAISE = 100; // Razorpay's minimum payment is ₹1

const PAYMENT_METHOD_LABELS = { upi: 'UPI', card: 'card', netbanking: 'net banking', wallet: 'wallet' };

class PricingError extends Error {
    // `details` is sent to the browser with the message, e.g. which products are gone.
    constructor(message, statusCode = 400, details = {}) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
    }
}

// Validates the cart sent by the browser and prices it from the database, never from the client.
const loadCartLines = async (items) => {
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
        throw new PricingError('Your cart is empty or too large');
    }
    const quantities = new Map();
    for (const item of items) {
        if (typeof item?.productId !== 'string' || !mongoose.isValidObjectId(item.productId)) {
            throw new PricingError('Invalid product in cart');
        }
        const productId = item.productId.toLowerCase();
        const qty = Number(item.qty);
        if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new PricingError('Item quantities must be between 1 and 99');
        const combinedQty = (quantities.get(productId) || 0) + qty;
        if (combinedQty > 99) throw new PricingError('A product quantity cannot exceed 99');
        quantities.set(productId, combinedQty);
    }

    const products = await Product.find({ _id: { $in: [...quantities.keys()] }, category: { $in: beautyCategories } });
    if (products.length !== quantities.size) {
        const found = new Set(products.map((product) => product._id.toString()));
        const unavailableProductIds = [...quantities.keys()].filter((id) => !found.has(id));
        throw new PricingError(
            `${unavailableProductIds.length === 1 ? 'An item' : 'Some items'} in your cart ${unavailableProductIds.length === 1 ? 'is' : 'are'} no longer sold. Open your cart to remove ${unavailableProductIds.length === 1 ? 'it' : 'them'}.`,
            409,
            { unavailableProductIds },
        );
    }

    return products.map((product) => {
        const qty = quantities.get(product._id.toString());
        if (qty > product.stock) throw new PricingError(`${product.name} does not have enough stock`, 409);
        return { productId: product._id, name: product.name, category: product.category, qty, unitPaise: rupeesToPaise(product.price) };
    });
};

const couponStatus = (coupon, now = new Date()) => {
    if (!coupon.isActive) return 'disabled';
    if (coupon.startsAt && coupon.startsAt > now) return 'scheduled';
    if (coupon.expiresAt && coupon.expiresAt <= now) return 'expired';
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return 'used_up';
    return 'active';
};

const isEligibleLine = (coupon, line) => {
    const products = (coupon.applicableProducts || []).map(String);
    const categories = coupon.applicableCategories || [];
    if (!products.length && !categories.length) return true;
    return products.includes(String(line.productId)) || categories.includes(line.category);
};

const formatRupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// A one-line summary for customers, e.g. "10% off, up to ₹200".
const describeCoupon = (coupon) => {
    const cap = coupon.maxDiscount ? `, up to ${formatRupees(rupeesToPaise(coupon.maxDiscount))}` : '';
    if (coupon.discountType === 'percentage') return `${coupon.discountValue}% off${cap}`;
    if (coupon.discountType === 'fixed') return `${formatRupees(rupeesToPaise(coupon.discountValue))} off`;
    if (coupon.discountType === 'free_shipping') return 'Free shipping';
    return `Buy ${coupon.buyQuantity} get ${coupon.getQuantity} free${cap}`;
};

// Checks every rule and returns the discount in paise, or the reason the coupon can't be used.
const evaluateCoupon = async (coupon, { user, lines, subtotalPaise, shippingPaise }) => {
    const fail = (reason) => ({ ok: false, reason });
    const status = couponStatus(coupon);
    if (status === 'scheduled') return fail(`Coupon ${coupon.code} starts on ${coupon.startsAt.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })}.`);
    if (status === 'expired') return fail(`Coupon ${coupon.code} has expired.`);
    if (status === 'used_up') return fail(`Coupon ${coupon.code} has reached its usage limit.`);
    if (status !== 'active') return fail(`Coupon ${coupon.code} is not available.`);

    if (coupon.applicableUsers?.length && !coupon.applicableUsers.some((id) => String(id) === String(user._id))) {
        return fail(`Coupon ${coupon.code} is not available on your account.`);
    }
    if (coupon.perUserLimit) {
        const usage = await CouponUsage.findOne({ coupon: coupon._id, user: user._id }).select('count').lean();
        if ((usage?.count || 0) >= coupon.perUserLimit) {
            return fail(`You have already used coupon ${coupon.code} the maximum number of times.`);
        }
    }
    const minPaise = rupeesToPaise(coupon.minCartValue || 0);
    if (subtotalPaise < minPaise) {
        return fail(`Add ${formatRupees(minPaise - subtotalPaise)} more to use ${coupon.code} (minimum order ${formatRupees(minPaise)}).`);
    }

    const eligible = lines.filter((line) => isEligibleLine(coupon, line));
    if (!eligible.length) return fail(`Coupon ${coupon.code} doesn't apply to the items in your cart.`);
    const eligibleSubtotal = eligible.reduce((sum, line) => sum + line.unitPaise * line.qty, 0);

    let discount = 0;
    if (coupon.discountType === 'percentage') {
        discount = Math.floor((eligibleSubtotal * coupon.discountValue) / 100);
    } else if (coupon.discountType === 'fixed') {
        discount = Math.min(rupeesToPaise(coupon.discountValue), eligibleSubtotal);
    } else if (coupon.discountType === 'free_shipping') {
        if (!shippingPaise) return fail('This order already ships free.');
        return { ok: true, discountPaise: 0, shippingDiscountPaise: shippingPaise };
    } else {
        // Buy X Get Y: sort qualifying units by price, highest first; in every complete group of
        // X+Y units the last Y (the cheapest in that group) are free.
        const units = eligible.flatMap((line) => Array(line.qty).fill(line.unitPaise)).sort((a, b) => b - a);
        const groupSize = coupon.buyQuantity + coupon.getQuantity;
        const groups = Math.floor(units.length / groupSize);
        if (!groups) {
            return fail(`Add ${groupSize - units.length} more qualifying item${groupSize - units.length === 1 ? '' : 's'} to use ${coupon.code} (buy ${coupon.buyQuantity}, get ${coupon.getQuantity} free).`);
        }
        for (let group = 0; group < groups; group += 1) {
            for (let free = 0; free < coupon.getQuantity; free += 1) {
                discount += units[group * groupSize + coupon.buyQuantity + free];
            }
        }
    }
    if (coupon.maxDiscount) discount = Math.min(discount, rupeesToPaise(coupon.maxDiscount));
    return { ok: true, discountPaise: discount, shippingDiscountPaise: 0 };
};

const findCouponByCode = (code) => {
    const clean = typeof code === 'string' ? code.trim().toUpperCase() : '';
    return /^[A-Z0-9_-]{3,30}$/.test(clean) ? Coupon.findOne({ code: clean }) : null;
};

// The full price of a cart for this customer, optionally with a coupon. A coupon that can't be
// used is reported in `couponError` and the price is given without it.
const priceCart = async ({ user, items, couponCode }) => {
    const lines = await loadCartLines(items);
    const subtotalPaise = lines.reduce((sum, line) => sum + line.unitPaise * line.qty, 0);
    const shippingBase = subtotalPaise >= freeShippingAbovePaise() ? 0 : shippingFeePaise();

    let discountPaise = 0;
    let shippingPaise = shippingBase;
    let coupon = null;
    let couponError = null;
    if (typeof couponCode === 'string' && couponCode.trim()) {
        const found = await findCouponByCode(couponCode);
        if (!found) {
            couponError = `Coupon ${couponCode.trim().toUpperCase().slice(0, 30)} was not found.`;
        } else {
            const result = await evaluateCoupon(found, { user, lines, subtotalPaise, shippingPaise: shippingBase });
            if (!result.ok) {
                couponError = result.reason;
            } else {
                coupon = found;
                discountPaise = result.discountPaise;
                shippingPaise = shippingBase - result.shippingDiscountPaise;
            }
        }
    }

    // Never charge less than Razorpay's minimum.
    discountPaise = Math.max(0, Math.min(discountPaise, subtotalPaise + shippingPaise - MIN_CHARGE_PAISE));
    const totalPaise = subtotalPaise + shippingPaise - discountPaise;
    if (!Number.isSafeInteger(totalPaise) || totalPaise < MIN_CHARGE_PAISE) throw new PricingError('The order total is invalid');

    return {
        lines,
        subtotalPaise,
        shippingPaise,
        // The shipping fee before any coupon, for the order's price breakdown.
        shippingBasePaise: shippingBase,
        // What the coupon saved in total, shipping included, for display.
        savingsPaise: discountPaise + (shippingBase - shippingPaise),
        discountPaise,
        totalPaise,
        freeShippingAbovePaise: freeShippingAbovePaise(),
        coupon,
        couponError,
    };
};

// What the browser sees of a priced cart.
const quoteForClient = (priced) => ({
    subtotal: priced.subtotalPaise / 100,
    shipping: priced.shippingPaise / 100,
    discount: priced.discountPaise / 100,
    savings: priced.savingsPaise / 100,
    total: priced.totalPaise / 100,
    freeShippingAbove: priced.freeShippingAbovePaise / 100,
    coupon: priced.coupon ? {
        code: priced.coupon.code,
        summary: describeCoupon(priced.coupon),
        description: priced.coupon.description,
        paymentMethods: priced.coupon.paymentMethods || [],
    } : null,
    couponError: priced.couponError,
});

const describePaymentMethods = (methods) => methods.map((method) => PAYMENT_METHOD_LABELS[method] || method).join(' or ');

module.exports = {
    PricingError, priceCart, quoteForClient, couponStatus, describeCoupon, describePaymentMethods, rupeesToPaise,
};
