const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema(
  {
    stockItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockItem',
      required: [true, 'Stock item is required'],
    },
    transactionType: {
      type: String,
      enum: ['RESTOCK', 'CONSUME', 'ADJUST', 'WASTE', 'RETURN'],
      required: [true, 'Transaction type is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    unitPrice: {
      type: Number,
    },
    totalAmount: {
      type: Number,
    },
    reason: {
      type: String,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referenceNumber: {
      type: String,
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
  }
);

// Index for reporting
stockTransactionSchema.index({ stockItem: 1, createdAt: -1 });
stockTransactionSchema.index({ transactionType: 1, createdAt: -1 });

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
