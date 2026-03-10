const { MongoClient, ObjectId } = require("mongodb");
const client = new MongoClient("mongodb://localhost:27017/smart-cafe");

/**
 * Test booking creation to see if no-show penalty error occurs
 */
async function testBooking() {
  try {
    await client.connect();
    const db = client.db("smart-cafe");

    const userId = new ObjectId("6989c5e0047c1c20a83a3c9d");
    const user = await db.collection("users").findOne({ _id: userId });
    console.log("Testing user:", user.fullName);

    // Get a today slot
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todaySlots = await db
      .collection("slots")
      .find({
        date: { $gte: todayStart, $lt: todayEnd },
      })
      .toArray();

    console.log("\nAvailable slots for today:", todaySlots.length);
    if (todaySlots.length === 0) {
      console.log("No slots available, checking any future slots...");
      const anySlots = await db.collection("slots").find({}).limit(1).toArray();
      if (anySlots.length > 0) {
        console.log(
          "Using anySlot date for testing:",
          new Date(anySlots[0].date),
        );
      }
    } else {
      console.log(
        "First slot:",
        todaySlots[0].time,
        "on",
        new Date(todaySlots[0].date),
      );
    }

    // Check the penalty check logic
    const noShowPenaltyDays = 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - noShowPenaltyDays);

    console.log("\n=== PENALTY CHECK ===");
    console.log("Today:", new Date().toISOString().split("T")[0]);
    console.log("Cutoff (7 days ago):", cutoff.toISOString().split("T")[0]);

    // Find slots from last 7 days
    const recentSlots = await db
      .collection("slots")
      .find({
        date: { $gte: cutoff },
      })
      .toArray();

    console.log("Slots from last 7 days:", recentSlots.length);

    // Check for user's no-shows
    const recentNoShow = await db.collection("bookings").findOne({
      user: userId,
      status: "no_show",
      slot: { $in: recentSlots.map((s) => s._id) },
    });

    if (recentNoShow) {
      console.log("❌ User WOULD BE BLOCKED:", recentNoShow.tokenNumber);
    } else {
      console.log("✅ User should NOT be blocked");
    }
  } finally {
    await client.close();
  }
}

testBooking().catch((e) => console.error(e.message));
