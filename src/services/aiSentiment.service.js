const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../utils/logger");

// Setup Gemini API
const apiKey = process.env.GEMINI_API_KEY;

let genAI = null;
let model = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

/**
 * Sends feedback text to Gemini to analyze sentiment and extract key topics.
 * @param {string} comment - The feedback comment from the user.
 * @param {number} rating - The user's provided star rating (1-5).
 * @returns {Promise<Object>} An object containing sentimentScore, sentimentTag, and topics.
 */
exports.analyzeSentiment = async (comment, rating) => {
  if (!model) {
    logger.warn("GEMINI_API_KEY not found. Skipping sentiment analysis.");
    return {
      sentimentScore: 0,
      sentimentTag:
        rating >= 4 ? "Positive" : rating <= 2 ? "Negative" : "Neutral",
      topics: [],
    };
  }

  try {
    const prompt = `
You are a sentiment analysis and topic extraction tool for a university cafeteria.
Analyze the following user feedback.

Rating: ${rating} out of 5 stars
Comment: "${comment}"

Your task is to determine:
1. "sentimentScore": A float between -1.0 (very negative) and 1.0 (very positive).
2. "sentimentTag": Exactly one of "Positive", "Neutral", or "Negative".
3. "topics": An array of short strings (1-3 words) representing the main subjects mentioned (e.g., "Wait Time", "Food Quality", "Staff", "Cleanliness", "Price").

Respond strictly in valid JSON format ONLY, perfectly parseable by JSON.parse(), with no markdown formatting around it.
Example format:
{
  "sentimentScore": 0.8,
  "sentimentTag": "Positive",
  "topics": ["Food Quality", "Price"]
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean potential markdown blocks
    const cleanedText = text.replace(/```json\n|\n```|```/g, "").trim();

    const parsedData = JSON.parse(cleanedText);

    // Validate output
    if (
      !["Positive", "Neutral", "Negative"].includes(parsedData.sentimentTag)
    ) {
      parsedData.sentimentTag = "Neutral";
    }

    return {
      sentimentScore:
        typeof parsedData.sentimentScore === "number"
          ? parsedData.sentimentScore
          : 0,
      sentimentTag: parsedData.sentimentTag,
      topics: Array.isArray(parsedData.topics) ? parsedData.topics : [],
    };
  } catch (error) {
    logger.error("AI Sentiment Analysis Error:", error);
    // Fallback logic in case of API failure
    return {
      sentimentScore: 0,
      sentimentTag:
        rating >= 4 ? "Positive" : rating <= 2 ? "Negative" : "Neutral",
      topics: [],
    };
  }
};
