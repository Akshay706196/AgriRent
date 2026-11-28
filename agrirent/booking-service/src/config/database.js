const mongoose = require('mongoose');

const connectDatabase = async (uri) => {
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agrirent_bookings';

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Booking Service] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    }
    return conn;
  } catch (err) {
    console.error('[Booking Service] MongoDB connection error:', err.message);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw err;
  }
};

const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
};
