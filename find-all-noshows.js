const { MongoClient } = require("mongodb");
const client = new MongoClient("mongodb://localhost:27017/smart-cafe");

client
  .connect()
  .then(async () => {
    const db = client.db("smart-cafe");

    // Find ALL no-show bookings regardless of date
    const allNoShows = await db
      .collection("bookings")
      .find({
        status: "no_show",
      })
      .sort({ cancelledAt: -1 })
      .toArray();

    console.log("All No-Show Bookings:", allNoShows.length);
    console.log("");

    allNoShows.forEach((booking, idx) => {
      const slotDate = booking.slot ? booking.slot.toString() : "Unknown";
      console.log(`${idx + 1}. Token: ${booking.tokenNumber}`);
      console.log(`   User: ${booking.user}`);
      console.log(
        `   Cancelled: ${booking.cancelledAt ? new Date(booking.cancelledAt).toISOString() : "Unknown"}`,
      );
      console.log(`   Slot ID: ${slotDate}`);
    });

    // Now check what dates these no-show slots actually have
    console.log("\n=== Slot Dates for No-Shows ===");
    for (const booking of allNoShows) {
      const slot = await db.collection("slots").findOne({ _id: booking.slot });
      if (slot) {
        console.log(
          `${booking.tokenNumber}: ${new Date(slot.date).toISOString().split("T")[0]}`,
        );
      }
    }

    // Find the most recent no-show
    const mostRecent = allNoShows.find((b) => b.cancelledAt);
    if (mostRecent) {
      const slotDate = new Date(mostRecent.cancelledAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const noShowDate = new Date(slotDate);
      noShowDate.setHours(0, 0, 0, 0);

      const daysAgo = Math.floor(
        (today.getTime() - noShowDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      console.log(`\nMost recent no-show was ${daysAgo} days ago`);

      if (daysAgo <= 7) {
        console.log("⚠️  This no-show IS within the 7-day penalty window!");
      } else {
        console.log("✅ This no-show is outside the 7-day penalty window");
      }
    }

    await client.close();
  })
  .catch((e) => console.error(e.message));
