const { GoogleGenerativeAI } = require("@google/generative-ai");
const ApiError = require("../utils/ApiError");
const config = require("../config");

const sanitizeName = (value = "") => value.toString().trim();

const normalizeNutrient = (item) => ({
  itemName: sanitizeName(item?.itemName || item?.name || "Unknown Item"),
  calories: Number(item?.calories) || 0,
  proteinGrams: Number(item?.proteinGrams) || 0,
  carbsGrams: Number(item?.carbsGrams) || 0,
  fatGrams: Number(item?.fatGrams) || 0,
  fiberGrams: Number(item?.fiberGrams) || 0,
  sugarGrams: Number(item?.sugarGrams) || 0,
});

const parseNutritionContent = (content) => {
  try {
    const parsed = JSON.parse(content);
    const list = Array.isArray(parsed?.items)
      ? parsed.items
      : Array.isArray(parsed)
        ? parsed
        : [];

    return list.map(normalizeNutrient);
  } catch {
    return [];
  }
};

const NUTRIENT_PROFILES = [
  {
    keywords: ["salad", "sprout", "vegetable", "veggie", "cucumber"],
    values: {
      calories: 120,
      proteinGrams: 4,
      carbsGrams: 14,
      fatGrams: 5,
      fiberGrams: 4,
      sugarGrams: 4,
    },
  },
  {
    keywords: ["idli", "dosa", "upma", "poha", "pongal"],
    values: {
      calories: 220,
      proteinGrams: 6,
      carbsGrams: 34,
      fatGrams: 6,
      fiberGrams: 3,
      sugarGrams: 3,
    },
  },
  {
    keywords: ["rice", "biryani", "fried rice", "pulao", "noodle"],
    values: {
      calories: 380,
      proteinGrams: 10,
      carbsGrams: 56,
      fatGrams: 13,
      fiberGrams: 4,
      sugarGrams: 4,
    },
  },
  {
    keywords: ["chapati", "roti", "paratha", "naan", "bread"],
    values: {
      calories: 260,
      proteinGrams: 7,
      carbsGrams: 36,
      fatGrams: 9,
      fiberGrams: 4,
      sugarGrams: 3,
    },
  },
  {
    keywords: ["paneer", "chicken", "fish", "egg", "kebab", "curry"],
    values: {
      calories: 320,
      proteinGrams: 22,
      carbsGrams: 12,
      fatGrams: 18,
      fiberGrams: 2,
      sugarGrams: 3,
    },
  },
  {
    keywords: ["dal", "rajma", "chole", "sambar", "lentil"],
    values: {
      calories: 240,
      proteinGrams: 12,
      carbsGrams: 30,
      fatGrams: 7,
      fiberGrams: 8,
      sugarGrams: 4,
    },
  },
  {
    keywords: ["juice", "shake", "lassi", "milk", "tea", "coffee"],
    values: {
      calories: 170,
      proteinGrams: 5,
      carbsGrams: 22,
      fatGrams: 6,
      fiberGrams: 1,
      sugarGrams: 14,
    },
  },
  {
    keywords: ["cake", "sweet", "halwa", "dessert", "ice cream"],
    values: {
      calories: 310,
      proteinGrams: 4,
      carbsGrams: 42,
      fatGrams: 14,
      fiberGrams: 2,
      sugarGrams: 26,
    },
  },
];

const DEFAULT_NUTRIENTS = {
  calories: 260,
  proteinGrams: 8,
  carbsGrams: 34,
  fatGrams: 10,
  fiberGrams: 3,
  sugarGrams: 5,
};

const clampToNumber = (value) => Math.max(0, Math.round(Number(value) || 0));

const getPortionMultiplier = (name) => {
  const n = name.toLowerCase();
  if (n.includes("large") || n.includes("combo") || n.includes("double")) {
    return 1.3;
  }
  if (n.includes("mini") || n.includes("small") || n.includes("half")) {
    return 0.75;
  }
  return 1;
};

const pickProfileValues = (itemName) => {
  const lowered = itemName.toLowerCase();
  const found = NUTRIENT_PROFILES.find((profile) =>
    profile.keywords.some((keyword) => lowered.includes(keyword)),
  );
  return found?.values || DEFAULT_NUTRIENTS;
};

const getHealthScore = (item) => {
  const calories = Number(item?.calories) || 0;
  const protein = Number(item?.proteinGrams) || 0;
  const fiber = Number(item?.fiberGrams) || 0;
  const sugar = Number(item?.sugarGrams) || 0;
  const fat = Number(item?.fatGrams) || 0;

  return (
    protein * 2.2 + fiber * 1.5 - sugar * 1.2 - fat * 0.4 - calories * 0.02
  );
};

const getBestItemAmong = (items = []) => {
  if (!Array.isArray(items) || items.length < 2) {
    return null;
  }

  let best = items[0];
  let bestScore = getHealthScore(items[0]);

  for (let index = 1; index < items.length; index += 1) {
    const candidate = items[index];
    const score = getHealthScore(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return {
    itemName: best.itemName,
    reason:
      "Best balance of higher protein/fiber with lower sugar, fat, and calories.",
  };
};

const buildFallbackNutrition = (itemNames, reason) => {
  const items = itemNames.map((name) => {
    const base = pickProfileValues(name);
    const factor = getPortionMultiplier(name);

    return normalizeNutrient({
      itemName: name,
      calories: clampToNumber(base.calories * factor),
      proteinGrams: clampToNumber(base.proteinGrams * factor),
      carbsGrams: clampToNumber(base.carbsGrams * factor),
      fatGrams: clampToNumber(base.fatGrams * factor),
      fiberGrams: clampToNumber(base.fiberGrams * factor),
      sugarGrams: clampToNumber(base.sugarGrams * factor),
    });
  });

  return {
    items,
    bestItem: getBestItemAmong(items),
    model: "local-fallback-v1",
    fallback: true,
    note: reason,
  };
};

const buildGeminiError = (error) => {
  const message = error?.message || "Gemini request failed";

  if (message.includes("API key not valid")) {
    return ApiError.unauthorized("Gemini API Key is invalid.");
  }

  if (message.includes("quota") || error?.status === 429) {
    return ApiError.tooManyRequests(
      "Gemini quota exceeded. Please try again later.",
    );
  }

  return ApiError.internal(
    `Gemini service is currently unavailable: ${message}`,
  );
};

const getNutritionForItems = async (itemNames = []) => {
  const cleanedNames = itemNames.map(sanitizeName).filter(Boolean).slice(0, 20);

  if (cleanedNames.length === 0) {
    throw ApiError.badRequest("Please select at least one food item.");
  }

  if (!config.gemini.apiKey) {
    console.log(
      "Gemini API key not configured, using local nutrition estimates",
    );
    return buildFallbackNutrition(
      cleanedNames,
      "AI service unavailable. Showing approximate local nutrient estimates.",
    );
  }

  const systemInstruction =
    'You are a nutrition assistant. Return only valid JSON with this exact shape: {"items":[{"itemName":string,"calories":number,"proteinGrams":number,"carbsGrams":number,"fatGrams":number,"fiberGrams":number,"sugarGrams":number}]}. Provide practical per-serving estimates.';

  const prompt = `Provide nutrient estimates for these foods: ${cleanedNames.join(", ")}. Use one object per food item and keep numbers realistic for one serving.`;

  try {
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const nutrients = parseNutritionContent(responseText);

    if (nutrients.length === 0) {
      return buildFallbackNutrition(
        cleanedNames,
        "Gemini response format was unexpected. Showing approximate local nutrient estimates.",
      );
    }

    return {
      items: nutrients,
      bestItem: getBestItemAmong(nutrients),
      model: config.gemini.model,
      fallback: false,
    };
  } catch (error) {
    console.error("Gemini API Error:", error);

    // Fallback if quota exhausted or rate limit
    if (
      error?.message?.toLowerCase().includes("quota") ||
      error?.status === 429
    ) {
      return buildFallbackNutrition(
        cleanedNames,
        "Gemini API quota exhausted. Showing approximate local nutrient estimates.",
      );
    }

    throw buildGeminiError(error);
  }
};

module.exports = {
  getNutritionForItems,
};
