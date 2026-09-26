const mongoose = require('mongoose');

const connectDB = async () => {
    if (!process.env.MONGO_URL) {
        console.error("DB Not connected: MONGO_URL is missing in backend/.env");
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 10000 });
        console.log("DB connected successfully");
    }
    catch (error) {
        console.error("DB Not connected:", error.message);
        if (error.name === 'MongooseServerSelectionError') {
            console.error("Fix: open MongoDB Atlas -> Network Access -> add your current IP address, then restart the backend.");
        }
        process.exit(1);
    }
}
module.exports = connectDB;
