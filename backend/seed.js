const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Product = require('./model/Product');
const beautyProducts = require('./data/beautyProducts');

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
            await Product.deleteMany({ name: { $in: legacyDemoProductNames } });
            for (const product of beautyProducts) {
                await Product.updateOne(
                    { name: product.name },
                    { $set: product },
                    { upsert: true, runValidators: true },
                );
            }
            console.log(`Beauty catalog ready with ${beautyProducts.length} products.`);
        }
    } catch (error) {
        console.error('Beauty catalog seed failed:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

seedBeautyCatalog();
