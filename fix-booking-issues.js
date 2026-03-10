const mongoose = require("mongoose");
const SystemSetting = require("./src/models/SystemSetting");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-cafe";

const fixBookingIssues = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Fix 1: Remove peak booking window restriction (allow booking anytime)
    console.log("🔧 Fixing PEAK_BOOKING_WINDOW_MINS...");
    await SystemSetting.findOneAndUpdate(
      { settingKey: "PEAK_BOOKING_WINDOW_MINS" },
      { settingValue: "0" }, // 0 = No restriction, bookings open anytime
      { new: true },
    );
    console.log("   ✓ Set to 0 (bookings available all day)\n");

    // Fix 2: Increase max bookings per student per day
    console.log("🔧 Fixing MAX_BOOKINGS_PER_STUDENT_PER_DAY...");
    await SystemSetting.findOneAndUpdate(
      { settingKey: "MAX_BOOKINGS_PER_STUDENT_PER_DAY" },
      { settingValue: "5" }, // Increased from 2 to 5
      { new: true },
    );
    console.log("   ✓ Increased to 5 bookings per day\n");

    // Fix 3: Ensure online booking is enabled
    console.log("🔧 Ensuring ONLINE_BOOKING_ENABLED...");
    await SystemSetting.findOneAndUpdate(
      { settingKey: "ONLINE_BOOKING_ENABLED" },
      { settingValue: "true" },
      { new: true },
    );
    console.log("   ✓ Enabled\n");

    console.log("✅ All booking issues fixed!");
    console.log("\nStudents can now:");
    console.log("  • Book slots at ANY time during the day");
    console.log("  • Make up to 5 bookings per day");
    console.log("  • Use online booking\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

fixBookingIssues();
