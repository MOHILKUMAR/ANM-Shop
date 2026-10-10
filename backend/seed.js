const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Product = require('./model/Product');
const beautyProducts = require('./data/beautyProducts');
const { ensureDefaultCategories, categoryNames } = require('./utils/categories');

dotenv.config();

const legacyDemoProductNames = [
    'Wireless Headphones',
    'Smartwatch',
    'Gaming Keyboard',
    'Running Shoes',
    'Coffee Maker',
];

const seedBeautyCatalog = async () => {
    try {
        await connectDB();
        if (process.argv[2] === '-d') {
            await Product.deleteMany({
                name: { $in: [...legacyDemoProductNames, ...beautyProducts.map((product) => product.name)] },
            });
            console.log('Beauty demo catalog removed.');
        } else {
            // The demo products use the default categories.
            await ensureDefaultCategories();
            await Product.deleteMany({ name: { $in: legacyDemoProductNames } });
            // Only missing demo products are added; ones already there keep any changes admins
            // made (price, stock, photos, category).
            let added = 0;
            for (const product of beautyProducts) {
                const result = await Product.updateOne(
                    { name: product.name },
                    { $setOnInsert: product },
                    { upsert: true, runValidators: true },
                );
                added += result.upsertedCount;
            }
            console.log(`Beauty catalog ready: ${added} demo products added, ${beautyProducts.length - added} already there.`);
            const shopCategories = await categoryNames();
            const missing = [...new Set(beautyProducts.map((product) => product.category))].filter((name) => !shopCategories.includes(name));
            if (missing.length) {
                console.warn(`These demo categories were renamed or removed, so new demo products in them stay hidden until you move them: ${missing.join(', ')}`);
            }
        }
    } catch (error) {
        console.error('Beauty catalog seed failed:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

seedBeautyCatalog();
