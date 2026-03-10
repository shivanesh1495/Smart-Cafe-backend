const { Menu, MenuItem } = require("../models");
const {
  parsePagination,
  paginateResponse,
  getDayBounds,
} = require("../utils/helpers");
const ApiError = require("../utils/ApiError");

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
};

// ==================== MENU OPERATIONS ====================

/**
 * Get all menus with filters
 */
const getMenus = async (query) => {
  const { page, limit, skip } = parsePagination(query);

  const filter = {};

  if (query.date) {
    const { start, end } = getDayBounds(query.date);
    filter.menuDate = { $gte: start, $lte: end };
  }

  if (query.mealType) {
    filter.mealType = query.mealType;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  const [menus, total] = await Promise.all([
    Menu.find(filter)
      .populate("items")
      .sort({ menuDate: -1, mealType: 1 })
      .skip(skip)
      .limit(limit),
    Menu.countDocuments(filter),
  ]);

  return paginateResponse(menus, total, page, limit);
};

/**
 * Get menu by ID
 */
const getMenuById = async (id) => {
  const menu = await Menu.findById(id).populate("items");

  if (!menu) {
    throw ApiError.notFound("Menu not found");
  }

  return menu;
};

/**
 * Create new menu
 */
const createMenu = async (data, userId) => {
  // Check for duplicate (same date and meal type)
  const { start, end } = getDayBounds(data.menuDate);
  const existing = await Menu.findOne({
    menuDate: { $gte: start, $lte: end },
    mealType: data.mealType,
  });

  if (existing) {
    throw ApiError.conflict(
      `Menu for ${data.mealType} on this date already exists`,
    );
  }

  const menu = await Menu.create({
    ...data,
    createdBy: userId,
  });

  return menu;
};

/**
 * Update menu
 */
const updateMenu = async (id, data) => {
  const menu = await Menu.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate("items");

  if (!menu) {
    throw ApiError.notFound("Menu not found");
  }

  return menu;
};

/**
 * Delete menu
 */
const deleteMenu = async (id) => {
  const menu = await Menu.findByIdAndDelete(id);

  if (!menu) {
    throw ApiError.notFound("Menu not found");
  }

  // Also delete associated menu items
  await MenuItem.deleteMany({ menu: id });

  return menu;
};

// ==================== MENU ITEM OPERATIONS ====================

/**
 * Get all menu items (public)
 */
/**
 * Get all menu items (public)
 */
const getAllMenuItems = async (query = {}) => {
  const filter = {};

  if (query.category) {
    filter.category = query.category;
  }

  if (query.dietaryType) {
    filter.dietaryType = query.dietaryType;
  }

  // Backward compatibility for isVeg filtering if dietaryType is not provided
  if (query.isVeg !== undefined && !query.dietaryType) {
    filter.isVeg = query.isVeg;
  }

  if (query.isAvailable !== undefined) {
    filter.isAvailable = toBoolean(query.isAvailable);
  }

  if (query.onlyOrderable !== undefined && toBoolean(query.onlyOrderable)) {
    filter.isAvailable = true;
    filter.availableQuantity = { $gt: 0 };
  }

  if (query.canteen) {
    filter.canteens = query.canteen;
  }

  // Allergen exclusion filter: ?excludeAllergens=peanuts,dairy
  if (query.excludeAllergens) {
    const allergensToExclude = query.excludeAllergens
      .split(",")
      .map((a) => a.trim().toLowerCase());
    filter.allergens = { $nin: allergensToExclude };
  }

  // Min eco-score filter: ?minEcoScore=3
  if (query.minEcoScore) {
    filter.ecoScore = { $gte: parseFloat(query.minEcoScore) };
  }

  const items = await MenuItem.find(filter)
    .populate("canteens", "name")
    .sort({ category: 1, itemName: 1 });

  return items;
};

/**
 * Get menu item by ID
 */
const getMenuItemById = async (id) => {
  const item = await MenuItem.findById(id).populate("canteens", "name");

  if (!item) {
    throw ApiError.notFound("Menu item not found");
  }

  return item;
};

/**
 * Create menu item
 */
const createMenuItem = async (data) => {
  const payload = {
    ...data,
    availableQuantity:
      data.availableQuantity === undefined
        ? 100
        : Number(data.availableQuantity) || 0,
  };

  if (payload.availableQuantity <= 0 && payload.isAvailable === undefined) {
    payload.isAvailable = false;
  }

  const item = await MenuItem.create(payload);

  // If menuId is provided, add item to menu
  if (data.menuId) {
    await Menu.findByIdAndUpdate(data.menuId, {
      $addToSet: { items: item._id },
    });
    item.menu = data.menuId;
    await item.save();
  }

  await item.populate("canteens", "name");

  return item;
};

/**
 * Update menu item
 */
const updateMenuItem = async (id, data) => {
  const { menuId, ...updateData } = data;

  const item = await MenuItem.findById(id);

  if (!item) {
    throw ApiError.notFound("Menu item not found");
  }

  // Re-associate menu if requested
  if (menuId && item.menu?.toString() !== menuId.toString()) {
    if (item.menu) {
      await Menu.findByIdAndUpdate(item.menu, { $pull: { items: id } });
    }

    await Menu.findByIdAndUpdate(menuId, { $addToSet: { items: id } });
    item.menu = menuId;
  }

  if (updateData.availableQuantity !== undefined) {
    const parsedQuantity = Number(updateData.availableQuantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      throw ApiError.badRequest("Available quantity must be 0 or more");
    }

    updateData.availableQuantity = Math.floor(parsedQuantity);

    if (updateData.availableQuantity <= 0) {
      updateData.isAvailable = false;
    } else if (
      updateData.isAvailable === undefined &&
      item.isAvailable === false
    ) {
      updateData.isAvailable = true;
    }
  }

  Object.assign(item, updateData);
  await item.save();

  await item.populate("canteens", "name");

  return item;
};

/**
 * Delete menu item
 */
const deleteMenuItem = async (id) => {
  const item = await MenuItem.findByIdAndDelete(id);

  if (!item) {
    throw ApiError.notFound("Menu item not found");
  }

  // Remove from menu if associated
  if (item.menu) {
    await Menu.findByIdAndUpdate(item.menu, {
      $pull: { items: id },
    });
  }

  return item;
};

/**
 * Toggle menu item availability
 */
const toggleItemAvailability = async (id) => {
  const item = await MenuItem.findById(id);

  if (!item) {
    throw ApiError.notFound("Menu item not found");
  }

  item.isAvailable = !item.isAvailable;
  await item.save();

  return item;
};

/**
 * Update only menu item quantity (Management/Staff)
 */
const updateMenuItemQuantity = async (id, availableQuantity) => {
  const item = await MenuItem.findById(id);

  if (!item) {
    throw ApiError.notFound("Menu item not found");
  }

  const parsedQuantity = Number(availableQuantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
    throw ApiError.badRequest("Available quantity must be 0 or more");
  }

  item.availableQuantity = Math.floor(parsedQuantity);
  if (item.availableQuantity <= 0) {
    item.isAvailable = false;
  } else if (!item.isAvailable) {
    item.isAvailable = true;
  }

  await item.save();
  await item.populate("canteens", "name");

  return item;
};

module.exports = {
  // Menu
  getMenus,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu,

  // Menu Items
  getAllMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  updateMenuItemQuantity,
  deleteMenuItem,
  toggleItemAvailability,
};
