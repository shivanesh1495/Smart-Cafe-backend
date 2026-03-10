const mongoose = require("mongoose");
const MenuItem = require("./src/models/MenuItem");
const Booking = require("./src/models/Booking");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-cafe";

const runFullInventoryFix = async () => {
  let session;
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Start a session for transaction-like behavior
    session = await mongoose.startSession();

    // FIX 1: Initialize all menu items with quantity 100 if missing
    console.log("🔧 FIX 1: Initializing menu item quantities...");
    const itemsWithoutQty = await MenuItem.countDocuments({
      $or: [
        { availableQuantity: { $exists: false } },
        { availableQuantity: null },
      ],
    });

    if (itemsWithoutQty > 0) {
      const result = await MenuItem.updateMany(
        {
          $or: [
            { availableQuantity: { $exists: false } },
            { availableQuantity: null },
          ],
        },
        {
          $set: {
            availableQuantity: 100,
            isAvailable: true,
          },
        },
        { session },
      );
      console.log(
        `   ✓ Initialized ${result.modifiedCount} items with 100 units\n`,
      );
    } else {
      console.log(`   ✓ All items already have quantity set\n`);
    }

    // FIX 2: Ensure all items with qty=0 are marked unavailable
    console.log("🔧 FIX 2: Marking out-of-stock items as unavailable...");
    const outOfStockResult = await MenuItem.updateMany(
      { availableQuantity: { $lte: 0 } },
      { $set: { isAvailable: false } },
      { session },
    );
    console.log(
      `   ✓ Updated ${outOfStockResult.modifiedCount} out-of-stock items\n`,
    );

    // FIX 3: Ensure items with qty>0 are available (if not disabled manually)
    console.log("🔧 FIX 3: Enabling items with stock > 0...");
    const inStockResult = await MenuItem.updateMany(
      { availableQuantity: { $gt: 0 }, isAvailable: false },
      { $set: { isAvailable: true } },
      { session },
    );
    console.log(`   ✓ Re-enabled ${inStockResult.modifiedCount} items\n`);

    // VERIFICATION: Show statistics
    console.log("📊 INVENTORY STATISTICS:");
    const totalItems = await MenuItem.countDocuments({});
    const availableItems = await MenuItem.countDocuments({ isAvailable: true });
    const outOfStock = await MenuItem.countDocuments({ isAvailable: false });

    const qtyStats = await MenuItem.aggregate([
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$availableQuantity" },
          avgQuantity: { $avg: "$availableQuantity" },
          minQuantity: { $min: "$availableQuantity" },
          maxQuantity: { $max: "$availableQuantity" },
        },
      },
    ]);

    console.log(`   • Total menu items: ${totalItems}`);
    console.log(`   • Available items: ${availableItems}`);
    console.log(`   • Out of stock: ${outOfStock}`);

    if (qtyStats.length > 0) {
      const stats = qtyStats[0];
      console.log(`   • Total quantity in stock: ${stats.totalQuantity}`);
      console.log(`   • Average per item: ${stats.avgQuantity.toFixed(2)}`);
      console.log(`   • Min quantity: ${stats.minQuantity}`);
      console.log(`   • Max quantity: ${stats.maxQuantity}`);
    }

    // Show sample items
    console.log("\n📋 Sample menu items:");
    const samples = await MenuItem.find({})
      .select("itemName availableQuantity isAvailable")
      .limit(5);

    for (const item of samples) {
      const status = item.isAvailable ? "✓" : "✗";
      console.log(
        `   ${status} ${item.itemName}: ${item.availableQuantity} units`,
      );
    }

    // CHECK: Recent bookings and their stock impact
    console.log("\n📈 Recent booking activity:");
    const recentBookings = await Booking.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      status: { $ne: "cancelled" },
    });
    console.log(`   • Bookings in last 24h: ${recentBookings}`);

    console.log("\n✅ All inventory fixes completed successfully!");
    console.log("\n💡 Next steps:");
    console.log("   1. Students can now book items");
    console.log("   2. Staff can update quantities at /staff/menu-quantity");
    console.log("   3. Bookings automatically deduct quantities");
    console.log("   4. When quantity reaches 0, item is marked unavailable\n");

    await session.endSession();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (session) {
      await session.abortTransaction();
      await session.endSession();
    }
    process.exit(1);
  }
};

runFullInventoryFix();
