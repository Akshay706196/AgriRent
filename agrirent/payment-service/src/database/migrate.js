const fs = require('fs');
const path = require('path');
const { initSqlDb } = require('../config/database');
const logger = require('../utils/logger');

function runMigrations() {
  const db = initSqlDb();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  logger.info('[Migration] Applying SQL schema...');
  db.exec(schemaSql);
  logger.info('[Migration] SQL migrations completed successfully.');
}

if (require.main === module) {
  try {
    runMigrations();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

module.exports = runMigrations;
