const Joi = require("joi");
const { ROLES } = require("../models/User");
const { objectId } = require("./common");

const createUser = Joi.object({
  body: Joi.object({
    fullName: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(128).required(),
    role: Joi.string()
      .valid(...ROLES)
      .default("user"),
    status: Joi.string().valid("active", "suspended").default("active"),
  }),
});

const updateUser = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    fullName: Joi.string().min(2).max(100),
    email: Joi.string().email(),
    role: Joi.string().valid(...ROLES),
    status: Joi.string().valid("active", "suspended"),
    avatar: Joi.string().uri().allow(null, ""),
  }).min(1),
});

const updateRole = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    role: Joi.string()
      .valid(...ROLES)
      .required(),
  }),
});

const updateStatus = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    status: Joi.string().valid("active", "suspended").required(),
  }),
});

const getUsers = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    role: Joi.string().valid(...ROLES, "all"),
    status: Joi.string().valid("active", "suspended", "all"),
    search: Joi.string().max(100),
    sortBy: Joi.string().valid("createdAt", "fullName", "email"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  }),
});

const getUserById = Joi.object({
  params: Joi.object({
    id: objectId.required(),
  }),
});

module.exports = {
  createUser,
  updateUser,
  updateRole,
  updateStatus,
  getUsers,
  getUserById,
};
