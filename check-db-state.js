const { MongoClient } = require("mongodb");
const client = new MongoClient("mongodb://localhost:27017/smart-cafe");

client
  .connect()
  .then(async () => {
    const db = client.db("smart-cafe");
    const bookings = await db.collection("bookings").find({}).toArray();
    console.log("📦 Total Bookings:", bookings.length);

    const noShows = await db
      .collection("bookings")
      .find({ status: "no_show" })
      .toArray();
    console.log("⚠️  No-Show Bookings:", noShows.length);
    if (noShows.length > 0) {
      noShows.forEach((b) =>
        console.log("  -", b.tokenNumber, "User:", b.user),
      );
    }

    const slots = await db.collection("slots").find({}).toArray();
    console.log("⏰ Total Slots:", slots.length);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySlots = await db
      .collection("slots")
      .find({ date: { $gte: today } })
      .toArray();
    console.log("📅 Today/Future Slots:", todaySlots.length);

    // Check the actual response when trying to book
    const confirmedToday = await db
      .collection("bookings")
      .find({
        status: "confirmed",
        slot: { $in: todaySlots.map((s) => s._id) },
      })
      .toArray();
    console.log("✅ Confirmed Bookings Today:", confirmedToday.length);

    await client.close();
  })
  .catch((e) => console.error(e.message));
