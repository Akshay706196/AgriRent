const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

let sqlDb = null;

/**
 * Initializes and returns the SQLite database connection.
 * @param {string} customPath Optional custom database path (e.g. for testing)
 * @returns {DatabaseSync}
 */
function initSqlDb(customPath) {
  if (sqlDb && !customPath) {
    return sqlDb;
  }

  const dbPath = customPath || process.env.SQL_DB_PATH || path.join(__dirname, '../../data/agrirent_handovers.sqlite');

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);

  // Enable foreign keys and WAL mode for high concurrency
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  // Auto-run schema migrations
  const schemaPath = path.join(__dirname, '../database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }

  sqlDb = db;

  logger.info(`[Database] SQLite connected successfully at: ${dbPath}`);
  return db;
}

function getSqlDb() {
  if (!sqlDb) {
    return initSqlDb();
  }
  return sqlDb;
}

/**
 * Connects to MongoDB document store for handover_events and condition reports.
 */
async function connectMongo(customUri) {
  const uri = customUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agrirent_handovers';

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`[Database] MongoDB connected successfully to: ${uri}`);
    return mongoose.connection;
  } catch (err) {
    logger.warn(`[Database] MongoDB connection warning: ${err.message}. Event persistence fallback enabled.`);
    return null;
  }
}

async function closeMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = {
  initSqlDb,
  getSqlDb,
  connectMongo,
  closeMongo,
};
