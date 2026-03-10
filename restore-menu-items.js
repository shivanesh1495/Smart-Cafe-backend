const mongoose = require("mongoose");
const MenuItem = require("./src/models/MenuItem");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart-cafe";

const restoreMenuItems = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Menu items from backup + new ones
    const menuItems = [
      {
        itemName: "Butter Chicken",
        description: "Creamy tomato-based curry with tender chicken",
        price: 150,
        isVeg: false,
        category: "LUNCH",
        dietaryType: "Non-Veg",
        ecoScore: "C",
        portionSize: "Regular",
        availableQuantity: 100,
        isAvailable: true,
      },
      {
        itemName: "Dal Makhani",
        description: "Creamy black lentils slow-cooked overnight",
        price: 80,
        isVeg: true,
        category: "LUNCH",
        dietaryType: "Veg",
        ecoScore: "A",
        portionSize: "Regular",
        availableQuantity: 100,
        isAvailable: true,
      },
      {
        itemName: "Masala Dosa",
        description: "Crispy crepe with spiced potato filling",
        price: 60,
        isVeg: true,
        category: "BREAKFAST",
        dietaryType: "Veg",
        ecoScore: "A",
        portionSize: "Regular",
        availableQuantity: 100,
        isAvailable: true,
      },
      {
        itemName: "Biryani",
        description: "Fragrant rice with vegetables and spices",
        price: 100,
        isVeg: true,
        category: "LUNCH",
        dietaryType: "Veg",
        ecoScore: "B",
        portionSize: "Large",
        availableQuantity: 100,
        isAvailable: true,
      },
      {
        itemName: "Paneer Tikka",
        description: "Grilled cottage cheese with spices",
        price: 120,
        isVeg: true,
        category: "LUNCH",
        dietaryType: "Veg",
        ecoScore: "B",
        portionSize: "Regular",
        availableQuantity: 100,
        isAvailable: true,
      },
      {
        itemName: "Chicken Fried Rice",
        description: "Stir-fried rice with tender chicken pieces",
        price: 140,
        isVeg: false,
        category: "LUNCH",
        dietaryType: "Non-Veg",
        ecoScore: "C",
        portionSize: "Regular",
        availableQuantity: 100,
        isAvailable: true,
      },
      {
        itemName: "Veggie Fried Rice",
        description: "Stir-fried rice with mixed vegetables",
        price: 90,
        isVeg: true,
        category: "LUNCH",
        dietaryType: "Veg",
        ecoScore: "A",
        portionSize: "Regular",
        availableQuantity: 100,
        isAvailable: true,
      },
      {
        itemName: "Curd Rice",
        description: "Light and cooling yogurt rice dish",
        price: 70,
        isVeg: true,
        category: "LUNCH",
        dietaryType: "Veg",
        ecoScore: "A",
        portionSize: "Regular",
        availableQuantity: 100,
        isAvailable: true,
      },
      {
        itemName: "Sambar Rice",
        description: "Rice with tangy lentil vegetable curry",
        price: 80,
        isVeg: true,
        category: "LUNCH",
        dietaryType: "Veg",
        ecoScore: "B",
        portionSize: "Regular",
        availableQuantity: 100,
        isAvailable: true,
      },
      {
        itemName: "Roti",
        description: "Plain wheat bread, soft and warm",
        price: 10,
        isVeg: true,
        category: "LUNCH",
        dietaryType: "Veg",
        ecoScore: "A",
        portionSize: "Small",
        availableQuantity: 100,
        isAvailable: true,
      },
    ];

    // Clear existing items
    console.log("🗑️  Clearing existing menu items...");
    await MenuItem.deleteMany({});
    console.log("   ✓ Cleared\n");

    // Insert new items
    console.log("📝 Restoring menu items from backup + adding new items...");
    const inserted = await MenuItem.insertMany(menuItems);
    console.log(`   ✓ Inserted ${inserted.length} items\n`);

    // Verify
    console.log("✅ MENU ITEMS RESTORED:\n");
    for (const item of inserted) {
      console.log(`✓ ${item.itemName}`);
      console.log(
        `  - Price: $${item.price}, Qty: ${item.availableQuantity}, Category: ${item.category}`,
      );
    }

    console.log(`\n✨ Total items: ${inserted.length}`);
    console.log("\n💡 Key items added:");
    console.log("  • Chicken Fried Rice (was missing)");
    console.log("  • Veggie Fried Rice (added)");
    console.log("  • Curd Rice (added)");
    console.log("  • Sambar Rice (added)");
    console.log("  • Roti (added)");
    console.log("\nAll items have 100 units and are marked available ✓");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

restoreMenuItems();
