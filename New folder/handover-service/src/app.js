const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const yaml = require('yamljs');
const swaggerUi = require('swagger-ui-express');

const correlationMiddleware = require('./middleware/correlation.middleware');
const corsMiddleware = require('./middleware/cors.middleware');
const notFoundHandler = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/error.middleware');
const logger = require('./utils/logger');

const v1Routes = require('./routes/v1.routes');
const healthRoutes = require('./routes/health.routes');

const app = express();

// Security Guard: Refuse to initialize in production if debug bypasses are enabled
if (process.env.NODE_ENV === 'production') {
  if (process.env.DEV_EXPOSE_PIN === 'true') {
    throw new Error('FATAL SECURITY VIOLATION: DEV_EXPOSE_PIN=true is strictly forbidden in production mode.');
  }
  if (process.env.TIME_OVERRIDE_ISO) {
    throw new Error('FATAL SECURITY VIOLATION: TIME_OVERRIDE_ISO is strictly forbidden in production mode.');
  }
}

// 1. Correlation ID tracing (echoed on all responses)
app.use(correlationMiddleware);

// 2. Structured JSON Request Logging (stdout)
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, {
      correlationId: req.correlationId,
      statusCode: res.statusCode,
      method: req.method,
      url: req.originalUrl,
      durationMs: duration,
    });
  });
  next();
});

// 3. Deliberate CORS configuration
app.use(corsMiddleware);

// 4. Helmet security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI assets
  })
);

// 5. Body Parsing
app.use(express.json({ limit: '2mb' }));

// 6. OpenAPI 3.0 Documentation & Swagger UI
const openapiPath = path.join(__dirname, '../contracts/openapi.yaml');
let openapiDoc = null;
if (fs.existsSync(openapiPath)) {
  openapiDoc = yaml.load(openapiPath);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc));
  app.get('/openapi.yaml', (req, res) => {
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    res.sendFile(openapiPath);
  });
}

// 7. Health & Readiness Probes
app.use(healthRoutes);

// 8. SOAP WSDL direct endpoint
const { wsdlXml } = require('./soap/handoverSoapService');
app.get('/soap/handover', (req, res, next) => {
  if (req.query.wsdl !== undefined || req.url.includes('wsdl')) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(wsdlXml);
  }
  next();
});

// 8. Core API routes under /v1
app.use('/v1', v1Routes);

// 9. 404 Handler for unknown routes
app.use(notFoundHandler);

// 10. Central Error Handler (supports JSON and XML)
app.use(errorHandler);

module.exports = app;
