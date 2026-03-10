const mongoose = require('mongoose');

const financialTransactionSchema = new mongoose.Schema(
  {
    transactionType: {
      type: String,
      enum: ['SALE', 'REFUND', 'EXPENSE', 'PURCHASE', 'SETTLEMENT', 'ADJUSTMENT'],
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    category: {
      type: String,
      enum: ['BOOKING', 'REFUND', 'STOCK_PURCHASE', 'UTILITY', 'SALARY', 'MAINTENANCE', 'OTHER'],
      default: 'OTHER',
    },
    referenceType: {
      type: String,
      enum: ['BOOKING', 'STOCK', 'EXPENSE', 'OTHER'],
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'CARD', 'UPI', 'WALLET', 'BANK_TRANSFER', 'OTHER'],
      default: 'OTHER',
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED'],
      default: 'COMPLETED',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    canteenId: {
      type: String,
      default: 'default',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
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

// Indexes for reporting
financialTransactionSchema.index({ transactionType: 1, date: -1 });
financialTransactionSchema.index({ category: 1, date: -1 });
financialTransactionSchema.index({ canteenId: 1, date: -1 });

module.exports = mongoose.model('FinancialTransaction', financialTransactionSchema);
