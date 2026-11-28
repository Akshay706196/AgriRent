const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getSqlDb } = require('../config/database');

// Health Liveness Probe
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'agrirent-handover-service',
    timestamp: new Date().toISOString(),
  });
});

// Readiness Probe checking SQLite and MongoDB connectivity
router.get('/ready', (req, res) => {
  let sqlReady = false;
  let mongoReady = false;

  try {
    const db = getSqlDb();
    const row = db.prepare('SELECT 1 as alive').get();
    sqlReady = row && row.alive === 1;
  } catch {
    sqlReady = false;
  }

  mongoReady = mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2;

  const isReady = sqlReady; // SQLite is primary ledger; Mongo operates with graceful fallback

  const statusCode = isReady ? 200 : 503;
  res.status(statusCode).json({
    status: isReady ? 'READY' : 'NOT_READY',
    service: 'agrirent-handover-service',
    dependencies: {
      sqlite: sqlReady ? 'CONNECTED' : 'DISCONNECTED',
      mongodb: mongoReady ? 'CONNECTED' : 'DISCONNECTED_OR_DEGRADED',
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
