const mongoose = require("mongoose");

const backupSnapshotSchema = new mongoose.Schema(
  {
    backupId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    storage: {
      type: String,
      default: "mongodb",
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    collections: [
      {
        name: {
          type: String,
          required: true,
        },
        documentCount: {
          type: Number,
          default: 0,
        },
        chunkCount: {
          type: Number,
          default: 0,
        },
      },
    ],
    totalDocuments: {
      type: Number,
      default: 0,
    },
    totalChunks: {
      type: Number,
      default: 0,
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

backupSnapshotSchema.index({ createdAt: -1 });

const BackupSnapshot = mongoose.model("BackupSnapshot", backupSnapshotSchema);

module.exports = BackupSnapshot;
