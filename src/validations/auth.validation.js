const Joi = require("joi");

const register = Joi.object({
  body: Joi.object({
    fullName: Joi.string().min(2).max(100).required().messages({
      "string.min": "Name must be at least 2 characters",
      "string.max": "Name cannot exceed 100 characters",
      "any.required": "Full name is required",
    }),
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email",
      "any.required": "Email is required",
    }),
    password: Joi.string().min(6).max(128).required().messages({
      "string.min": "Password must be at least 6 characters",
      "any.required": "Password is required",
    }),
    role: Joi.string().valid("user", "canteen_staff").default("user").messages({
      "any.only":
        "Invalid role. Self-registration is only available for users and canteen staff.",
    }),
  }),
});

const login = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email",
      "any.required": "Email is required",
    }),
    password: Joi.string().required().messages({
      "any.required": "Password is required",
    }),
  }),
});

const sendOtp = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email",
      "any.required": "Email is required",
    }),
  }),
});

const verifyOtp = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email",
      "any.required": "Email is required",
    }),
    otp: Joi.string().length(6).required().messages({
      "string.length": "OTP must be 6 digits",
      "any.required": "OTP is required",
    }),
  }),
});

const resetPassword = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email",
      "any.required": "Email is required",
    }),
    otp: Joi.string().length(6).required().messages({
      "string.length": "OTP must be 6 digits",
      "any.required": "OTP is required",
    }),
    password: Joi.string().min(6).max(128).required().messages({
      "string.min": "Password must be at least 6 characters",
      "any.required": "New password is required",
    }),
  }),
});

module.exports = {
  register,
  login,
  sendOtp,
  verifyOtp,
  resetPassword,
};
