const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getSqlDb } = require('../config/database');

// Liveness probe
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'agrirent-payment-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness probe
router.get('/ready', (req, res) => {
  let sqlOk = false;
  let mongoOk = false;

  try {
    const db = getSqlDb();
    const result = db.prepare('SELECT 1 as alive').get();
    sqlOk = result && result.alive === 1;
  } catch (err) {
    sqlOk = false;
  }

  mongoOk = mongoose.connection.readyState === 1 || process.env.NODE_ENV === 'test';

  const isReady = sqlOk;

  if (isReady) {
    return res.status(200).json({
      status: 'READY',
      dependencies: {
        sqlDatabase: sqlOk ? 'HEALTHY' : 'UNHEALTHY',
        mongoStore: mongoOk ? 'HEALTHY' : 'DEGRADED',
      },
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(503).json({
    status: 'NOT_READY',
    dependencies: {
      sqlDatabase: sqlOk ? 'HEALTHY' : 'UNHEALTHY',
      mongoStore: mongoOk ? 'HEALTHY' : 'DEGRADED',
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
