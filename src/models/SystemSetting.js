const mongoose = require("mongoose");

const DATA_TYPES = ["STRING", "NUMBER", "BOOLEAN", "JSON"];
const CATEGORIES = [
  "BOOKING",
  "CAPACITY",
  "NOTIFICATION",
  "SECURITY",
  "GENERAL",
  "FOOD",
];

const systemSettingSchema = new mongoose.Schema(
  {
    settingKey: {
      type: String,
      required: [true, "Setting key is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    settingValue: {
      type: String,
      required: [true, "Setting value is required"],
    },
    dataType: {
      type: String,
      enum: {
        values: DATA_TYPES,
        message: "Invalid data type",
      },
      default: "STRING",
    },
    category: {
      type: String,
      enum: {
        values: CATEGORIES,
        message: "Invalid category",
      },
      default: "GENERAL",
    },
    description: {
      type: String,
      trim: true,
    },
    isEditable: {
      type: Boolean,
      default: true,
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

// Index
systemSettingSchema.index({ category: 1 });

// Virtual to get typed value
systemSettingSchema.virtual("typedValue").get(function () {
  switch (this.dataType) {
    case "NUMBER":
      return parseFloat(this.settingValue);
    case "BOOLEAN":
      return this.settingValue.toLowerCase() === "true";
    case "JSON":
      try {
        return JSON.parse(this.settingValue);
      } catch {
        return this.settingValue;
      }
    default:
      return this.settingValue;
  }
});

// Static method to get value by key
systemSettingSchema.statics.getValue = async function (key) {
  const setting = await this.findOne({ settingKey: key.toUpperCase() });
  if (!setting) return null;
  return setting.typedValue;
};

// Static method to set value
systemSettingSchema.statics.setValue = async function (
  key,
  value,
  options = {},
) {
  const update = {
    settingKey: key.toUpperCase(),
    settingValue: String(value),
    ...options,
  };

  return this.findOneAndUpdate({ settingKey: key.toUpperCase() }, update, {
    upsert: true,
    new: true,
  });
};

const SystemSetting = mongoose.model("SystemSetting", systemSettingSchema);

module.exports = SystemSetting;
module.exports.DATA_TYPES = DATA_TYPES;
module.exports.CATEGORIES = CATEGORIES;
