const mongoose = require('mongoose');

const DONATION_STATUS = ['pending', 'donated', 'expired'];

const surplusDonationSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    items: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unit: { type: String, default: 'portions' },
      },
    ],
    totalQuantity: {
      type: Number,
      required: [true, 'Total quantity is required'],
      min: 1,
    },
    donatedTo: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: DONATION_STATUS,
      default: 'pending',
    },
    mealType: {
      type: String,
      enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'],
    },
    notes: {
      type: String,
      maxlength: 500,
    },
    loggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
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

surplusDonationSchema.index({ date: -1 });
surplusDonationSchema.index({ status: 1 });

const SurplusDonation = mongoose.model('SurplusDonation', surplusDonationSchema);

module.exports = SurplusDonation;
module.exports.DONATION_STATUS = DONATION_STATUS;
