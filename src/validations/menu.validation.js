const Joi = require("joi");
const { MEAL_TYPES } = require("../models/Menu");
const {
  CATEGORIES,
  ECO_SCORES,
  PORTION_SIZES,
  DIETARY_TYPES,
} = require("../models/MenuItem");
const { objectId } = require("./common");

// Menu validations
const createMenu = Joi.object({
  body: Joi.object({
    menuDate: Joi.date().required(),
    mealType: Joi.string()
      .valid(...MEAL_TYPES)
      .required(),
    isActive: Joi.boolean().default(true),
    items: Joi.array().items(objectId),
  }),
});

const updateMenu = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    menuDate: Joi.date(),
    mealType: Joi.string().valid(...MEAL_TYPES),
    isActive: Joi.boolean(),
    items: Joi.array().items(objectId),
  }).min(1),
});

const getMenus = Joi.object({
  query: Joi.object({
    date: Joi.date(),
    mealType: Joi.string().valid(...MEAL_TYPES),
    isActive: Joi.boolean(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
});

// Menu Item validations
const nutritionalInfo = Joi.object({
  calories: Joi.number().min(0).default(0),
  protein: Joi.number().min(0).default(0),
  carbs: Joi.number().min(0).default(0),
  fat: Joi.number().min(0).default(0),
});

const createMenuItem = Joi.object({
  body: Joi.object({
    itemName: Joi.string().max(100).required(),
    description: Joi.string().max(500).allow(""),
    price: Joi.number().min(0).required(),
    availableQuantity: Joi.number().integer().min(0).default(100),
    isVeg: Joi.boolean().default(true),
    category: Joi.string()
      .valid(...CATEGORIES)
      .default("LUNCH"),
    dietaryType: Joi.string()
      .valid(...DIETARY_TYPES)
      .default("Veg"),
    canteens: Joi.array().items(objectId).default([]),
    allergens: Joi.array().items(Joi.string()),
    ecoScore: Joi.string()
      .valid(...ECO_SCORES)
      .default("C"),
    portionSize: Joi.string()
      .valid(...PORTION_SIZES)
      .default("Regular"),
    nutritionalInfo: nutritionalInfo,
    isAvailable: Joi.boolean().default(true),
    imageUrl: Joi.string().uri().allow(null, ""),
    menuId: objectId,
  }),
});

const updateMenuItem = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    itemName: Joi.string().max(100),
    description: Joi.string().max(500).allow(""),
    price: Joi.number().min(0),
    availableQuantity: Joi.number().integer().min(0),
    isVeg: Joi.boolean(),
    category: Joi.string().valid(...CATEGORIES),
    dietaryType: Joi.string().valid(...DIETARY_TYPES),
    canteens: Joi.array().items(objectId),
    allergens: Joi.array().items(Joi.string()),
    ecoScore: Joi.string().valid(...ECO_SCORES),
    portionSize: Joi.string().valid(...PORTION_SIZES),
    nutritionalInfo: nutritionalInfo,
    isAvailable: Joi.boolean(),
    imageUrl: Joi.string().uri().allow(null, ""),
    menuId: objectId,
  }).min(1),
});

const updateMenuItemQuantity = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    availableQuantity: Joi.number().integer().min(0).required(),
  }),
});

module.exports = {
  createMenu,
  updateMenu,
  getMenus,
  createMenuItem,
  updateMenuItem,
  updateMenuItemQuantity,
};
