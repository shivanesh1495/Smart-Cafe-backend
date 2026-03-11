const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");
const {
  aiNutritionService,
  aiRecommendationService,
  aiChatService,
} = require("../services");
const { checkRateLimit } = require("../utils/rateLimiter");
const logger = require("../utils/logger");

const getNutrition = catchAsync(async (req, res) => {
  const userId = req.user?._id;
  const { itemNames } = req.body || {};

  // Check rate limit only when user is authenticated
  if (userId) {
    const rateLimitCheck = checkRateLimit(userId.toString(), "nutrition");
    if (!rateLimitCheck.allowed) {
      return ApiResponse.tooManyRequests(
        res,
        `You're analyzing nutrition too frequently! Please wait ${rateLimitCheck.retryAfterSeconds} seconds.`,
        { retryAfterSeconds: rateLimitCheck.retryAfterSeconds },
      );
    }
  }

  const result = await aiNutritionService.getNutritionForItems(itemNames || []);
  ApiResponse.ok(res, "Nutrition values fetched", result);
});

const getRecommendations = catchAsync(async (req, res) => {
  const userId = req.user._id;

  // Check rate limit (less strict for recommendations)
  const rateLimitCheck = checkRateLimit(userId.toString(), "recommendations");
  if (!rateLimitCheck.allowed) {
    return ApiResponse.tooManyRequests(
      res,
      `You've refreshed recommendations too often! Please wait ${rateLimitCheck.retryAfterSeconds} seconds.`,
      { retryAfterSeconds: rateLimitCheck.retryAfterSeconds },
    );
  }

  const hour = new Date().getHours();

  let timeRange = "Snack Time";
  if (hour >= 6 && hour < 11) timeRange = "Breakfast / Morning";
  else if (hour >= 11 && hour < 15) timeRange = "Lunch";
  else if (hour >= 15 && hour < 18) timeRange = "Evening Snack";
  else if (hour >= 18 && hour < 22) timeRange = "Dinner";
  else if (hour >= 22 || hour < 6) timeRange = "Late Night";

  const result = await aiRecommendationService.getRecommendations(
    userId,
    timeRange,
  );
  ApiResponse.ok(res, "Recommendations fetched", result);
});

const chat = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return ApiResponse.badRequest(res, "Messages array is required");
  }

  // Check rate limit
  const rateLimitCheck = checkRateLimit(userId.toString(), "chat");
  if (!rateLimitCheck.allowed) {
    logger.warn(
      `Chat rate limited for user ${userId.toString()}: ${rateLimitCheck.retryAfterSeconds}s wait`,
    );
    return ApiResponse.tooManyRequests(
      res,
      `You're sending messages too fast! Please wait ${rateLimitCheck.retryAfterSeconds} seconds.`,
      {
        retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
        resetTime: rateLimitCheck.resetTime,
      },
    );
  }

  const result = await aiChatService.chat(messages, userId);
  ApiResponse.ok(res, "Chat response fetched", result);
});

const getDietRecommendations = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { dietType } = req.body;

  if (!dietType) {
    return ApiResponse.badRequest(res, "Diet type is required");
  }

  const rateLimitCheck = checkRateLimit(userId.toString(), "dietCheck");
  if (!rateLimitCheck.allowed) {
    return ApiResponse.tooManyRequests(
      res,
      `Too many diet checks! Please wait ${rateLimitCheck.retryAfterSeconds} seconds.`,
      { retryAfterSeconds: rateLimitCheck.retryAfterSeconds },
    );
  }

  const result = await aiRecommendationService.getDietRecommendations(dietType);
  ApiResponse.ok(res, "Diet recommendations fetched", result);
});

module.exports = {
  getNutrition,
  getRecommendations,
  chat,
  getDietRecommendations,
};
