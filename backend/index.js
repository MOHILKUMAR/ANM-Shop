const connectDB = require('./config/db');
const app = require('./app');
const { migrateEmbeddedReviews } = require('./utils/reviews');
const { fixOrderBreakdowns } = require('./utils/orderMigrations');
const { ensureDefaultCategories } = require('./utils/categories');

const PORT = process.env.PORT || 5000;
const startServer = async () => {
    await connectDB();
    // A failed fix-up is retried on the next start; it must not keep the shop offline.
    await ensureDefaultCategories().catch((error) => console.error('Default categories failed:', error.message));
    await migrateEmbeddedReviews().catch((error) => console.error('Review migration failed:', error.message));
    // Corrects old orders once; after the first run it is a single lookup.
    await fixOrderBreakdowns().catch((error) => console.error('Order breakdown fix failed:', error.message));
    app.listen(PORT, () => {
        console.log(`Server running ${PORT}`);
    });
};

startServer().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exit(1);
});
