const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const environment = require('./environment');
const User = require('../models/User');

const bootstrapAdmin = async () => {
  if (!environment.adminBootstrap.enabled) return;

  try {
    const adminEmail = environment.adminBootstrap.email.toLowerCase();
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      const passwordHash = await bcrypt.hash(environment.adminBootstrap.password, 10);
      await User.create({
        name: environment.adminBootstrap.name,
        email: adminEmail,
        phone: environment.adminBootstrap.phone,
        passwordHash,
        roles: ['USER', 'ADMIN'],
        accountStatus: 'ACTIVE',
        kycStatus: 'VERIFIED',
      });
      console.log(`[Identity Service] Initial administrator bootstrapped: ${adminEmail}`);
    }
  } catch (err) {
    console.error('[Identity Service] Admin bootstrap error:', err.message);
  }
};

const connectDatabase = async (uri) => {
  const mongoUri = uri || environment.mongodbUri;

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Identity Service] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    }

    // Bootstrap admin if needed
    await bootstrapAdmin();

    return conn;
  } catch (err) {
    console.error('[Identity Service] MongoDB connection error:', err.message);
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
  bootstrapAdmin,
};
