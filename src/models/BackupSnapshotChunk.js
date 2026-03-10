const mongoose = require("mongoose");

const backupSnapshotChunkSchema = new mongoose.Schema(
  {
    backupId: {
      type: String,
      required: true,
      index: true,
    },
    collectionName: {
      type: String,
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    documentCount: {
      type: Number,
      default: 0,
    },
    documents: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

backupSnapshotChunkSchema.index(
  { backupId: 1, collectionName: 1, chunkIndex: 1 },
  { unique: true },
);
backupSnapshotChunkSchema.index({ createdAt: -1 });

const BackupSnapshotChunk = mongoose.model(
  "BackupSnapshotChunk",
  backupSnapshotChunkSchema,
);

module.exports = BackupSnapshotChunk;
