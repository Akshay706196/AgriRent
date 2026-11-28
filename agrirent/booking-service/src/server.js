require('dotenv').config();
const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { startExpiryCron, stopExpiryCron } = require('./jobs/expireBookings.job');

const PORT = process.env.PORT || 4002;

const startServer = async () => {
  try {
    await connectDatabase();

    // Start background 24-hour booking expiry engine
    const cronJob = startExpiryCron();

    const server = app.listen(PORT, () => {
      console.log(`================================================`);
      console.log(` AgriRent Booking Service running on port ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(` Health: http://localhost:${PORT}/health`);
      console.log(`================================================`);
    });

    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      stopExpiryCron();
      server.close(async () => {
        await disconnectDatabase();
        console.log('MongoDB connection closed. Server terminated.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to start Booking Service:', err);
    process.exit(1);
  }
};

startServer();
