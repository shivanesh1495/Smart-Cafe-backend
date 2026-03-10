const mongoose = require("mongoose");
const MenuItem = require("./src/models/MenuItem");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-cafe";

const fixMenuItemQuantities = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Fix 1: Set all menu items to default quantity 100 if missing or 0
    console.log("🔧 Fixing menu item quantities...");
    const result = await MenuItem.updateMany(
      {
        $or: [
          { availableQuantity: { $exists: false } },
          { availableQuantity: null },
          { availableQuantity: { $eq: 0 } },
          { availableQuantity: { $lt: 0 } },
        ],
      },
      {
        $set: {
          availableQuantity: 100,
          isAvailable: true,
        },
      },
    );

    console.log(`   ✓ Updated ${result.modifiedCount} menu items\n`);

    // Fix 2: List all items with their quantities for verification
    const allItems = await MenuItem.find({})
      .select("itemName availableQuantity isAvailable")
      .limit(10);

    console.log("📋 Sample of menu items after fix:");
    for (const item of allItems) {
      console.log(
        `   • ${item.itemName}: ${item.availableQuantity} units (Available: ${item.isAvailable})`,
      );
    }

    const totalItems = await MenuItem.countDocuments({});
    console.log(`\n📊 Total menu items in database: ${totalItems}`);

    console.log("\n✅ All menu items now have quantity set to 100!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

fixMenuItemQuantities();
