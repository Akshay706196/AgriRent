const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');

let dbInstance = null;

async function getDatabase() {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: path.join(__dirname, 'agrirent.db'),
    driver: sqlite3.Database
  });

  // Agar table exist nahi karta toh schema.sql run karke seed karein
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await dbInstance.exec(schemaSql);

  console.log("Database initialized with seed equipment records.");
  return dbInstance;
}

module.exports = { getDatabase };