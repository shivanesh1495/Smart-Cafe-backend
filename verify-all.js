const mongoose = require("mongoose");
const MenuItem = require("./src/models/MenuItem");
const Booking = require("./src/models/Booking");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-cafe";

const finalVerification = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Check Chicken Fried Rice status
    const chickenFriedRice = await MenuItem.findOne({
      itemName: "Chicken Fried Rice",
    }).select("itemName availableQuantity isAvailable");

    console.log("🔍 CHICKEN FRIED RICE STATUS:");
    if (chickenFriedRice) {
      console.log(`   ✓ Found: ${chickenFriedRice.itemName}`);
      console.log(`   • Quantity: ${chickenFriedRice.availableQuantity} units`);
      console.log(`   • Available: ${chickenFriedRice.isAvailable}`);
      console.log(`   • Item ID: ${chickenFriedRice._id}`);
    } else {
      console.log("   ✗ Item NOT found in database!");
    }

    // Check if item is in any bookings
    if (chickenFriedRice) {
      const bookingsWithItem = await Booking.find({
        "items.menuItem": chickenFriedRice._id,
      }).select("tokenNumber items status createdAt");

      console.log(`\n📋 BOOKINGS WITH CHICKEN FRIED RICE:`);
      if (bookingsWithItem.length > 0) {
        console.log(`   Found ${bookingsWithItem.length} bookings:`);
        for (const booking of bookingsWithItem) {
          const item = booking.items.find(
            (i) => i.menuItem?.toString() === chickenFriedRice._id.toString(),
          );
          console.log(
            `   • Token: ${booking.tokenNumber}, Status: ${booking.status}, Qty: ${item?.quantity}`,
          );
        }
      } else {
        console.log("   ✓ No bookings with this item");
      }
    }

    // List all menu items with their stock
    console.log("\n📊 ALL MENU ITEMS:");
    const allItems = await MenuItem.find({})
      .select("itemName availableQuantity isAvailable")
      .sort({ itemName: 1 });

    let allOk = true;
    for (const item of allItems) {
      const status = item.isAvailable ? "✓" : "✗";
      console.log(
        `   ${status} ${item.itemName}: ${item.availableQuantity} units (Available: ${item.isAvailable})`,
      );
      if (!item.isAvailable || item.availableQuantity === 0) {
        allOk = false;
      }
    }

    console.log(
      `\n${allOk ? "✅ ALL ITEMS ARE AVAILABLE" : "⚠️  Some items may be out of stock"}`,
    );

    // Total bookings
    const totalBookings = await Booking.countDocuments();
    const confirmedBookings = await Booking.countDocuments({
      status: "confirmed",
    });
    const completedBookings = await Booking.countDocuments({
      status: "completed",
    });

    console.log(`\n📈 BOOKING STATS:`);
    console.log(`   • Total bookings: ${totalBookings}`);
    console.log(`   • Confirmed: ${confirmedBookings}`);
    console.log(`   • Completed: ${completedBookings}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

finalVerification();
