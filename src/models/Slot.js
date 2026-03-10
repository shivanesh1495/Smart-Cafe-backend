const mongoose = require("mongoose");

const SLOT_STATUS = ["Open", "Full", "Cancelled", "FastFilling"];

const to12Hour = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";

  const ampmMatch = text.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (ampmMatch) {
    const hours = Number(ampmMatch[1]);
    const minutes = ampmMatch[2];
    const period = ampmMatch[3].toUpperCase();
    if (hours >= 1 && hours <= 12) {
      return `${String(hours).padStart(2, "0")}:${minutes} ${period}`;
    }
    return text;
  }

  const hhmmMatch = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!hhmmMatch) return text;

  const hours24 = Number(hhmmMatch[1]);
  const minutes = hhmmMatch[2];
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${String(hours12).padStart(2, "0")}:${minutes} ${period}`;
};

const slotSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, "Slot date is required"],
    },
    time: {
      type: String,
      required: [true, "Slot time is required"],
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, "Slot capacity is required"],
      min: [1, "Capacity must be at least 1"],
    },
    booked: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: {
        values: SLOT_STATUS,
        message: "Invalid slot status",
      },
      default: "Open",
    },
    mealType: {
      type: String,
      enum: ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"],
      default: "LUNCH",
    },
    canteenId: {
      type: String,
      default: "default",
    },
    isSystemSlot: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDisabled: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        if (ret.time) {
          const parts = String(ret.time)
            .split("-")
            .map((part) => part.trim())
            .filter(Boolean);
          const start = to12Hour(parts[0] || ret.time);
          const end = to12Hour(parts[1] || "");
          ret.time = end ? `${start} - ${end}` : start;
        }

        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Compound index for unique slot per date, time, and canteen
slotSchema.index({ date: 1, time: 1, canteenId: 1 }, { unique: true });
slotSchema.index({ date: 1 });
slotSchema.index({ status: 1 });

// Virtual to calculate remaining capacity
slotSchema.virtual("remaining").get(function () {
  return this.capacity - this.booked;
});

slotSchema.virtual("startTime").get(function () {
  if (!this.time) return "";
  const parts = this.time
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
  return to12Hour(parts[0] || this.time);
});

slotSchema.virtual("endTime").get(function () {
  if (!this.time) return "";
  const parts = this.time
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
  return to12Hour(parts[1] || "");
});

// Update status based on capacity
slotSchema.methods.updateStatus = function () {
  if (this.status === "Cancelled") return;

  const ratio = this.booked / this.capacity;

  if (ratio >= 1) {
    this.status = "Full";
  } else if (ratio >= 0.8) {
    this.status = "FastFilling";
  } else {
    this.status = "Open";
  }
};

// Pre-save hook to update status
slotSchema.pre("save", function (next) {
  if (this.isModified("booked") || this.isModified("capacity")) {
    this.updateStatus();
  }
  next();
});

const Slot = mongoose.model("Slot", slotSchema);

module.exports = Slot;
module.exports.SLOT_STATUS = SLOT_STATUS;
