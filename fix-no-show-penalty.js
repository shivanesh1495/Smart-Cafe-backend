/**
 * DIRECT FIX: Clear all no-show penalties from the database
 * This removes the booking block that's preventing users from making new bookings
 */

const { MongoClient, ObjectId } = require("mongodb");

const MONGODB_URL =
  process.env.MONGODB_URL || "mongodb://localhost:27017/smart-cafe";

async function clearAllNoShowPenalties() {
  const client = new MongoClient(MONGODB_URL, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  });

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    console.log("✓ Connected");

    const db = client.db("smart-cafe");
    const bookingsCollection = db.collection("bookings");
    const usersCollection = db.collection("users");

    // Find all recent no-show bookings (slots within last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log("\n🔍 Checking for users with no-show penalty...");

    // First find slots from the last 7 days
    const slotsCollection = db.collection("slots");
    const recentSlots = await slotsCollection
      .find({ date: { $gte: sevenDaysAgo } })
      .toArray();

    const recentSlotIds = recentSlots.map((s) => s._id.toString());

    // Then find no-show bookings for those slots
    const noShowBookings = await bookingsCollection
      .find({
        status: "no_show",
        slot: { $in: recentSlots.map((s) => s._id) },
      })
      .toArray();

    if (noShowBookings.length === 0) {
      console.log("✓ No users are currently blocked by no-show penalty");
      console.log("\nNote: The 403 error might be from a different issue.");
      console.log("Check if:");
      console.log("  1. The booking API endpoint is working");
      console.log("  2. The user has a valid authentication token");
      console.log("  3. The user account is active/not suspended");
      await client.close();
      process.exit(0);
    }

    console.log(`\n⚠️  Found ${noShowBookings.length} no-show booking(s):`);

    // Group by user
    const userIds = new Set(
      noShowBookings.filter((b) => b.user).map((b) => b.user.toString()),
    );

    const blockedUsers = await usersCollection
      .find({ _id: { $in: Array.from(userIds).map((id) => new ObjectId(id)) } })
      .toArray();

    console.log("\nBlocked Users:");
    blockedUsers.forEach((user) => {
      console.log(`  - ${user.fullName} (${user.email})`);
    });

    noShowBookings.forEach((booking, idx) => {
      console.log(
        `  ${idx + 1}. Token: ${booking.tokenNumber}, Created: ${booking.createdAt?.toLocaleString() || "N/A"}`,
      );
    });

    // Option 1: Delete all no-show bookings (they were missed anyway)
    console.log("\n🔧 FIXES AVAILABLE:\n");
    console.log("Option A: Delete all no-show bookings (clean slate)");
    console.log("  Run: node fix-no-show-penalty.js --delete-no-shows\n");
    console.log(
      "Option B: Change no-show bookings to 'cancelled' (keep history)",
    );
    console.log("  Run: node fix-no-show-penalty.js --convert-to-cancelled\n");
    console.log(
      "Option C: Age-date the no-show bookings (mark as >7 days old)",
    );
    console.log("  Run: node fix-no-show-penalty.js --age-date-no-shows\n");

    // Check for command line argument
    const arg = process.argv[2];
    const filterCriteria = {
      status: "no_show",
      slot: { $in: recentSlots.map((s) => s._id) },
    };

    if (arg === "--delete-no-shows") {
      console.log("Deleting no-show bookings...");
      const result = await bookingsCollection.deleteMany(filterCriteria);
      console.log(`✓ Deleted ${result.deletedCount} no-show bookings`);
    } else if (arg === "--convert-to-cancelled") {
      console.log("Converting no-show bookings to cancelled status...");
      const result = await bookingsCollection.updateMany(filterCriteria, {
        $set: {
          status: "cancelled",
          cancellationReason: "Cleared by admin - no-show penalty released",
        },
      });
      console.log(`✓ Updated ${result.modifiedCount} bookings`);
    } else if (arg === "--age-date-no-shows") {
      console.log(
        "Aging no-show bookings by marking linked slots as old (penalty expires automatically)...",
      );
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const noShowSlotIds = noShowBookings.map((b) => b.slot.toString());
      const result = await slotsCollection.updateMany(
        {
          _id: {
            $in: noShowSlotIds.map(
              (id) => new (require("mongodb").ObjectId)(id),
            ),
          },
        },
        {
          $set: {
            date: eightDaysAgo,
          },
        },
      );
      console.log(`✓ Aged ${result.modifiedCount} bookings' slots`);
    }

    console.log("\n✅ Fix complete!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.code === "ECONNREFUSED") {
      console.error("\n⚠️  MongoDB is not running. Start it first:");
      console.error(
        "  cd d:\\SOFTWARE\\mongodb8\\mongodb-win32-x86_64-windows-8.0.6",
      );
      console.error("  .\\bin\\mongod.exe");
    }
  } finally {
    await client.close();
    process.exit(0);
  }
}

clearAllNoShowPenalties();
