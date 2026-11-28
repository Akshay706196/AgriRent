require('dotenv').config();
const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/database');

const PORT = process.env.PORT || 4001;

const startServer = async () => {
  try {
    await connectDatabase();

    const server = app.listen(PORT, () => {
      console.log(`================================================`);
      console.log(` AgriRent Equipment Service running on port ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(` Health: http://localhost:${PORT}/health`);
      console.log(`================================================`);
    });

    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await disconnectDatabase();
        console.log('MongoDB connection closed. Server terminated.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to start Equipment Service:', err);
    process.exit(1);
  }
};

startServer();
