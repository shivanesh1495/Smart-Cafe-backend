const { GoogleGenerativeAI } = require("@google/generative-ai");
const ApiError = require("../utils/ApiError");
const config = require("../config");
const { Booking, MenuItem } = require("../models");

const getRecommendations = async (userId, currentTimeRange) => {
  // Check if Gemini API key is configured
  const hasGeminiKey = config.gemini && config.gemini.apiKey;

  // 1. Fetch user's recent bookings to understand preferences
  const recentBookings = await Booking.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("items.menuItem");

  let favoriteItems = [];
  if (recentBookings && recentBookings.length > 0) {
    const itemCounts = {};
    recentBookings.forEach((booking) => {
      if (booking.items && Array.isArray(booking.items)) {
        booking.items.forEach((bi) => {
          if (bi.menuItem && bi.menuItem.itemName) {
            itemCounts[bi.menuItem.itemName] =
              (itemCounts[bi.menuItem.itemName] || 0) + bi.quantity;
          }
        });
      }
    });
    // Get top 5 sorted by frequency
    favoriteItems = Object.entries(itemCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name]) => name);
  }

  // 2. Fetch currently available menu items
  const availableItems = await MenuItem.find({ isAvailable: true }).select(
    "itemName description dietaryType price id _id",
  );

  if (availableItems.length === 0) {
    return []; // No items to recommend
  }

  // If no API key, use fallback random selection
  if (!hasGeminiKey) {
    console.log("Gemini API key not configured, using random recommendations");
    const genericReasons = [
      "Popular choice among students",
      "Highly rated by our community",
      "Fresh and delicious today",
      "Chef's special recommendation",
      "Try something new!",
      "Best seller this week",
      "Perfect for your meal time",
      "Nutritious and tasty",
    ];
    const shuffled = [...availableItems].sort(() => 0.5 - Math.random());
    return shuffled
      .slice(0, Math.min(5, availableItems.length))
      .map((item, index) => ({
        item: item,
        reason: genericReasons[index % genericReasons.length],
      }));
  }

  // Optimize token usage by sending only IDs and Names
  const formatAvailableItems = availableItems.map((item) => ({
    id: item._id || item.id,
    name: item.itemName,
    type: item.dietaryType,
  }));

  const systemInstruction =
    'You are a Smart Cafe AI Recommendation Engine. Return ONLY valid JSON as an array of objects: [{"id":"menu_item_id_here","reason":"short compelling reason"}]. Provide exactly 3 diverse recommendations picking only from the provided strict available list.';

  const prompt = `
    Context:
    - Current Time of Day: ${currentTimeRange}
    - User's recent favorite orders: ${favoriteItems.join(", ") || "None yet (new user)"}
    - Available Menu Items: ${JSON.stringify(formatAvailableItems)}

    Task:
    Suggest 3 items from the "Available Menu Items" list that the user would most likely want to order right now. Factor in the time of day, whether they typically prefer veg/non-veg (based on favorites), and provide a short 1-sentence reason why it is recommended. The reason should be enticing and user-facing. Do not invent any items.
  `;

  try {
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.6, // slightly creative but grounded
      },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let recommendations = [];
    try {
      recommendations = JSON.parse(responseText);
      if (!Array.isArray(recommendations)) {
        recommendations = [];
      }
    } catch (e) {
      console.error("Failed to parse Gemini recommendations JSON:", e);
      recommendations = [];
    }

    // Validate that the AI didn't hallucinate IDs
    const validRecommendations = recommendations
      .filter((rec) =>
        availableItems.some(
          (item) => (item._id || item.id).toString() === rec.id,
        ),
      )
      .slice(0, 3);

    // Map full item details back to the recommendations
    const finalRecs = validRecommendations.map((rec) => {
      const fullItem = availableItems.find(
        (item) => (item._id || item.id).toString() === rec.id,
      );
      return {
        item: fullItem,
        reason: rec.reason,
      };
    });

    // Fallback if AI fails or hallucinates everything
    if (finalRecs.length === 0 && availableItems.length >= 3) {
      // Just pick 3 random items as a fallback
      const shuffled = [...availableItems].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, 3).map((item) => ({
        item: item,
        reason: "A popular choice today!",
      }));
    }

    return finalRecs;
  } catch (error) {
    console.error("AI Recommendation Error:", error);
    // Silent fallback to avoid breaking UI
    if (availableItems.length >= 3) {
      const shuffled = [...availableItems].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, 3).map((item) => ({
        item: item,
        reason: "A popular choice today!",
      }));
    }
    return [];
  }
};

const getDietRecommendations = async (dietType) => {
  const hasGeminiKey = config.gemini && config.gemini.apiKey;

  const availableItems = await MenuItem.find({ isAvailable: true }).select(
    "itemName description dietaryType price allergens id _id",
  );

  if (availableItems.length === 0) {
    return {
      recommendations: [],
      summary: "No menu items are currently available.",
    };
  }

  // If no API key, use fallback random selection
  if (!hasGeminiKey) {
    console.log(
      "Gemini API key not configured, using random diet recommendations",
    );
    const shuffled = [...availableItems].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(5, availableItems.length));

    return {
      recommendations: selected.map((item) => ({
        id: item._id || item.id,
        name: item.itemName,
        reason: `Suitable for ${dietType} diet`,
        calories_est: 300 + Math.floor(Math.random() * 400), // Random estimate 300-700
      })),
      summary: `We've selected some items that may fit your ${dietType} dietary preferences.`,
      fallback: true, // Indicate this is a fallback response
    };
  }

  const formatItems = availableItems.map((item) => ({
    id: item._id || item.id,
    name: item.itemName,
    type: item.dietaryType,
    price: item.price,
    allergens: item.allergens || [],
  }));

  const systemInstruction =
    'You are a Smart Cafe Diet Advisor. Return ONLY valid JSON with this structure: {"recommendations": [{"id": "menu_item_id", "name": "item name", "reason": "why this fits the diet", "calories_est": number}], "summary": "brief diet advice"}. Pick 3-5 best items from the menu that fit the requested diet. Only pick from the provided list.';

  const prompt = `
    Diet Type Requested: ${dietType}
    
    Available Menu Items: ${JSON.stringify(formatItems)}

    Task:
    From the available menu items, recommend 3-5 items that best fit a "${dietType}" diet. For each item, explain briefly why it suits this diet and give a rough calorie estimate. Also provide a short 1-2 sentence summary about this diet choice. Only recommend items from the provided list. Do not invent items.
  `;

  try {
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.5,
      },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let parsed = {};
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse diet recommendations JSON:", e);
      parsed = {
        recommendations: [],
        summary: "Could not generate diet recommendations.",
      };
    }

    // Validate recommended items exist in menu
    if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
      parsed.recommendations = parsed.recommendations.filter((rec) =>
        availableItems.some(
          (item) =>
            (item._id || item.id).toString() === rec.id ||
            item.itemName === rec.name,
        ),
      );
    }

    return parsed;
  } catch (error) {
    console.error("AI Diet Recommendation Error:", error);
    // Fallback based on diet type
    let filtered = availableItems;
    if (dietType.toLowerCase().includes("veg")) {
      filtered = availableItems.filter(
        (i) => i.dietaryType === "Veg" || i.dietaryType === "Vegan",
      );
    } else if (dietType.toLowerCase().includes("vegan")) {
      filtered = availableItems.filter((i) => i.dietaryType === "Vegan");
    }
    const picks = filtered.slice(0, 4);
    return {
      recommendations: picks.map((item) => ({
        id: (item._id || item.id).toString(),
        name: item.itemName,
        reason: `Fits a ${dietType} diet.`,
        calories_est: 200,
      })),
      summary: `Here are some ${dietType} options from the menu.`,
      fallback: true,
    };
  }
};

module.exports = {
  getRecommendations,
  getDietRecommendations,
};
