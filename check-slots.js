const mongoose = require("mongoose");
const Slot = require("./src/models/Slot");
const Booking = require("./src/models/Booking");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-cafe";

const checkSlots = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Get today's slots
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log("📅 TODAY'S SLOTS:\n");

    const slots = await Slot.find({
      date: { $gte: today, $lt: tomorrow },
    })
      .select("time capacity booked status mealType")
      .sort({ time: 1 });

    if (slots.length === 0) {
      console.log("⚠️  No slots found for today!");
      console.log("\n🔧 Creating sample slots for today...\n");

      const sampleSlots = [
        { time: "12:00 PM", mealType: "LUNCH", capacity: 100 },
        { time: "12:30 PM", mealType: "LUNCH", capacity: 100 },
        { time: "01:00 PM", mealType: "LUNCH", capacity: 100 },
        { time: "01:30 PM", mealType: "LUNCH", capacity: 100 },
        { time: "02:00 PM", mealType: "LUNCH", capacity: 100 },
        { time: "07:00 PM", mealType: "DINNER", capacity: 100 },
        { time: "07:30 PM", mealType: "DINNER", capacity: 100 },
      ];

      const createdSlots = [];
      for (const slotData of sampleSlots) {
        const slot = await Slot.create({
          date: today,
          time: slotData.time,
          mealType: slotData.mealType,
          capacity: slotData.capacity,
          booked: 0,
          status: "Open",
          canteenId: "default",
        });
        createdSlots.push(slot);
      }

      console.log(`✓ Created ${createdSlots.length} slots for today`);
      console.log("\n📋 CREATED SLOTS:");
      for (const slot of createdSlots) {
        console.log(
          `   • ${slot.time}: ${slot.capacity} capacity, Status: ${slot.status}`,
        );
      }
    } else {
      console.log(`Found ${slots.length} slots:\n`);

      for (const slot of slots) {
        const available = slot.capacity - slot.booked;
        const statusMark = slot.status === "Open" ? "✓" : "✗";
        console.log(`${statusMark} ${slot.time} (${slot.mealType})`);
        console.log(
          `   • Capacity: ${slot.capacity}, Booked: ${slot.booked}, Available: ${available}`,
        );
        console.log(`   • Status: ${slot.status}`);
      }
    }

    // Check bookings
    const bookingsToday = await Booking.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow },
    });

    console.log(`\n📊 BOOKINGS TODAY: ${bookingsToday}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

checkSlots();
