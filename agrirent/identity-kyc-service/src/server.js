const app = require('./app');
const environment = require('./config/environment');
const { connectDatabase, disconnectDatabase } = require('./config/database');

const PORT = environment.port;

const startServer = async () => {
  try {
    await connectDatabase();

    const server = app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(` AgriRent Identity & KYC Service running on port ${PORT}`);
      console.log(` Environment: ${environment.nodeEnv}`);
      console.log(` Health: http://localhost:${PORT}/health`);
      console.log(`=======================================================`);
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
    console.error('Failed to start Identity & KYC Service:', err);
    process.exit(1);
  }
};

startServer();
