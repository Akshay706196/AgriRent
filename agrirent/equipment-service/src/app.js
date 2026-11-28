const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const equipmentRoutes = require('./routes/equipment.routes');
const notFoundHandler = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Correlation ID tracing middleware
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || `req-${crypto.randomUUID()}`;
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'agrirent-equipment-service',
    timestamp: new Date().toISOString(),
  });
});

// Mount Equipment API routes
app.use('/api/v1/equipment', equipmentRoutes);

// 404 & Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
