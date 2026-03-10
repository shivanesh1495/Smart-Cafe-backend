const { GoogleGenerativeAI } = require("@google/generative-ai");
const ApiError = require("../utils/ApiError");
const config = require("../config");
const { Canteen, MenuItem, User } = require("../models");

const chat = async (messages, userId) => {
  const hasGeminiKey = config.gemini && config.gemini.apiKey;

  if (!hasGeminiKey) {
    console.log(
      "Gemini API key not configured, returning fallback chat response",
    );
    return {
      reply:
        "I'm currently unavailable. Please try again later or contact support for assistance.",
      fallback: true,
    };
  }

  // 1. Fetch system context
  const canteens = await Canteen.find({ isActive: true }).select(
    "name status crowd timings",
  );
  const menu = await MenuItem.find({ isAvailable: true }).select(
    "itemName dietaryType price description",
  );
  const user = await User.findById(userId).select("name role");

  const contextStr = `
  Current System Context:
  User Name: ${user ? user.name : "Unknown User"}
  User Role: ${user ? user.role : "student"}
  
  Canteens currently available:
  ${canteens.map((c) => `- ${c.name}: Status is ${c.status}, Crowd is ${c.crowd}, Timings are ${JSON.stringify(c.timings)}`).join("\n")}

  Available Menu Items:
  ${menu.map((m) => `- ${m.itemName} (${m.dietaryType}) - ₹${m.price}`).join("\n")}
  `;

  const systemInstruction = `
  You are 'Smart Cafe AI', a highly intelligent, concise, and friendly assistant for a university campus canteen system.
  You act as BOTH a cafe assistant AND a dietary/nutritional advisor for the students. 

  Rules:
  1. Keep answers VERY SHORT (1-2 sentences) unless asked for a list or detailed diet plan. Mobile app users do not want long paragraphs.
  2. If they ask about canteens, timings, or crowd, refer strictly to the Context.
  3. If they ask for diet plans, nutritional advice, or what to eat for their health goals (e.g., protein diet, keto, weight loss), act as an expert nutritionist. You MUST suggest items from the "Available Menu Items" that fit their diet.
  4. If they ask how to do things (like booking), briefly explain to use the 'Booking' or 'Slots' section of the app.
  5. You are allowed to chat about general diet, fitness, and nutrition.
  6. DO NOT use markdown formatting like **bold** in EVERY sentence. Keep it plain text or very light markdown.

  ${contextStr}
  `;

  try {
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: systemInstruction,
      generationConfig: {
        temperature: 0.3, // keep it mostly factual
      },
    });

    // Format messages for Gemini Chat Session
    // Gemini expects { role: 'user' | 'model', parts: [{ text: string }] }
    let history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "ai" || msg.role === "model" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Gemini requires history to start with a 'user' role
    while (history.length > 0 && history[0].role === "model") {
      history.shift();
    }

    const chatSession = model.startChat({
      history: history,
    });

    const latestMessage = messages[messages.length - 1].content;
    const result = await chatSession.sendMessage(latestMessage);

    return {
      reply: result.response.text(),
    };
  } catch (error) {
    console.error("AI Chat Error:", error);

    // Specific error handling
    if (
      error?.message?.toLowerCase().includes("quota") ||
      error?.status === 429
    ) {
      // This is a Gemini API quota/rate limit error
      console.warn("Gemini API quota exceeded or rate limited");
      return {
        reply:
          "Our AI is at capacity right now due to high demand! Please try again in a few minutes. You can still browse the menu, book slots, and use other app features.",
      };
    }

    if (error?.message?.toLowerCase().includes("rate limit")) {
      return {
        reply:
          "Too many requests! Please wait a moment before sending another message.",
      };
    }

    if (error?.message?.toLowerCase().includes("network")) {
      return {
        reply: "Connection issue! Please check your internet and try again.",
      };
    }

    // Generic fallback
    return {
      reply:
        "Sorry, something went wrong with my systems. Please try again shortly!",
    };
  }
};

module.exports = {
  chat,
};
