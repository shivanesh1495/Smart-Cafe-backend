const mongoose = require("mongoose");
const SystemSetting = require("./src/models/SystemSetting");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-cafe";

const diagnosticCheck = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Check for all policy settings
    const policyKeys = [
      "MAX_BOOKINGS_PER_STUDENT_PER_DAY",
      "PEAK_BOOKING_WINDOW_MINS",
      "TOKEN_EXPIRY_DURATION_MINS",
      "NO_SHOW_GRACE_PERIOD_MINS",
      "NO_SHOW_PENALTY_DAYS",
      "RICE_PORTION_LIMIT_G",
      "CURRY_PORTION_LIMIT_ML",
      "MAX_CAPACITY_PER_SLOT",
      "FACULTY_RESERVED_SLOTS",
      "GUEST_RESERVED_SLOTS",
    ];

    console.log("📋 CURRENT POLICY SETTINGS:\n");

    for (const key of policyKeys) {
      const setting = await SystemSetting.findOne({ settingKey: key });
      if (setting) {
        console.log(`✓ ${key}`);
        console.log(`  Value: ${setting.settingValue}`);
        console.log(`  Type: ${setting.dataType}`);
        console.log(`  Last Updated: ${setting.updatedAt}`);
      } else {
        console.log(`✗ ${key} - NOT FOUND`);
      }
      console.log("");
    }

    // Check if there are any settings at all
    const totalSettings = await SystemSetting.countDocuments();
    console.log(`\n📊 Total settings in database: ${totalSettings}`);

    // Get all booking-related settings
    const bookingSettings = await SystemSetting.find({ category: "BOOKING" });
    console.log(
      `\n📌 BOOKING CATEGORY SETTINGS: ${bookingSettings.length} total`,
    );
    for (const setting of bookingSettings) {
      console.log(`   • ${setting.settingKey}: ${setting.settingValue}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

diagnosticCheck();
