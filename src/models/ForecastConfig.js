const mongoose = require('mongoose');

const forecastConfigSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: [true, 'Version is required'],
      unique: true,
      trim: true,
    },
    parameters: {
      weatherWeight: { type: Number, default: 0.15, min: 0, max: 1 },
      calendarWeight: { type: Number, default: 0.2, min: 0, max: 1 },
      historicalWeight: { type: Number, default: 0.65, min: 0, max: 1 },
      nEstimators: { type: Number, default: 300 },
      maxDepth: { type: Number, default: 5 },
      learningRate: { type: Number, default: 0.08 },
      minSamplesSplit: { type: Number, default: 10 },
      minSamplesLeaf: { type: Number, default: 5 },
      subsample: { type: Number, default: 0.85 },
    },
    accuracy: {
      mae: { type: Number, default: null },
      rmse: { type: Number, default: null },
      mape: { type: Number, default: null },
      r2: { type: Number, default: null },
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
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

forecastConfigSchema.index({ isActive: 1 });
forecastConfigSchema.index({ version: 1 });

/**
 * Get the currently active configuration
 */
forecastConfigSchema.statics.getActive = async function () {
  return this.findOne({ isActive: true }).sort({ createdAt: -1 });
};

/**
 * Activate a config version (deactivates all others)
 */
forecastConfigSchema.statics.activate = async function (id) {
  await this.updateMany({}, { isActive: false });
  return this.findByIdAndUpdate(id, { isActive: true }, { new: true });
};

const ForecastConfig = mongoose.model('ForecastConfig', forecastConfigSchema);

module.exports = ForecastConfig;
