const { MongoClient, ObjectId } = require("mongodb");

new MongoClient("mongodb://localhost:27017/smart-cafe")
  .connect()
  .then(async (c) => {
    const db = c.db("smart-cafe");
    const userId = new ObjectId("6989c5e0047c1c20a83a3c9d");

    // Get user bookings
    const userBookings = await db
      .collection("bookings")
      .find({ user: userId })
      .toArray();
    console.log("User (shiva123) Bookings:", userBookings.length);
    userBookings.forEach((b) => {
      console.log("  -", b.tokenNumber, "Status:", b.status);
    });

    // Get today's bookings for this user
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySlots = await db
      .collection("slots")
      .find({
        date: { $gte: today, $lt: tomorrow },
      })
      .toArray();

    console.log("\nToday slots:", todaySlots.length);

    const todayBookings = await db
      .collection("bookings")
      .find({
        user: userId,
        slot: { $in: todaySlots.map((s) => s._id) },
        status: "confirmed",
      })
      .toArray();

    console.log("Confirmed bookings today:", todayBookings.length);
    console.log("Max allowed per day: 2");
    console.log("Can book more:", todayBookings.length < 2);

    // Check for any NO-SHOW blocks
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSlots = await db
      .collection("slots")
      .find({
        date: { $gte: sevenDaysAgo },
      })
      .toArray();

    const recentNoShow = await db.collection("bookings").findOne({
      user: userId,
      status: "no_show",
      slot: { $in: recentSlots.map((s) => s._id) },
    });

    console.log("\nNo-show penalty block:", recentNoShow ? "YES ❌" : "NO ✅");

    c.close();
  })
  .catch((e) => console.error(e.message));
