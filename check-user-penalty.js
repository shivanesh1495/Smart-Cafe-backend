const { MongoClient, ObjectId } = require("mongodb");
const client = new MongoClient("mongodb://localhost:27017/smart-cafe");

client
  .connect()
  .then(async () => {
    const db = client.db("smart-cafe");

    const userId = new ObjectId("6989c5e0047c1c20a83a3c9d");
    const user = await db.collection("users").findOne({ _id: userId });
    console.log("👤 User:", user.fullName, "(" + user.email + ")");
    console.log("   Status:", user.status);

    // Get the no-show bookings for this user
    const noShowBookings = await db
      .collection("bookings")
      .find({
        user: userId,
        status: "no_show",
      })
      .toArray();

    console.log("\n⚠️  No-Show Bookings (" + noShowBookings.length + "):");

    for (const booking of noShowBookings) {
      const slot = await db.collection("slots").findOne({ _id: booking.slot });
      console.log(`  - Token: ${booking.tokenNumber}`);
      console.log(
        `    Slot Date: ${slot?.date?.toLocaleDateString() || "Unknown"}`,
      );
      console.log(
        `    Booking Date: ${booking.cancelledAt?.toLocaleDateString() || "Unknown"}`,
      );
    }

    // Check the 7 day cutoff
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    console.log("\n📅 Seven Days Ago:", sevenDaysAgo.toLocaleDateString());

    const recentSlots = await db
      .collection("slots")
      .find({ date: { $gte: sevenDaysAgo } })
      .toArray();
    console.log("   Slots in last 7 days:", recentSlots.length);

    const blockedBookings = await db
      .collection("bookings")
      .find({
        user: userId,
        status: "no_show",
        slot: { $in: recentSlots.map((s) => s._id) },
      })
      .toArray();

    console.log("   No-shows blocking user:", blockedBookings.length);

    if (blockedBookings.length > 0) {
      console.log(
        "\n✅ SOLUTION: User IS currently blocked by no-show penalty",
      );
      console.log("   To unblock, run:");
      console.log("   node fix-no-show-penalty.js --convert-to-cancelled");
    }

    await client.close();
  })
  .catch((e) => console.error(e.message));
