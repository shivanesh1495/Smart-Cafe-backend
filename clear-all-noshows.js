/**
 * AGGRESSIVE FIX: Clear ALL no-show bookings (even old ones)
 * Convert them all to 'cancelled' status to ensure they never block users
 */

const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URL =
  process.env.MONGODB_URL || "mongodb://localhost:27017/smart-cafe";

async function clearAllNoShows() {
  const client = new MongoClient(MONGODB_URL, {
    serverSelectionTimeoutMS: 5000,
  });

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    console.log("✓ Connected");

    const db = client.db("smart-cafe");
    const bookingsCollection = db.collection("bookings");

    // Find ALL no-show bookings (not just recent ones)
    console.log("\n🔍 Finding all no-show bookings...");
    const allNoShows = await bookingsCollection
      .find({ status: "no_show" })
      .toArray();

    if (allNoShows.length === 0) {
      console.log("✅ No no-show bookings found");
      await client.close();
      process.exit(0);
    }

    console.log(`\n⚠️  Found ${allNoShows.length} no-show bookings:`);

    const usersCollection = db.collection("users");
    const userIds = new Set(
      allNoShows.filter((b) => b.user).map((b) => b.user.toString()),
    );
    const users = await usersCollection
      .find({ _id: { $in: Array.from(userIds).map((id) => new ObjectId(id)) } })
      .toArray();

    const userMap = new Map(
      users.map((u) => [u._id.toString(), u.fullName + " (" + u.email + ")"]),
    );

    allNoShows.forEach((booking, idx) => {
      const userName = userMap.get(booking.user.toString()) || "Unknown";
      console.log(
        `  ${idx + 1}. Token: ${booking.tokenNumber}, User: ${userName}`,
      );
    });

    // Convert all no-shows to cancelled
    console.log("\n🔧 Converting all no-show bookings to cancelled...");
    const result = await bookingsCollection.updateMany(
      { status: "no_show" },
      {
        $set: {
          status: "cancelled",
          cancellationReason: "Auto-cleared by admin - no-show penalty removed",
        },
      },
    );

    console.log(`✅ Updated ${result.modifiedCount} bookings`);
    console.log(
      "\n📌 Result: All users now can book again without no-show blocks",
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.code === "ECONNREFUSED") {
      console.error("\n⚠️  MongoDB is not running");
    }
  } finally {
    await client.close();
    process.exit(0);
  }
}

clearAllNoShows();
