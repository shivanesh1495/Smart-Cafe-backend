const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Holiday name is required'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Holiday date is required'],
    },
    description: {
      type: String,
      trim: true,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    affectedMeals: {
      type: [String],
      enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'],
      default: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'],
    },
    canteenId: {
      type: String,
      default: 'default',
    },
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

// Index for efficient date queries
holidaySchema.index({ date: 1, canteenId: 1 });

/**
 * Check if a date is a holiday
 */
holidaySchema.statics.isHoliday = async function (date, canteenId = 'default') {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  
  const holiday = await this.findOne({
    date: { $gte: targetDate, $lt: nextDay },
    canteenId,
  });
  
  return holiday;
};

module.exports = mongoose.model('Holiday', holidaySchema);
