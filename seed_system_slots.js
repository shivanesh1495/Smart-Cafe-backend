/**
 * Seed System Slots
 *
 * Creates default daily slot templates that:
 * - Cannot be deleted (only disabled/cancelled)
 * - Auto-create for each day
 * - Can be customized via system settings
 *
 * Usage:
 *   - Initial setup (all canteens): node seed_system_slots.js
 *   - Initial setup (single canteen): node seed_system_slots.js --canteen=<canteenId>
 *   - Daily cron (all canteens): node seed_system_slots.js --daily
 *   - Daily cron (single canteen): node seed_system_slots.js --daily --canteen=<canteenId>
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Slot = require("./src/models/Slot");
const Canteen = require("./src/models/Canteen");

// Get days to seed from command line args (default 7)
const args = process.argv.slice(2);
const isDailyMode = args.includes("--daily");
const DAYS_TO_SEED = isDailyMode ? 1 : 7;

// Get canteen filter from command line
const canteenArg = args.find((arg) => arg.startsWith("--canteen="));
const targetCanteenId = canteenArg ? canteenArg.split("=")[1] : null;

const SYSTEM_SLOTS = [
  // Breakfast slots
  { time: "07:00 AM - 08:00 AM", mealType: "BREAKFAST", capacity: 80 },
  { time: "08:00 AM - 09:00 AM", mealType: "BREAKFAST", capacity: 100 },
  { time: "09:00 AM - 10:00 AM", mealType: "BREAKFAST", capacity: 60 },

  // Lunch slots
  { time: "12:00 PM - 12:30 PM", mealType: "LUNCH", capacity: 150 },
  { time: "12:30 PM - 01:00 PM", mealType: "LUNCH", capacity: 200 },
  { time: "01:00 PM - 01:30 PM", mealType: "LUNCH", capacity: 150 },
  { time: "01:30 PM - 02:00 PM", mealType: "LUNCH", capacity: 100 },

  // Snacks slots
  { time: "04:00 PM - 04:30 PM", mealType: "SNACKS", capacity: 80 },
  { time: "04:30 PM - 05:00 PM", mealType: "SNACKS", capacity: 100 },

  // Dinner slots
  { time: "07:00 PM - 07:30 PM", mealType: "DINNER", capacity: 120 },
  { time: "07:30 PM - 08:00 PM", mealType: "DINNER", capacity: 150 },
  { time: "08:00 PM - 08:30 PM", mealType: "DINNER", capacity: 120 },
  { time: "08:30 PM - 09:00 PM", mealType: "DINNER", capacity: 80 },
];

async function seedSystemSlots() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Calculate date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // In daily mode, create slots for tomorrow through (tomorrow + DAYS_TO_SEED - 1)
    // In initial mode, create slots for today through (today + DAYS_TO_SEED - 1)
    const startOffset = isDailyMode ? 1 : 0;
    const dates = [];

    for (let i = startOffset; i < startOffset + DAYS_TO_SEED; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    // Get list of canteens to create slots for
    let canteenIds = [];
    if (targetCanteenId) {
      // Single canteen mode
      const canteen = await Canteen.findById(targetCanteenId);
      if (!canteen) {
        console.error(`❌ Canteen with ID ${targetCanteenId} not found`);
        process.exit(1);
      }
      canteenIds = [targetCanteenId];
      console.log(`\n🏢 Creating slots for canteen: ${canteen.name}`);
    } else {
      // All canteens mode
      const canteens = await Canteen.find({ isActive: true });
      if (canteens.length === 0) {
        console.warn("⚠️  No active canteens found. Using 'default' canteen.");
        canteenIds = ["default"];
      } else {
        canteenIds = canteens.map((c) => c._id.toString());
        console.log(`\n🏢 Creating slots for ${canteenIds.length} canteen(s)`);
      }
    }

    const modeText = isDailyMode
      ? "daily mode - creating tomorrow's slots"
      : `initial mode - creating next ${DAYS_TO_SEED} days`;
    console.log(`🔄 Running in ${modeText}...`);

    let created = 0;
    let skipped = 0;

    for (const canteenId of canteenIds) {
      for (const date of dates) {
        for (const slotTemplate of SYSTEM_SLOTS) {
          // Check if slot already exists
          const existing = await Slot.findOne({
            date: date,
            time: slotTemplate.time,
            canteenId: canteenId,
          });

          if (existing) {
            skipped++;
            continue;
          }

          // Create system slot
          await Slot.create({
            date: date,
            time: slotTemplate.time,
            mealType: slotTemplate.mealType,
            capacity: slotTemplate.capacity,
            booked: 0,
            status: "Open",
            canteenId: canteenId,
            isSystemSlot: true,
            isDisabled: false,
          });

          created++;
        }
      }
    }

    console.log(`\n✅ Seeding complete!`);
    console.log(`   Created: ${created} slots`);
    console.log(`   Skipped: ${skipped} (already exist)`);
    console.log(
      `\nSystem slots are marked with isSystemSlot=true and cannot be deleted.`,
    );
    console.log(`They can only be disabled or cancelled by admins.`);

    if (isDailyMode && created > 0) {
      console.log(`\n📅 Tomorrow's slots have been created successfully.`);
    }
  } catch (error) {
    console.error("❌ Error seeding system slots:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
    process.exit(0);
  }
}

seedSystemSlots();
