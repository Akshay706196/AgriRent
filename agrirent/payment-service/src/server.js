require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSqlDb, connectMongo, closeMongo } = require('./config/database');
const { attachSoapService } = require('./soap/paymentSoapService');
const outboxService = require('./services/outbox.service');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT, 10) || 4004;

async function bootstrap() {
  // 1. Initialize SQL Ledger Database (SQLite)
  initSqlDb();

  // 2. Connect to NoSQL Document Store (MongoDB)
  await connectMongo();

  // 3. Create HTTP Server
  const server = http.createServer(app);

  // 4. Attach SOAP Payment Service (/soap/payments)
  attachSoapService(server);

  // 5. Start Outbox Background Dispatcher Worker
  outboxService.startDispatcher(5000);

  // 6. Start Listening
  server.listen(PORT, () => {
    logger.info(`[PaymentService] Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    logger.info(`[PaymentService] REST endpoints available under http://localhost:${PORT}/v1`);
    logger.info(`[PaymentService] Swagger UI available at http://localhost:${PORT}/docs`);
    logger.info(`[PaymentService] SOAP endpoint available at http://localhost:${PORT}/soap/payments?wsdl`);
  });

  // 7. Graceful Shutdown on SIGTERM and SIGINT
  const shutdown = async (signal) => {
    logger.info(`[PaymentService] Received ${signal}. Initiating graceful shutdown...`);

    outboxService.stopDispatcher();

    server.close(async () => {
      logger.info('[PaymentService] HTTP server closed.');
      await closeMongo();
      logger.info('[PaymentService] Database connections closed. Process terminating.');
      process.exit(0);
    });

    // Force exit after 10s if dangling handles remain
    setTimeout(() => {
      logger.error('[PaymentService] Forced shutdown due to timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
  });
}

module.exports = {
  bootstrap,
};
