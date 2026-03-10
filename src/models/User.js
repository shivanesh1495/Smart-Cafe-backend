const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ROLES = [
  "user",
  "canteen_staff",
  "kitchen_staff",
  "counter_staff",
  "manager",
  "admin",
];
const STATUS = ["active", "suspended"];

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: {
        values: ROLES,
        message: "Invalid role",
      },
      default: "user",
    },
    status: {
      type: String,
      enum: STATUS,
      default: "active",
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
    // Canteen assignment for staff members
    canteenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Canteen",
      default: null,
    },
    // User segment for priority booking
    segment: {
      type: String,
      enum: ["student", "faculty", "guest", "vip"],
      default: "student",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret._id.toString();
        ret.name = ret.fullName; // Alias for frontend compatibility
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.otp;
        delete ret.otpExpiry;
        return ret;
      },
    },
  },
);

// Index for faster queries
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check if OTP is valid
userSchema.methods.isOtpValid = function (otp) {
  if (!this.otp || !this.otpExpiry) return false;
  if (this.otp !== otp) return false;
  return new Date() < this.otpExpiry;
};

// Static method to find by credentials
userSchema.statics.findByCredentials = async function (email, password) {
  const user = await this.findOne({ email }).select("+password");
  if (!user) return null;

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return null;

  return user;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
module.exports.STATUS = STATUS;
