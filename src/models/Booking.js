const mongoose = require('mongoose');
const { generateTokenNumber } = require('../utils/helpers');

const BOOKING_STATUS = ['confirmed', 'completed', 'cancelled', 'no_show'];

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // Optional for walk-in bookings
    },
    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Slot',
      required: [true, 'Slot is required'],
    },
    tokenNumber: {
      type: String,
      unique: true,
    },
    items: [
      {
        menuItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        portionSize: {
          type: String,
          enum: ['Regular', 'Small'],
          default: 'Regular',
        },
      },
    ],
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: {
        values: BOOKING_STATUS,
        message: 'Invalid booking status',
      },
      default: 'confirmed',
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    // Walk-in booking fields
    isWalkin: {
      type: Boolean,
      default: false,
    },
    guestName: {
      type: String,
      trim: true,
    },
    // Fairness explanation
    allocationReason: {
      type: String,
      default: 'First-come-first-served',
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
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

// Indexes
bookingSchema.index({ user: 1 });
bookingSchema.index({ slot: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdAt: -1 });

// Generate token number before save
bookingSchema.pre('save', async function (next) {
  if (!this.tokenNumber) {
    // Generate unique token
    let token = generateTokenNumber();
    let exists = await mongoose.model('Booking').findOne({ tokenNumber: token });
    
    while (exists) {
      token = generateTokenNumber();
      exists = await mongoose.model('Booking').findOne({ tokenNumber: token });
    }
    
    this.tokenNumber = token;
  }
  next();
});

// Calculate total amount from items
bookingSchema.methods.calculateTotal = function () {
  this.totalAmount = this.items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
module.exports.BOOKING_STATUS = BOOKING_STATUS;
