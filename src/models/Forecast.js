const mongoose = require('mongoose');

const forecastSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Forecast date is required'],
    },
    mealType: {
      type: String,
      enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'],
      required: [true, 'Meal type is required'],
    },
    predictedCount: {
      type: Number,
      required: [true, 'Predicted count is required'],
    },
    actualCount: {
      type: Number,
    },
    accuracy: {
      type: Number,
      min: 0,
      max: 100,
    },
    weatherCondition: {
      type: String,
      enum: ['Sunny', 'Cloudy', 'Rainy', 'Stormy', 'Unknown'],
      default: 'Unknown',
    },
    temperature: {
      type: Number,
      default: null,
    },
    humidity: {
      type: Number,
      default: null,
    },
    rainfall: {
      type: Number,
      default: null,
    },
    isSpecialPeriod: {
      type: Boolean,
      default: false,
    },
    specialPeriodType: {
      type: String,
      enum: ['Exam', 'Holiday', 'Festival', 'Graduation', 'Orientation', 'Vacation', 'Event', 'Weekend', 'Normal'],
      default: 'Normal',
    },
    modelVersion: {
      type: String,
      default: 'v1.0',
    },
    configVersion: {
      type: String,
      default: null,
    },
    itemForecasts: [
      {
        menuItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
        },
        predicted: Number,
        actual: Number,
      },
    ],
    canteenId: {
      type: String,
      default: 'default',
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

// Compound index for unique daily forecasts
forecastSchema.index({ date: 1, mealType: 1, canteenId: 1 }, { unique: true });

/**
 * Calculate accuracy after actual data is recorded
 */
forecastSchema.methods.calculateAccuracy = function () {
  if (this.actualCount && this.predictedCount) {
    const error = Math.abs(this.predictedCount - this.actualCount);
    const maxVal = Math.max(this.predictedCount, this.actualCount);
    this.accuracy = Math.round((1 - error / maxVal) * 100);
  }
  return this.accuracy;
};

module.exports = mongoose.model('Forecast', forecastSchema);
