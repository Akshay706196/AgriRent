const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

console.log('--- Checking SQLite databases ---');
const dbs = [
  { name: 'claims-service', path: './claims-service/data/agrirent_claims.sqlite', schema: './claims-service/src/database/schema.sql' },
  { name: 'payment-service', path: './payment-service/data/agrirent_payments.sqlite', schema: './payment-service/src/database/schema.sql' },
  { name: 'handover-service', path: './handover-service/data/agrirent_handovers.sqlite', schema: './handover-service/src/database/schema.sql' }
];

for (const d of dbs) {
  console.log(`\nService: ${d.name}`);
  const resolved = path.resolve(d.path);
  if (fs.existsSync(resolved)) {
    const db = new DatabaseSync(resolved);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    console.log(`  Tables (${tables.length}): ${tables.map(t => t.name).join(', ')}`);
    const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
    console.log(`  Indices (${indices.length}): ${indices.map(i => i.name).join(', ')}`);
  } else {
    console.log(`  File does not exist yet at: ${resolved}`);
  }
}
