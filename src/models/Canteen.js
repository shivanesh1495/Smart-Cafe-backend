const mongoose = require("mongoose");

const STATUSES = ["Open", "Closed", "Closing Soon"];
const CROWD_LEVELS = ["Low", "Medium", "High"];
const ECO_SCORES = ["A", "B", "C", "D", "E"];

const operatingHoursSchema = new mongoose.Schema(
  {
    open: { type: String, default: "08:00" },
    close: { type: String, default: "20:00" },
  },
  { _id: false },
);

const canteenSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Canteen name is required"],
      trim: true,
      maxlength: [100, "Canteen name cannot exceed 100 characters"],
    },
    location: {
      type: String,
      trim: true,
      maxlength: [200, "Location cannot exceed 200 characters"],
      default: "",
    },
    status: {
      type: String,
      enum: {
        values: STATUSES,
        message: "Invalid status",
      },
      default: "Open",
    },
    crowd: {
      type: String,
      enum: {
        values: CROWD_LEVELS,
        message: "Invalid crowd level",
      },
      default: "Low",
    },
    capacity: {
      type: Number,
      required: [true, "Capacity is required"],
      min: [1, "Capacity must be at least 1"],
    },
    occupancy: {
      type: Number,
      default: 0,
      min: [0, "Occupancy cannot be negative"],
    },
    manualOccupancyOverride: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    imageColor: {
      type: String,
      default: "bg-orange-100",
    },
    operatingHours: {
      type: operatingHoursSchema,
      default: () => ({}),
    },
    ecoScore: {
      type: String,
      enum: {
        values: ECO_SCORES,
        message: "Invalid eco score",
      },
      default: "B",
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
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
  },
);

// Indexes
canteenSchema.index({ name: "text", location: "text" });
canteenSchema.index({ status: 1 });
canteenSchema.index({ isActive: 1 });

const Canteen = mongoose.model("Canteen", canteenSchema);

module.exports = Canteen;
module.exports.STATUSES = STATUSES;
module.exports.CROWD_LEVELS = CROWD_LEVELS;
module.exports.ECO_SCORES = ECO_SCORES;
