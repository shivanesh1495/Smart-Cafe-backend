const mongoose = require('mongoose');

const wasteReportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    wasteAmount: {
      type: String,
      enum: ['None', 'Little', 'Some', 'Most', 'All'],
      required: [true, 'Waste amount is required'],
    },
    reason: {
      type: String,
      enum: [
        'Too much food',
        'Did not like the taste',
        'Food was cold',
        'Not hungry',
        'Poor quality',
        'Other',
      ],
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    mealType: {
      type: String,
      enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'],
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

// Index for analytics
wasteReportSchema.index({ date: 1, mealType: 1 });
wasteReportSchema.index({ user: 1, date: 1 });

module.exports = mongoose.model('WasteReport', wasteReportSchema);
