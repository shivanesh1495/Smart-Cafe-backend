const mongoose = require("mongoose");

const CATEGORIES = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS", "BEVERAGES"];
const DIETARY_TYPES = ["Veg", "Non-Veg", "Vegan", "Jain", "Egg"];
const ECO_SCORES = ["A", "B", "C", "D", "E"];
const PORTION_SIZES = ["Small", "Regular", "Large"];

const nutritionalInfoSchema = new mongoose.Schema(
  {
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
  },
  { _id: false },
);

const menuItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
      maxlength: [100, "Item name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    availableQuantity: {
      type: Number,
      default: 100,
      min: [0, "Available quantity cannot be negative"],
    },
    isVeg: {
      type: Boolean,
      default: true,
    },
    category: {
      type: String,
      enum: {
        values: CATEGORIES,
        message: "Invalid category",
      },
      default: "LUNCH",
    },
    dietaryType: {
      type: String,
      enum: {
        values: DIETARY_TYPES,
        message: "Invalid dietary type",
      },
      default: "Veg",
    },
    allergens: [
      {
        type: String,
        trim: true,
      },
    ],
    ecoScore: {
      type: String,
      enum: {
        values: ECO_SCORES,
        message: "Invalid eco score",
      },
      default: "C",
    },
    portionSize: {
      type: String,
      enum: {
        values: PORTION_SIZES,
        message: "Invalid portion size",
      },
      default: "Regular",
    },
    nutritionalInfo: {
      type: nutritionalInfoSchema,
      default: () => ({}),
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    menu: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Menu",
    },
    canteens: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Canteen",
      },
    ],
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

// Indexes
menuItemSchema.index({ itemName: "text", description: "text" });
menuItemSchema.index({ category: 1 });
menuItemSchema.index({ isAvailable: 1 });
menuItemSchema.index({ availableQuantity: 1 });
menuItemSchema.index({ menu: 1 });
menuItemSchema.index({ canteens: 1 });

const MenuItem = mongoose.model("MenuItem", menuItemSchema);

module.exports = MenuItem;
module.exports.CATEGORIES = CATEGORIES;
module.exports.DIETARY_TYPES = DIETARY_TYPES;
module.exports.ECO_SCORES = ECO_SCORES;
module.exports.PORTION_SIZES = PORTION_SIZES;
