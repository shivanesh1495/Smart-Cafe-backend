const mongoose = require('mongoose');

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'];

const menuSchema = new mongoose.Schema(
  {
    menuDate: {
      type: Date,
      required: [true, 'Menu date is required'],
    },
    mealType: {
      type: String,
      enum: {
        values: MEAL_TYPES,
        message: 'Invalid meal type',
      },
      required: [true, 'Meal type is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

// Compound index for unique menu per date and meal type
menuSchema.index({ menuDate: 1, mealType: 1 }, { unique: true });
menuSchema.index({ isActive: 1 });

const Menu = mongoose.model('Menu', menuSchema);

module.exports = Menu;
module.exports.MEAL_TYPES = MEAL_TYPES;
