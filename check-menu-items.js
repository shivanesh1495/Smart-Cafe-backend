const mongoose = require("mongoose");
const MenuItem = require("./src/models/MenuItem");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-cafe";

const checkMenuItems = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Get ALL menu items with details
    const items = await MenuItem.find({})
      .select("itemName availableQuantity isAvailable category price")
      .sort({ itemName: 1 });

    console.log(`📋 ALL MENU ITEMS IN DATABASE (${items.length} total):\n`);

    for (const item of items) {
      const status = item.isAvailable ? "✓ Available" : "✗ Out of Stock";
      console.log(`${status} | ${item.itemName}`);
      console.log(
        `     Qty: ${item.availableQuantity ?? "NULL"}, Category: ${item.category}`,
      );
      console.log(`     Price: $${item.price}, Available: ${item.isAvailable}`);
      console.log("");
    }

    // Check for items with 0 quantity
    const zeroQty = await MenuItem.countDocuments({ availableQuantity: 0 });
    const nullQty = await MenuItem.countDocuments({
      $or: [
        { availableQuantity: null },
        { availableQuantity: { $exists: false } },
      ],
    });
    const unavailable = await MenuItem.countDocuments({ isAvailable: false });

    console.log("📊 SUMMARY:");
    console.log(`   • Items with 0 quantity: ${zeroQty}`);
    console.log(`   • Items with null quantity: ${nullQty}`);
    console.log(`   • Items marked unavailable: ${unavailable}`);

    // Look for "Chicken" items specifically
    const chickenItems = await MenuItem.find({
      itemName: { $regex: /chicken/i },
    }).select("itemName availableQuantity isAvailable");

    if (chickenItems.length > 0) {
      console.log("\n🔍 CHICKEN ITEMS FOUND:");
      for (const item of chickenItems) {
        console.log(
          `   • ${item.itemName}: Qty=${item.availableQuantity}, Available=${item.isAvailable}`,
        );
      }
    } else {
      console.log("\n⚠️  No items with 'Chicken' in name found");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

checkMenuItems();
