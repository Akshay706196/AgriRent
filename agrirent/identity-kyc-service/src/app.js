const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const kycRoutes = require('./routes/kyc.routes');
const adminRoutes = require('./routes/admin.routes');
const notFoundHandler = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
    service: 'agrirent-identity-kyc-service',
    timestamp: new Date().toISOString(),
  });
});

// Mount modular REST routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/kyc', kycRoutes);
app.use('/api/v1/admin', adminRoutes);

// Centralized 404 & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
