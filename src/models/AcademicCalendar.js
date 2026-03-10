const mongoose = require('mongoose');

const EVENT_TYPES = ['Exam', 'Holiday', 'Festival', 'Graduation', 'Orientation', 'Vacation', 'Event'];

const academicCalendarSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    eventType: {
      type: String,
      enum: {
        values: EVENT_TYPES,
        message: 'Invalid event type',
      },
      required: [true, 'Event type is required'],
    },
    demandMultiplier: {
      type: Number,
      default: 1.0,
      min: 0,
      max: 3,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
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

academicCalendarSchema.index({ startDate: 1, endDate: 1 });
academicCalendarSchema.index({ eventType: 1 });

/**
 * Check if a date falls within this event
 */
academicCalendarSchema.methods.containsDate = function (date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const start = new Date(this.startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(this.endDate);
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
};

/**
 * Find active events for a given date
 */
academicCalendarSchema.statics.getActiveEvents = async function (date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const endOfDay = new Date(d);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    isActive: true,
    startDate: { $lte: endOfDay },
    endDate: { $gte: d },
  });
};

const AcademicCalendar = mongoose.model('AcademicCalendar', academicCalendarSchema);

module.exports = AcademicCalendar;
module.exports.EVENT_TYPES = EVENT_TYPES;
