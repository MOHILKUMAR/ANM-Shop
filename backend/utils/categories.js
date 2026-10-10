const Category = require('../model/Category');

// The categories the shop launched with. They are added once, when the collection is empty;
// after that admins manage categories in the dashboard.
const DEFAULT_CATEGORIES = [
    { name: 'Skincare', description: 'Cleanse, hydrate, treat, and protect your skin.', icon: '✦' },
    { name: 'Face Makeup', description: 'Smooth base products, color, and a radiant finish.', icon: '◒' },
    { name: 'Eye Makeup', description: 'Palettes, liners, mascara, and brow essentials.', icon: '◉' },
    { name: 'Lip Makeup', description: 'Nourishing balm, precise liners, and vivid color.', icon: '◡' },
    { name: 'Haircare', description: 'Everyday cleansing, nourishment, and heat care.', icon: '〰' },
    { name: 'Body & Personal Care', description: 'Softening body care and signature fragrance.', icon: '❋' },
    { name: 'Tools & Accessories', description: 'Beauty tools and storage for your daily routine.', icon: '◇' },
];

// Categories are read on almost every catalogue request, so they are cached briefly. Admin
// changes clear the cache at once; the time limit covers other API instances.
const CACHE_MS = 60 * 1000;
let cache = null;

// All categories in display order.
const listCategories = async () => {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.list;
    const list = await Category.find().sort({ sortOrder: 1, name: 1 }).select('name description icon sortOrder').lean();
    cache = { at: Date.now(), list };
    return list;
};

// Names of the categories on sale. Products in any other category are not shown or sold.
const categoryNames = async () => (await listCategories()).map((category) => category.name);

const clearCategoryCache = () => {
    cache = null;
};

// Adds the launch categories to an empty collection; safe to run on every start.
const ensureDefaultCategories = async () => {
    if (await Category.estimatedDocumentCount()) return;
    try {
        await Category.insertMany(DEFAULT_CATEGORIES.map((category, index) => ({ ...category, sortOrder: index })), { ordered: false });
        console.log(`Added the ${DEFAULT_CATEGORIES.length} default categories`);
    } catch (error) {
        // Another instance added them at the same time.
        if (error.code !== 11000 && !error.writeErrors?.every((writeError) => writeError.code === 11000)) throw error;
    }
    clearCategoryCache();
};

module.exports = { DEFAULT_CATEGORIES, listCategories, categoryNames, clearCategoryCache, ensureDefaultCategories };
