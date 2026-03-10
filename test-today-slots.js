const mongoose = require("mongoose");
require("dotenv").config();
const Slot = require("./src/models/Slot");

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    console.log("Today bounds:");
    console.log("  Start:", start.toISOString());
    console.log("  End:", end.toISOString());
    console.log("");

    // Test getTodaySlots filter
    const filter = {
      date: { $gte: start, $lte: end },
      status: { $ne: "Cancelled" },
      isDisabled: { $ne: true },
    };

    const todaySlots = await Slot.find(filter).lean();
    console.log(
      `Found ${todaySlots.length} slots matching getTodaySlots filter (non-cancelled, not disabled):`,
    );
    todaySlots.forEach((s) => {
      console.log(
        `  - ${s.time} (${s.mealType}) canteen:${s.canteenId} isSystem:${s.isSystemSlot} status:${s.status || "Open"}`,
      );
    });
    console.log("");

    // Also check all slots for today (no status filter)
    const allToday = await Slot.find({
      date: { $gte: start, $lte: end },
    }).lean();
    console.log(
      `Total slots created for today (including cancelled/disabled): ${allToday.length}`,
    );

    mongoose.disconnect();
  })
  .catch(console.error);
