/**
 * Seed script to import menu items from college_canteen_dataset.csv
 * Creates: Canteens, MenuItems, and Menus
 *
 * Usage: node seed_from_csv.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const config = require("./src/config");
const Canteen = require("./src/models/Canteen");
const MenuItem = require("./src/models/MenuItem");
const Menu = require("./src/models/Menu");

// --- CSV Parsing ---
function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const headers = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // Handle commas inside quoted fields
    const vals = [];
    let current = "";
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        vals.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    vals.push(current.trim());

    if (vals.length >= headers.length) {
      const row = {};
      headers.forEach((h, idx) => (row[h.trim()] = vals[idx]));
      rows.push(row);
    }
  }
  return rows;
}

// --- Category Mapping (CSV → Backend enum) ---
function mapCategory(csvCategory) {
  const map = {
    Breakfast: "BREAKFAST",
    Lunch: "LUNCH",
    Dinner: "DINNER",
    Snack: "SNACKS",
    "Evening Snack": "SNACKS",
    "Chocolates & Confectionery": "SNACKS",
    "Ice Cream & Desserts": "SNACKS",
    Beverages: "BEVERAGES",
  };
  return map[csvCategory] || "SNACKS";
}

// --- Meal type for Menu grouping ---
function mapMealType(csvCategory) {
  const map = {
    Breakfast: "BREAKFAST",
    Lunch: "LUNCH",
    Dinner: "DINNER",
    Snack: "SNACKS",
    "Evening Snack": "SNACKS",
    "Chocolates & Confectionery": "SNACKS",
    "Ice Cream & Desserts": "SNACKS",
    Beverages: "SNACKS",
  };
  return map[csvCategory] || "SNACKS";
}

// --- Dietary type from CSV ---
function mapDietaryType(isVeg, itemName) {
  if (isVeg === "Yes") return "Veg";
  // Check if it's an egg-based item
  const lowerName = itemName.toLowerCase();
  if (lowerName.includes("egg") || lowerName.includes("omelette")) return "Egg";
  return "Non-Veg";
}

// --- Generate a description ---
function generateDescription(itemName, category, isVeg, price) {
  const vegLabel = isVeg === "Yes" ? "Vegetarian" : "Non-vegetarian";
  return `${vegLabel} ${category.toLowerCase()} item. ${itemName} served fresh daily.`;
}

// --- Generate nutritional info (estimated) ---
function generateNutritionalInfo(category, price, isVeg) {
  const base = {
    Breakfast: { calories: 250, protein: 8, carbs: 35, fat: 8 },
    Lunch: { calories: 450, protein: 15, carbs: 55, fat: 12 },
    Dinner: { calories: 400, protein: 14, carbs: 50, fat: 11 },
    Snack: { calories: 200, protein: 5, carbs: 25, fat: 10 },
    "Evening Snack": { calories: 220, protein: 6, carbs: 28, fat: 11 },
    "Chocolates & Confectionery": {
      calories: 180,
      protein: 2,
      carbs: 28,
      fat: 9,
    },
    "Ice Cream & Desserts": { calories: 220, protein: 4, carbs: 32, fat: 10 },
    Beverages: { calories: 120, protein: 3, carbs: 20, fat: 2 },
  };

  const b = base[category] || base["Snack"];
  // Add some variance based on price
  const factor = Math.max(0.7, Math.min(1.5, price / 50));
  return {
    calories: Math.round(b.calories * factor),
    protein: Math.round(b.protein * factor),
    carbs: Math.round(b.carbs * factor),
    fat: Math.round(b.fat * factor),
  };
}

// --- Canteen config ---
const CANTEEN_CONFIG = {
  "IT Canteen": {
    location: "IT Block, Ground Floor",
    capacity: 80,
    description:
      "Canteen serving the IT department with a variety of South Indian and North Indian dishes.",
    imageColor: "bg-blue-100",
  },
  "MBA Canteen": {
    location: "MBA Block, First Floor",
    capacity: 60,
    description:
      "Canteen located in the MBA block offering breakfast, lunch, snacks and desserts.",
    imageColor: "bg-green-100",
  },
  "Main Canteen": {
    location: "Central Campus, Main Building",
    capacity: 150,
    description:
      "The main campus canteen with the largest seating capacity and full menu.",
    imageColor: "bg-orange-100",
  },
};

// --- Main seed function ---
async function seedFromCSV() {
  const csvPath = path.resolve(__dirname, "..", "college_canteen_dataset.csv");

  if (!fs.existsSync(csvPath)) {
    console.error("CSV file not found at:", csvPath);
    process.exit(1);
  }

  console.log("Reading CSV from:", csvPath);
  const rows = parseCSV(csvPath);
  console.log(`Parsed ${rows.length} rows from CSV`);

  // Connect to MongoDB
  await mongoose.connect(config.mongodb.uri);
  console.log("Connected to MongoDB");

  // --- Step 1: Clear existing data ---
  console.log("\nClearing existing MenuItems, Menus, and Canteens...");
  await MenuItem.deleteMany({});
  await Menu.deleteMany({});
  await Canteen.deleteMany({});
  console.log("Cleared.");

  // --- Step 2: Create Canteens ---
  const uniqueCanteens = [...new Set(rows.map((r) => r.canteen_name))];
  console.log(`\nCreating ${uniqueCanteens.length} canteens:`, uniqueCanteens);

  const canteenMap = {}; // name → ObjectId
  for (const name of uniqueCanteens) {
    const cfg = CANTEEN_CONFIG[name] || {
      location: "Campus",
      capacity: 100,
      description: `${name} - campus canteen.`,
      imageColor: "bg-gray-100",
    };

    const canteen = await Canteen.create({
      name,
      location: cfg.location,
      status: "Open",
      crowd: "Low",
      capacity: cfg.capacity,
      occupancy: 0,
      isActive: true,
      imageColor: cfg.imageColor,
      operatingHours: { open: "07:30", close: "20:00" },
      ecoScore: "B",
      description: cfg.description,
    });
    canteenMap[name] = canteen._id;
    console.log(`  ✓ Created canteen: ${name} (${canteen._id})`);
  }

  // --- Step 3: Create MenuItems ---
  console.log(`\nCreating ${rows.length} menu items...`);

  // Group items by canteen and category for menu creation
  // Key: "canteenName|mealType" → [menuItemId]
  const menuGroups = {};
  let created = 0;

  for (const row of rows) {
    const category = mapCategory(row.category);
    const mealType = mapMealType(row.category);
    const price = parseFloat(row.price_inr) || 0;
    const isVeg = row.is_vegetarian === "Yes";
    const dietaryType = mapDietaryType(row.is_vegetarian, row.item_name);
    const isAvailable = row.in_stock === "Yes";
    const nutritionalInfo = generateNutritionalInfo(row.category, price, isVeg);
    const description = generateDescription(
      row.item_name,
      row.category,
      row.is_vegetarian,
      price,
    );

    const menuItem = await MenuItem.create({
      itemName: row.item_name,
      description,
      price,
      isVeg,
      category,
      dietaryType,
      allergens: [],
      ecoScore: "C",
      portionSize: "Regular",
      nutritionalInfo,
      isAvailable,
      canteens: [canteenMap[row.canteen_name]],
    });

    // Group for menu creation
    const groupKey = `${row.canteen_name}|${mealType}`;
    if (!menuGroups[groupKey]) menuGroups[groupKey] = [];
    menuGroups[groupKey].push(menuItem._id);

    created++;
    if (created % 50 === 0)
      console.log(`  ... created ${created}/${rows.length} items`);
  }
  console.log(`  ✓ Created ${created} menu items total`);

  // --- Step 4: Create Menus (one per canteen per meal type for today) ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log(
    `\nCreating menus for ${Object.keys(menuGroups).length} canteen-mealType combos...`,
  );

  // Since Menu schema has unique compound {menuDate, mealType}, and doesn't have a canteen field,
  // we need to create one menu per mealType and put ALL items from ALL canteens into it.
  const mealTypeItems = {};
  for (const [key, itemIds] of Object.entries(menuGroups)) {
    const mealType = key.split("|")[1];
    if (!mealTypeItems[mealType]) mealTypeItems[mealType] = [];
    mealTypeItems[mealType].push(...itemIds);
  }

  for (const [mealType, itemIds] of Object.entries(mealTypeItems)) {
    const menu = await Menu.create({
      menuDate: today,
      mealType,
      isActive: true,
      items: itemIds,
    });

    // Update menu items to reference this menu
    await MenuItem.updateMany(
      { _id: { $in: itemIds } },
      { $set: { menu: menu._id } },
    );

    console.log(
      `  ✓ Created ${mealType} menu with ${itemIds.length} items (${menu._id})`,
    );
  }

  // --- Summary ---
  const canteenCount = await Canteen.countDocuments();
  const menuItemCount = await MenuItem.countDocuments();
  const menuCount = await Menu.countDocuments();

  console.log("\n========== SEED COMPLETE ==========");
  console.log(`  Canteens:   ${canteenCount}`);
  console.log(`  MenuItems:  ${menuItemCount}`);
  console.log(`  Menus:      ${menuCount}`);
  console.log("===================================\n");
}

seedFromCSV()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
