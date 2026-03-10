const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      // Optional, some feedback might be general
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    // AI Integration Fields
    aiSentimentScore: {
      type: Number,
      // Ranges from -1 (very negative) to 1 (very positive)
    },
    aiSentimentTag: {
      type: String,
      enum: ["Positive", "Neutral", "Negative"],
    },
    aiTopics: [
      {
        type: String,
        trim: true,
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
  }
);

// Indexes for faster querying by Admins/Managers
feedbackSchema.index({ user: 1 });
feedbackSchema.index({ rating: 1 });
feedbackSchema.index({ aiSentimentTag: 1 });
feedbackSchema.index({ createdAt: -1 });

const Feedback = mongoose.model("Feedback", feedbackSchema);

module.exports = Feedback;
