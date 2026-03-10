const { GoogleGenerativeAI } = require("@google/generative-ai");
const ApiError = require("../utils/ApiError");
const config = require("../config");
const { Canteen, Booking } = require("../models");

const predictWaitTime = async (canteenId, currentQueueLengthStr) => {
  if (!config.gemini.apiKey) {
    throw ApiError.badRequest(
      "Gemini API key is not configured on the server. Please add GEMINI_API_KEY.",
    );
  }

  const currentQueueLength = parseInt(currentQueueLengthStr, 10) || 0;

  // 1. Fetch Canteen data
  const canteen = await Canteen.findById(canteenId);
  if (!canteen) {
    throw ApiError.notFound("Canteen not found");
  }

  // 2. Fetch active pending orders for this canteen
  // We look for 'confirmed' bookings (meaning paid but not yet completed) that belong to items from this canteen
  // Since our basic Booking model doesn't directly link to Canteen, we'll estimate based on the input queue length
  // combined with the canteen's crowd status.
  
  const systemInstruction =
    "You are a Smart Cafe Queue Predictor AI. You must return ONLY a single integer representing the estimated wait time in minutes. No text, no explanation.";

  const prompt = `
    Calculate the estimated wait time for a student at this canteen:
    Canteen Name: ${canteen.name}
    Current Crowd Level: ${canteen.crowd}
    Current Capacity: ${canteen.capacity}
    Current Occupancy: ${canteen.occupancy}
    People currently in queue / pending orders: ${currentQueueLength}

    Rules for estimation:
    - Base time per order is ~2 minutes.
    - If crowd level is 'Medium', add 20% to the total time.
    - If crowd level is 'High', add 50% to the total time.
    - If occupancy is near or over capacity, add an extra 5 minutes due to seating constraints.
    - Return ONLY the final integer.
  `;

  try {
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({
      model: config.gemini.model,
      systemInstruction: systemInstruction,
      generationConfig: {
        temperature: 0.1, // Highly deterministic constraints
      },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    
    // Parse the integer
    let waitTime = parseInt(responseText, 10);
    
    if (isNaN(waitTime)) {
        // Fallback calculation if AI fails to return just an integer
        let multiplier = 2;
        if (canteen.crowd === 'Medium') multiplier = 2.4;
        if (canteen.crowd === 'High') multiplier = 3;
        waitTime = Math.ceil(currentQueueLength * multiplier);
    }
    
    // Cap arbitrary bounds
    if (waitTime < 0) waitTime = 0;
    if (waitTime > 120) waitTime = 120; // max 2 hours

    return {
        canteenId,
        predictedWaitTimeMinutes: waitTime
    };
  } catch (error) {
    console.error("AI Queue Prediction Error:", error);
    // Silent fallback
    return {
        canteenId,
        predictedWaitTimeMinutes: currentQueueLength * 2 // dumb fallback
    };
  }
};

module.exports = {
  predictWaitTime,
};
