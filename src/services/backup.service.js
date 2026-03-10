const models = require("../models");
const CHUNK_SIZE = Math.max(
  50,
  parseInt(process.env.BACKUP_CHUNK_SIZE, 10) || 200,
);
const EXCLUDED_MODEL_NAMES = new Set(["BackupSnapshot", "BackupSnapshotChunk"]);

const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-");
};

const runBackup = async (meta = {}) => {
  const { BackupSnapshot, BackupSnapshotChunk } = models;

  const timestamp = getTimestamp();
  const backupId = `backup-${timestamp}`;
  const fileName = `${backupId}.mongodb`;

  const collectionStats = [];
  let totalDocuments = 0;
  let totalChunks = 0;

  for (const model of Object.values(models)) {
    if (!model || typeof model.find !== "function" || !model.modelName) {
      continue;
    }

    if (EXCLUDED_MODEL_NAMES.has(model.modelName)) {
      continue;
    }

    const docs = await model.find({}).lean();
    const documentCount = docs.length;
    let chunkCount = 0;

    if (documentCount > 0) {
      const chunkRecords = [];
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunkDocs = docs.slice(i, i + CHUNK_SIZE);
        chunkRecords.push({
          backupId,
          collectionName: model.modelName,
          chunkIndex: chunkCount,
          documentCount: chunkDocs.length,
          documents: chunkDocs,
        });
        chunkCount += 1;
      }

      await BackupSnapshotChunk.insertMany(chunkRecords, { ordered: true });
    }

    totalDocuments += documentCount;
    totalChunks += chunkCount;
    collectionStats.push({
      name: model.modelName,
      documentCount,
      chunkCount,
    });
  }

  await BackupSnapshot.create({
    backupId,
    fileName,
    storage: "mongodb",
    meta,
    collections: collectionStats,
    totalDocuments,
    totalChunks,
  });

  return {
    backupId,
    fileName,
    storage: "mongodb",
    collections: collectionStats.map((entry) => entry.name),
    totalDocuments,
    totalChunks,
  };
};

module.exports = {
  runBackup,
};
