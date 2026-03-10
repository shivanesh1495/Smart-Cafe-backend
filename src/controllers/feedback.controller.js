const { Feedback } = require("../models");
const { aiSentimentService } = require("../services");
const catchAsync = require("../utils/catchAsync");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");

// @desc    Submit feedback with AI analysis
// @route   POST /api/feedback
// @access  Private (User/Student)
const submitFeedback = catchAsync(async (req, res) => {
  const { bookingId, rating, comment } = req.body;

  if (!rating || !comment) {
    throw ApiError.badRequest("Rating and comment are required");
  }

  // Call Gemini for Sentiment Analysis
  const aiAnalysis = await aiSentimentService.analyzeSentiment(comment, rating);

  const feedback = await Feedback.create({
    user: req.user.id,
    booking: bookingId || null,
    rating,
    comment,
    aiSentimentScore: aiAnalysis.sentimentScore,
    aiSentimentTag: aiAnalysis.sentimentTag,
    aiTopics: aiAnalysis.topics,
  });

  ApiResponse.created(res, "Feedback submitted successfully", feedback);
});

// @desc    Get all feedback with filtering
// @route   GET /api/feedback
// @access  Private/Admin/Manager
const getFeedback = catchAsync(async (req, res) => {
  const { sentimentTag, rating, limit = 50 } = req.query;

  const query = {};
  if (sentimentTag) query.aiSentimentTag = sentimentTag;
  if (rating) query.rating = Number(rating);

  const feedbackList = await Feedback.find(query)
    .populate("user", "name email")
    .populate("booking", "tokenNumber items")
    .sort({ createdAt: -1 })
    .limit(Number(limit));

  // Calculate quick stats
  const [total, positiveCount, negativeCount, neutralCount] = await Promise.all(
    [
      Feedback.countDocuments(query),
      Feedback.countDocuments({ ...query, aiSentimentTag: "Positive" }),
      Feedback.countDocuments({ ...query, aiSentimentTag: "Negative" }),
      Feedback.countDocuments({ ...query, aiSentimentTag: "Neutral" }),
    ],
  );

  ApiResponse.ok(res, "Feedback retrieved", {
    stats: { total, positiveCount, negativeCount, neutralCount },
    feedbackList,
  });
});

module.exports = {
  submitFeedback,
  getFeedback,
};
