const Joi = require("joi");
const { SLOT_STATUS } = require("../models/Slot");
const { objectId } = require("./common");

const createSlot = Joi.object({
  body: Joi.object({
    date: Joi.date().required(),
    time: Joi.string().required(),
    capacity: Joi.number().integer().min(1).required(),
    mealType: Joi.string()
      .valid("BREAKFAST", "LUNCH", "DINNER", "SNACKS")
      .default("LUNCH"),
    canteenId: Joi.string().default("default"),
  }),
});

const updateSlot = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    date: Joi.date(),
    time: Joi.string(),
    capacity: Joi.number().integer().min(1),
    status: Joi.string().valid(...SLOT_STATUS),
    mealType: Joi.string().valid("BREAKFAST", "LUNCH", "DINNER", "SNACKS"),
  }).min(1),
});

const updateCapacity = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    capacity: Joi.number().integer().min(1).required(),
  }),
});

const getSlots = Joi.object({
  query: Joi.object({
    date: Joi.date(),
    mealType: Joi.string().valid("BREAKFAST", "LUNCH", "DINNER", "SNACKS"),
    status: Joi.string().valid(...SLOT_STATUS),
    canteenId: Joi.string(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(500).default(20),
  }),
});

module.exports = {
  createSlot,
  updateSlot,
  updateCapacity,
  getSlots,
};
