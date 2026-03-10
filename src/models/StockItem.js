const mongoose = require('mongoose');

const stockItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['VEGETABLES', 'GRAINS', 'DAIRY', 'SPICES', 'OILS', 'PROTEINS', 'BEVERAGES', 'OTHER'],
      required: [true, 'Category is required'],
    },
    unit: {
      type: String,
      enum: ['KG', 'LITERS', 'PIECES', 'PACKETS', 'BOXES'],
      required: [true, 'Unit is required'],
    },
    currentStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    minStockLevel: {
      type: Number,
      default: 10,
      min: 0,
    },
    maxStockLevel: {
      type: Number,
      default: 100,
    },
    unitPrice: {
      type: Number,
      default: 0,
    },
    supplier: {
      name: String,
      contact: String,
      email: String,
    },
    lastRestocked: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    canteen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Canteen',
      default: null,
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

// Virtual for stock level status
stockItemSchema.virtual('stockStatus').get(function () {
  if (this.currentStock <= 0) return 'OUT_OF_STOCK';
  if (this.currentStock <= this.minStockLevel) return 'LOW_STOCK';
  if (this.currentStock >= this.maxStockLevel) return 'OVERSTOCKED';
  return 'NORMAL';
});

// Index for efficient queries
stockItemSchema.index({ category: 1, isActive: 1 });
stockItemSchema.index({ currentStock: 1, minStockLevel: 1 });
stockItemSchema.index({ canteen: 1 });

module.exports = mongoose.model('StockItem', stockItemSchema);
