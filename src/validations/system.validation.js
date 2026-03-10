const Joi = require('joi');
const { DATA_TYPES, CATEGORIES } = require('../models/SystemSetting');

const upsertSetting = Joi.object({
  body: Joi.object({
    settingKey: Joi.string().required(),
    settingValue: Joi.string().required(),
    dataType: Joi.string().valid(...DATA_TYPES).default('STRING'),
    category: Joi.string().valid(...CATEGORIES).default('GENERAL'),
    description: Joi.string().max(500).allow(''),
    isEditable: Joi.boolean().default(true),
  }),
});

const updateSettingValue = Joi.object({
  params: Joi.object({
    key: Joi.string().required(),
  }),
  body: Joi.object({
    value: Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean()
    ).required(),
  }),
});

const bulkUpdate = Joi.object({
  body: Joi.object({
    settings: Joi.array().items(
      Joi.object({
        key: Joi.string().required(),
        value: Joi.alternatives().try(
          Joi.string(),
          Joi.number(),
          Joi.boolean()
        ).required(),
      })
    ).min(1).required(),
  }),
});

const getSettings = Joi.object({
  query: Joi.object({
    category: Joi.string().valid(...CATEGORIES),
  }),
});

module.exports = {
  upsertSetting,
  updateSettingValue,
  bulkUpdate,
  getSettings,
};
