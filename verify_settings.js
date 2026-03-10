const mongoose = require("mongoose");

// Force require individual models if index is broken
const SystemSetting = require("./src/models/SystemSetting");
const Slot = require("./src/models/Slot");
const systemService = require("./src/services/system.service");
const slotService = require("./src/services/slot.service");

// Mock config
const MONGODB_URI = "mongodb://127.0.0.1:27017/smart-cafe";

const run = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");

    // 1. Test Saving Operating Schedule
    console.log("\n--- Testing Save Schedule ---");
    const schedule = [
      {
        day: "Monday",
        isOpen: true,
        openTime: "08:00",
        closeTime: "20:00",
        isHoliday: false,
      },
      {
        day: "Tuesday",
        isOpen: false, // Closed on Tuesday
        openTime: "08:00",
        closeTime: "20:00",
        isHoliday: false,
      },
    ];

    const keys = [
      { key: "operating_schedule", value: JSON.stringify(schedule) },
    ];
    
    // Simulate user ID 'admin'
    await systemService.bulkUpdateSettings(keys, "admin");
    console.log("Bulk update called.");

    // 2. Read back
    const stored = await SystemSetting.getValue("OPERATING_SCHEDULE");
    console.log("Stored Schedule:", stored);
    
    if (!stored || JSON.parse(stored).length === 0) {
        console.error("FATAL: Schedule not saved or empty.");
    } else {
        console.log("Schedule verified in DB.");
    }

    // 3. Test Slot Validation
    console.log("\n--- Testing Slot Validation ---");
    
    // Mock Data
    const today = new Date();
    // Force date to next Monday and Tuesday
    const nextMonday = new Date();
    nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7) || 7);
    nextMonday.setHours(10, 0, 0, 0); // 10:00 AM OK

    const nextTuesday = new Date();
    nextTuesday.setDate(today.getDate() + ((2 + 7 - today.getDay()) % 7) || 7);
    nextTuesday.setHours(10, 0, 0, 0); // 10:00 AM Closed

    // Test Monday (Should succeed)
    try {
        console.log(`Trying to create slot on Monday ${nextMonday.toISOString()}...`);
        const slot1 = await slotService.createSlot({
            date: nextMonday,
            time: "10:00 - 10:15",
            capacity: 10,
            mealType: "BREAKFAST"
        });
        console.log("SUCCESS: Created slot on Monday (Open day). ID:", slot1._id);
        // Clean up
        await Slot.findByIdAndDelete(slot1._id);
    } catch (e) {
        console.error("FAILURE: Failed to create valid slot on Monday:", e);
    }

    // Test Tuesday (Should fail)
    try {
        console.log(`Trying to create slot on Tuesday ${nextTuesday.toISOString()}...`);
        const slot2 = await slotService.createSlot({
            date: nextTuesday,
            time: "10:00 - 10:15",
            capacity: 10,
            mealType: "BREAKFAST"
        });
        console.error("FAILURE: Created slot on Tuesday (Closed day) - Validation Failed!");
        // Clean up if it was created
        await Slot.findByIdAndDelete(slot2._id);
    } catch (e) {
        console.log("SUCCESS: Blocked slot on Tuesday:", e.message);
    }

  } catch (err) {
    console.error("Script Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected");
  }
};

run();
