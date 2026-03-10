const { GoogleGenerativeAI } = require("@google/generative-ai");
const ApiError = require("../utils/ApiError");
const config = require("../config");
const { StockItem, Canteen } = require("../models");

const getInventoryInsights = async (userId, userRole) => {
  if (!config.gemini.apiKey) {
    throw ApiError.badRequest(
      "Gemini API key is not configured on the server. Please add GEMINI_API_KEY.",
    );
  }

  // Fetch stock items
  let stockQuery = { currentQuantity: { $gt: 0 } };
  
  // If the user is a manager, theoretically we should filter by their canteen. 
  // For now, we will just fetch all globally active stock that is low or perishable to generate insights.
  const stockItems = await StockItem.find(stockQuery)
    .populate('canteen', 'name')
    .limit(50); // limit to avoid massive context payloads

  if (stockItems.length === 0) {
    return []; // No insights needed if no stock
  }

  // Optimize payload for Gemini
  const formatStock = stockItems.map((item) => {
    // Calculate days until expiry if tracking
    let expiryInfo = "Not perishable";
    if (item.expiryDate) {
        const days = Math.ceil((new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
        expiryInfo = days > 0 ? `Expires in ${days} days` : 'EXPIRED';
    }

    return {
        id: item._id || item.id,
        name: item.itemName,
        quantity: `${item.currentQuantity} ${item.unit}`,
        minThreshold: `${item.minimumThreshold} ${item.unit}`,
        status: item.currentQuantity <= item.minimumThreshold ? 'LOW STOCK' : 'OK',
        canteen: item.canteen?.name || 'Global',
        expiryInfo
    };
  });

  const systemInstruction =
    'You are a Smart Cafe Inventory Manager AI. Return ONLY valid JSON as an array of objects: [{"itemId":"stock_item_id_here", "type": "warning" | "discount" | "info", "message":"short 1-sentence description", "suggestedAction":"short action"}]. Provide exactly 3 of the most critical or useful insights based strictly on the provided stock list. Focus on LOW STOCK, EXPIRED, or items expiring soon.';

  const prompt = `
    Current Stock Data:
    ${JSON.stringify(formatStock)}

    Task:
    Analyze the stock data. Look for items that are 'LOW STOCK' or expiring soon. 
    1. If an item is expiring in 1-2 days and has high quantity, suggest a 'discount'.
    2. If an item is LOW STOCK, suggest a 'warning' to restock.
    Provide exactly 3 insights. Do not invent any items not in the list.
  `;

  try {
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2, // keep it highly analytical
      },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let insights = [];
    try {
      insights = JSON.parse(responseText);
      if (!Array.isArray(insights)) {
        insights = [];
      }
    } catch (e) {
      console.error("Failed to parse Gemini insight JSON:", e);
      insights = [];
    }
    
    // Validate
    const validInsights = insights.filter(ins => 
        stockItems.some(item => (item._id || item.id).toString() === ins.itemId)
    ).slice(0, 3);
    
    // Map full names back for the UI
    const finalInsights = validInsights.map(ins => {
        const fullItem = stockItems.find(item => (item._id || item.id).toString() === ins.itemId);
        return {
            itemId: ins.itemId,
            itemName: fullItem.itemName,
            canteenName: fullItem.canteen?.name || 'Global',
            type: ins.type,
            message: ins.message,
            suggestedAction: ins.suggestedAction
        }
    });

    return finalInsights;
  } catch (error) {
    console.error("AI Inventory Error:", error);
    // Silent fallback
    return [];
  }
};

module.exports = {
  getInventoryInsights,
};
