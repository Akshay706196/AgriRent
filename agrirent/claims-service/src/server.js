require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSqlDb, connectMongo, closeMongo } = require('./config/database');
const { attachSoapService } = require('./soap/claimsSoapService');
const outboxService = require('./services/outbox.service');
const settlementSagaService = require('./services/settlementSaga.service');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT, 10) || 4006;

async function bootstrap() {
  // Security Guard: Refuse to start if TIME_OVERRIDE_ISO is present and NODE_ENV=production
  if (process.env.NODE_ENV === 'production' && process.env.TIME_OVERRIDE_ISO) {
    throw new Error('FATAL SECURITY VIOLATION: TIME_OVERRIDE_ISO is strictly forbidden in production mode.');
  }

  // 1. Initialize SQL Ledger Database (SQLite)
  initSqlDb();

  // 2. Connect to NoSQL Document Store (MongoDB)
  await connectMongo();

  // 3. Create HTTP Server
  const server = http.createServer(app);

  // 4. Attach SOAP Claims Service (/soap/claims)
  attachSoapService(server);

  // 5. Start Outbox Background Dispatcher Worker
  outboxService.startDispatcher(5000);

  // 6. Start Settlement Saga Background Worker
  settlementSagaService.startWorker(4000);

  // 7. Start Listening
  server.listen(PORT, () => {
    logger.info(`[ClaimsService] Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    logger.info(`[ClaimsService] REST endpoints available under http://localhost:${PORT}/v1`);
    logger.info(`[ClaimsService] GraphQL endpoint available at http://localhost:${PORT}/graphql`);
    logger.info(`[ClaimsService] Swagger UI available at http://localhost:${PORT}/docs`);
    logger.info(`[ClaimsService] SOAP endpoint available at http://localhost:${PORT}/soap/claims?wsdl`);
  });

  // 8. Graceful Shutdown on SIGTERM and SIGINT
  const shutdown = async (signal) => {
    logger.info(`[ClaimsService] Received ${signal}. Initiating graceful shutdown...`);

    settlementSagaService.stopWorker();
    outboxService.stopDispatcher();

    server.close(async () => {
      logger.info('[ClaimsService] HTTP server closed.');
      await closeMongo();
      logger.info('[ClaimsService] Database connections closed. Process terminating.');
      process.exit(0);
    });

    // Force exit after 10s if dangling handles remain
    setTimeout(() => {
      logger.error('[ClaimsService] Forced shutdown due to timeout.');
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
