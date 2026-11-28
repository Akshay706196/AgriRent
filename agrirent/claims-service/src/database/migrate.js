const path = require('path');
const fs = require('fs');
const { initSqlDb } = require('../config/database');
const logger = require('../utils/logger');

function migrate() {
  const db = initSqlDb();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  logger.info('[Migration] Database tables and indexes applied successfully.');
}

if (require.main === module) {
  migrate();
}

module.exports = { migrate };
