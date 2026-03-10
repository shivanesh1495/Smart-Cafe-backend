/**
 * Seed script — Populates 30 days of realistic forecast history.
 * Run: node src/scripts/seedForecasts.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const Forecast = require(path.join(__dirname, '..', 'models', 'Forecast'));
const config = require(path.join(__dirname, '..', 'config'));

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACKS'];

const WEATHER_OPTIONS = [
  { condition: 'Sunny', temp: [28, 36], humidity: [30, 55], rainfall: 0 },
  { condition: 'Cloudy', temp: [24, 32], humidity: [50, 75], rainfall: 0 },
  { condition: 'Rainy', temp: [20, 28], humidity: [70, 95], rainfall: [5, 40] },
  { condition: 'Stormy', temp: [18, 25], humidity: [80, 98], rainfall: [30, 80] },
];

// Base demand by meal type (varies by day)
const BASE_DEMAND = {
  BREAKFAST: { weekday: 180, weekend: 120 },
  LUNCH: { weekday: 320, weekend: 200 },
  DINNER: { weekday: 270, weekend: 190 },
  SNACKS: { weekday: 150, weekend: 100 },
};

// Weather multipliers
const WEATHER_MULT = { Sunny: 1.05, Cloudy: 1.0, Rainy: 0.85, Stormy: 0.7 };

function rand(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function pickWeather() {
  const weights = [0.4, 0.3, 0.2, 0.1];
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (r <= cum) return WEATHER_OPTIONS[i];
  }
  return WEATHER_OPTIONS[0];
}

async function seed() {
  await mongoose.connect(config.mongodb.uri);
  console.log('Connected to MongoDB');

  // Clear existing forecasts
  await Forecast.deleteMany({});
  console.log('Cleared existing forecasts');

  const docs = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let dayOffset = -30; dayOffset <= 0; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weather = pickWeather();

    for (const meal of MEAL_TYPES) {
      const base = isWeekend ? BASE_DEMAND[meal].weekend : BASE_DEMAND[meal].weekday;
      const weatherMult = WEATHER_MULT[weather.condition];

      // Add day-of-week variance (+/- 15%)
      const dayVariance = 1 + (Math.random() - 0.5) * 0.30;

      // Predicted count from model
      const predicted = Math.round(base * weatherMult * dayVariance);

      // Actual count: differs from predicted by ±5-20% (realistic accuracy range 80-95%)
      const errorPct = (Math.random() * 0.15) + 0.05; // 5%-20% error
      const direction = Math.random() > 0.5 ? 1 : -1;
      const actual = Math.round(predicted * (1 + direction * errorPct));

      // Calculate accuracy
      const error = Math.abs(predicted - actual);
      const maxVal = Math.max(predicted, actual);
      const accuracy = Math.round((1 - error / maxVal) * 100);

      const temp = Array.isArray(weather.temp) ? rand(weather.temp[0], weather.temp[1]) : weather.temp;
      const humidity = Array.isArray(weather.humidity) ? rand(weather.humidity[0], weather.humidity[1]) : weather.humidity;
      const rainfall = Array.isArray(weather.rainfall) ? rand(weather.rainfall[0], weather.rainfall[1]) : weather.rainfall;

      docs.push({
        date,
        mealType: meal,
        predictedCount: predicted,
        actualCount: dayOffset < 0 ? actual : undefined, // today has no actuals yet
        accuracy: dayOffset < 0 ? accuracy : undefined,
        weatherCondition: weather.condition,
        temperature: temp,
        humidity,
        rainfall,
        isSpecialPeriod: isWeekend,
        specialPeriodType: isWeekend ? 'Weekend' : 'Normal',
        modelVersion: 'v2.0-gb',
      });
    }
  }

  await Forecast.insertMany(docs);
  console.log(`Seeded ${docs.length} forecast records (${docs.length / 4} days × 4 meals)`);

  await mongoose.disconnect();
  console.log('Done!');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
