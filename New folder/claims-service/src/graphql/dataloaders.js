const DataLoader = require('dataloader');
const ClaimEvidence = require('../models/ClaimEvidence');
const ClaimEvent = require('../models/ClaimEvent');

let mongoQueryCount = 0;

function getMongoQueryCount() {
  return mongoQueryCount;
}

function resetMongoQueryCount() {
  mongoQueryCount = 0;
}

function createDataLoaders() {
  // Batch loader for ClaimEvidence
  const evidenceLoader = new DataLoader(async (claimIds) => {
    mongoQueryCount += 1;
    const docs = await ClaimEvidence.find({ claimId: { $in: claimIds } });

    const grouped = new Map();
    claimIds.forEach((id) => grouped.set(id, []));

    docs.forEach((doc) => {
      if (grouped.has(doc.claimId)) {
        grouped.get(doc.claimId).push(doc);
      }
    });

    return claimIds.map((id) => grouped.get(id) || []);
  });

  // Batch loader for ClaimEvents
  const eventsLoader = new DataLoader(async (claimIds) => {
    mongoQueryCount += 1;
    const docs = await ClaimEvent.find({ claimId: { $in: claimIds } }).sort({ timestamp: -1 });

    const grouped = new Map();
    claimIds.forEach((id) => grouped.set(id, []));

    docs.forEach((doc) => {
      if (grouped.has(doc.claimId)) {
        grouped.get(doc.claimId).push(doc);
      }
    });

    return claimIds.map((id) => grouped.get(id) || []);
  });

  return {
    evidenceLoader,
    eventsLoader,
  };
}

module.exports = {
  createDataLoaders,
  getMongoQueryCount,
  resetMongoQueryCount,
};
