const { MongoClient, ObjectId } = require("mongodb");
const client = new MongoClient("mongodb://localhost:27017/smart-cafe");

client
  .connect()
  .then(async () => {
    const db = client.db("smart-cafe");

    const userId = new ObjectId("6989c5e0047c1c20a83a3c9d");

    // Get the no-show bookings for this user - with ALL fields
    const noShowBookings = await db
      .collection("bookings")
      .find({
        user: userId,
        status: "no_show",
      })
      .toArray();

    console.log("⚠️  No-Show Bookings Details:");
    noShowBookings.forEach((booking, idx) => {
      console.log(`\n${idx + 1}. Token: ${booking.tokenNumber}`);
      console.log(`   Slot Date (from slot table): Will check...`);
      console.log(
        `   Created At: ${booking.createdAt ? new Date(booking.createdAt).toISOString() : "N/A"}`,
      );
      console.log(
        `   Cancelled At: ${booking.cancelledAt ? new Date(booking.cancelledAt).toISOString() : "N/A"}`,
      );
    });

    // Now let me check with fresh penalty check logic
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log("\nPenalty Check:");
    console.log("Today:", today.toISOString().split("T")[0]);
    console.log("7 days ago:", sevenDaysAgo.toISOString().split("T")[0]);

    // Get slots from last 7 days
    const recentSlots = await db
      .collection("slots")
      .find({
        date: { $gte: sevenDaysAgo },
      })
      .toArray();

    console.log("\nSlots from last 7 days:", recentSlots.length);
    recentSlots.forEach((s, i) => {
      console.log(
        `  ${i + 1}. ${s.time} on ${new Date(s.date).toISOString().split("T")[0]}`,
      );
    });

    // Check if user has no-shows for those slots
    const blockedBookings = await db
      .collection("bookings")
      .find({
        user: userId,
        status: "no_show",
        slot: { $in: recentSlots.map((s) => s._id) },
      })
      .toArray();

    console.log(
      "\nNo-shows blocking user (from recent slots):",
      blockedBookings.length,
    );

    if (blockedBookings.length === 0) {
      console.log("\n✅ User should NOT be blocked by no-show penalty");
    } else {
      console.log("\n⚠️  User IS blocked by no-show penalty");
      console.log(
        "\nTo fix, run: node fix-no-show-penalty.js --convert-to-cancelled",
      );
    }

    await client.close();
  })
  .catch((e) => console.error(e.message));
