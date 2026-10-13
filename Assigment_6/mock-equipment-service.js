'use strict';
const express = require('express');
const app = express();
app.get('/api/equipment/:id', (req, res) => {
  if (req.params.id === 'missing-equipment') return res.status(404).json({ detail: 'not found' });
  return res.status(200).json({ id: req.params.id, name: 'Sample Tractor', available: true });
});
const server = app.listen(Number(process.env.MOCK_EQUIPMENT_PORT || 5002), () => console.log('Local equipment-service test double on port 5002'));
process.on('SIGINT', () => server.close(() => process.exit(0)));
