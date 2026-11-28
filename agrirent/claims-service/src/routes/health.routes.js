const express = require('express');
const router = express.Router();
const { getSqlDb } = require('../config/database');
const mongoose = require('mongoose');

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'agrirent-claims-service',
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', (req, res) => {
  let sqlReady = false;
  try {
    const db = getSqlDb();
    db.prepare('SELECT 1').get();
    sqlReady = true;
  } catch {}

  const mongoReady = mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2;

  const isReady = sqlReady; // MongoDB fallback allows operation even if Mongo is degraded

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'READY' : 'NOT_READY',
    components: {
      sqlite: sqlReady ? 'UP' : 'DOWN',
      mongodb: mongoReady ? 'UP' : 'DEGRADED',
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
