const mongoose = require('mongoose');

let cachedConnection = null;
let cachedPromise = null;

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.warn('MongoDB URI missing; continuing without database connection');
    return null;
  }

  if (mongoose.connection.readyState === 1) {
    return cachedConnection || mongoose.connection;
  }

  if (cachedPromise) {
    return cachedPromise;
  }

  try {
    cachedPromise = mongoose.connect(process.env.MONGO_URI, {
      bufferCommands: false,
    });

    const conn = await cachedPromise;
    cachedConnection = conn;
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    cachedPromise = null;
    console.error(`MongoDB connection error: ${error.message}`);
    console.warn('Server will continue without DB; chat will use reduced functionality');
    return null;
  }
};

module.exports = connectDB;
