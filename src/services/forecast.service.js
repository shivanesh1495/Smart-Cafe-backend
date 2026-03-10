const Forecast = require("../models/Forecast");
const ForecastConfig = require("../models/ForecastConfig");
const AcademicCalendar = require("../models/AcademicCalendar");
const { Booking, Slot, MenuItem, Canteen } = require("../models");
const { getDayBounds, formatDate } = require("../utils/helpers");
const ApiError = require("../utils/ApiError");

/**
 * Cache for canteen capacity shares { fetchedAt, shares: { canteenId: fraction } }
 * Recalculated every 10 minutes
 */
let _canteenShareCache = { shares: {}, totalCapacity: 0, fetchedAt: 0 };
const CANTEEN_SHARE_TTL = 10 * 60 * 1000;

const getCanteenShares = async () => {
  const now = Date.now();
  if (
    Object.keys(_canteenShareCache.shares).length > 0 &&
    now - _canteenShareCache.fetchedAt < CANTEEN_SHARE_TTL
  ) {
    return _canteenShareCache;
  }
  const canteens = await Canteen.find({ isActive: true })
    .select("_id capacity name")
    .lean();
  const totalCapacity = canteens.reduce((s, c) => s + (c.capacity || 100), 0);
  const shares = {};
  for (const c of canteens) {
    const id = c._id.toString();
    shares[id] = (c.capacity || 100) / totalCapacity;
  }
  _canteenShareCache = { shares, totalCapacity, fetchedAt: now };
  return _canteenShareCache;
};

const FORECAST_SERVICE_URL =
  process.env.FORECAST_SERVICE_URL || "http://localhost:5001";

/**
 * Proxy prediction request to Python ML service
 */
const getMLPrediction = async (data) => {
  try {
    const res = await fetch(`${FORECAST_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const result = await res.json();
    return result.prediction;
  } catch {
    return null;
  }
};

/**
 * Calculate historical average for fallback forecasting
 */
const calculateHistoricalAverage = async (mealType, targetDate, canteenId) => {
  const historicalDates = [];
  for (let i = 1; i <= 4; i++) {
    const pastDate = new Date(targetDate);
    pastDate.setDate(pastDate.getDate() - 7 * i);
    historicalDates.push(pastDate);
  }

  let totalBookings = 0;
  let validDays = 0;

  for (const date of historicalDates) {
    const { start, end } = getDayBounds(date);
    const slotQuery = {
      date: { $gte: start, $lte: end },
      mealType,
    };
    if (canteenId) slotQuery.canteenId = canteenId;
    const slots = await Slot.find(slotQuery);

    if (slots.length > 0) {
      const bookings = slots.reduce((sum, slot) => sum + slot.booked, 0);
      totalBookings += bookings;
      validDays++;
    }
  }

  return validDays > 0 ? Math.round(totalBookings / validDays) : 50;
};

/**
 * Multi-day weather cache — stores per-day weather for past + future days
 * { byDate: { "2026-03-08": {...}, ... }, current: {...}, fetchedAt: timestamp }
 */
let _weatherCache = { byDate: {}, current: null, fetchedAt: 0 };
const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Map WMO weather codes (Open-Meteo) to our categories
 * Reference: https://open-meteo.com/en/docs#weathervariables
 */
const mapWMOCode = (code) => {
  if ([0, 1, 2].includes(code)) return "Sunny"; // Clear / Mainly clear / Partly cloudy
  if ([3, 45, 48].includes(code)) return "Cloudy"; // Overcast, Fog
  if (
    [
      51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85,
      86,
    ].includes(code)
  )
    return "Rainy"; // Drizzle, Rain, Snow, Showers
  if ([95, 96, 99].includes(code)) return "Stormy"; // Thunderstorm
  return "Cloudy";
};

/**
 * Fetch multi-day weather from Open-Meteo: current conditions + daily forecast
 * for past 7 days and next 7 days in a single API call.
 */
const fetchMultiDayWeather = async () => {
  const now = Date.now();
  if (
    _weatherCache.current &&
    Object.keys(_weatherCache.byDate).length > 0 &&
    now - _weatherCache.fetchedAt < WEATHER_CACHE_TTL
  ) {
    return _weatherCache;
  }

  try {
    const lat = process.env.WEATHER_LAT || "10.89";
    const lon = process.env.WEATHER_LON || "76.9088";
    const tz = process.env.WEATHER_TZ || "Asia/Kolkata";
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,rain,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean` +
      `&timezone=${encodeURIComponent(tz)}&past_days=7&forecast_days=7`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    const json = await res.json();

    // Parse current conditions
    const cur = json.current || {};
    const currentWeather = {
      condition: mapWMOCode(cur.weather_code ?? 2),
      temperature: Math.round(cur.temperature_2m ?? 28),
      humidity: Math.round(cur.relative_humidity_2m ?? 60),
      rainfall: Math.round((cur.rain ?? 0) * 10) / 10,
      live: true,
    };

    // Parse daily forecasts into a date-keyed map
    const daily = json.daily || {};
    const dates = daily.time || [];
    const byDate = {};
    for (let i = 0; i < dates.length; i++) {
      const dateStr = dates[i]; // "YYYY-MM-DD"
      const code = daily.weather_code?.[i] ?? 2;
      const condition = mapWMOCode(code);
      const tempMax = daily.temperature_2m_max?.[i] ?? 30;
      const tempMin = daily.temperature_2m_min?.[i] ?? 22;
      const precip = daily.precipitation_sum?.[i] ?? 0;
      const humidity = daily.relative_humidity_2m_mean?.[i] ?? 60;

      byDate[dateStr] = {
        condition,
        temperature: Math.round((tempMax + tempMin) / 2),
        humidity: Math.round(humidity),
        rainfall: Math.round(precip * 10) / 10,
        live: true,
      };
    }

    _weatherCache = { byDate, current: currentWeather, fetchedAt: now };
    console.log(
      `[Weather] Open-Meteo loaded ${dates.length} days | Today: ${currentWeather.condition} ${currentWeather.temperature}°C`,
    );
    return _weatherCache;
  } catch (err) {
    console.warn("[Weather] Open-Meteo multi-day failed:", err.message);
    return _weatherCache; // return stale cache if available
  }
};

/**
 * Fallback weather for when API is unreachable (used for dates outside API range)
 */
const generateFallbackWeather = (date) => {
  const month = date.getMonth();
  const dayHash = date.getDate() * 7 + date.getMonth() * 31;

  let weights;
  if (month >= 5 && month <= 8) weights = [0.15, 0.25, 0.45, 0.15];
  else if (month >= 10 || month <= 1) weights = [0.3, 0.45, 0.15, 0.1];
  else weights = [0.55, 0.25, 0.15, 0.05];

  const conditions = ["Sunny", "Cloudy", "Rainy", "Stormy"];
  const tempRanges = {
    Sunny: [28, 36],
    Cloudy: [24, 32],
    Rainy: [20, 28],
    Stormy: [18, 25],
  };
  const humidityRanges = {
    Sunny: [30, 55],
    Cloudy: [50, 75],
    Rainy: [70, 95],
    Stormy: [80, 98],
  };
  const rainfallRanges = {
    Sunny: [0, 0],
    Cloudy: [0, 2],
    Rainy: [5, 40],
    Stormy: [30, 80],
  };

  const r = ((dayHash * 9301 + 49297) % 233280) / 233280;
  let cum = 0,
    condition = "Sunny";
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (r <= cum) {
      condition = conditions[i];
      break;
    }
  }

  const rng = (min, max) =>
    Math.round(
      min + (((dayHash * 1103 + 13849) % 65536) / 65536) * (max - min),
    );

  return {
    condition,
    temperature: rng(tempRanges[condition][0], tempRanges[condition][1]),
    humidity: rng(humidityRanges[condition][0], humidityRanges[condition][1]),
    rainfall: rng(rainfallRanges[condition][0], rainfallRanges[condition][1]),
    live: false,
  };
};

/**
 * Get weather for a specific date — uses real forecast/historical data from Open-Meteo
 * Each day gets its own actual weather (past) or forecast weather (future).
 */
const getWeatherForDate = async (date) => {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const dateKey = formatDate(target); // "YYYY-MM-DD"

  const cache = await fetchMultiDayWeather();

  // For today, prefer the current real-time reading (more accurate than daily summary)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime() && cache.current) {
    return cache.current;
  }

  // For other dates, use the daily forecast/historical data
  if (cache.byDate[dateKey]) {
    return cache.byDate[dateKey];
  }

  // Date not in API range — use seasonal fallback
  return generateFallbackWeather(target);
};

/**
 * Varied base demand by meal type and day
 */
const getBaseDemand = (mealType, dayOfWeek) => {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const baseDemands = {
    BREAKFAST: isWeekend ? 120 : 180,
    LUNCH: isWeekend ? 200 : 320,
    DINNER: isWeekend ? 190 : 270,
    SNACKS: isWeekend ? 100 : 150,
  };
  return baseDemands[mealType] || 150;
};

const WEATHER_DEMAND_MULT = {
  Sunny: 1.05,
  Cloudy: 1.0,
  Rainy: 0.85,
  Stormy: 0.7,
};

/**
 * Generate forecast for a date and meal type (per canteen)
 */
const generateForecast = async (date, mealType, canteenId) => {
  const cid = canteenId || "default";
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isTodayOrFuture = targetDate.getTime() >= today.getTime();

  const existing = await Forecast.findOne({
    date: targetDate,
    mealType,
    canteenId: cid,
  });

  // For past dates, always return cached forecast
  // For today/future: return cached ONLY if it already has an ML prediction
  // (modelVersion starts with 'v2') AND was generated today (fresh weather/events)
  if (existing) {
    if (!isTodayOrFuture) return existing;

    // Get live weather to compare with stored weather
    const liveWeather = await getWeatherForDate(targetDate);
    const weatherChanged =
      liveWeather.live && existing.weatherCondition !== liveWeather.condition;

    // If actual count was already recorded, preserve the record but update weather + prediction
    if (existing.actualCount != null) {
      let changed = false;
      // Update weather data if it changed
      if (weatherChanged) {
        existing.weatherCondition = liveWeather.condition;
        existing.temperature = liveWeather.temperature;
        existing.humidity = liveWeather.humidity;
        existing.rainfall = liveWeather.rainfall;
        changed = true;
      }
      // Still refresh the predicted count if ML is available
      const freshPrediction = await _getMLPredictedCount(targetDate, mealType);
      if (freshPrediction && freshPrediction !== existing.predictedCount) {
        existing.predictedCount = freshPrediction;
        existing.calculateAccuracy();
        changed = true;
      }
      if (changed) await existing.save();
      return existing;
    }

    // For today/future without actuals — check staleness
    const forecastCreatedDate = new Date(existing.createdAt);
    forecastCreatedDate.setHours(0, 0, 0, 0);
    const isDateStale = forecastCreatedDate.getTime() < today.getTime();

    // Regenerate if: created before today OR weather condition has changed
    if (!isDateStale && !weatherChanged) return existing; // Truly fresh

    // Stale or weather-mismatched forecast — delete and regenerate with ML
    await Forecast.deleteOne({ _id: existing._id });
  }

  // Generate fresh forecast using ML model + current weather/events (per canteen)
  const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const dayOfWeek = targetDate.getDay();

  // Dynamic weather — live API for today, fallback for past dates
  const weather = await getWeatherForDate(targetDate);

  // Check academic calendar for event-aware adjustment
  const events = await AcademicCalendar.getActiveEvents(targetDate);
  const eventContext = events.length > 0 ? events[0].eventType : "Normal";
  const demandMultiplier = events.length > 0 ? events[0].demandMultiplier : 1.0;

  // Get canteen capacity share for proportional scaling
  const canteenShares = await getCanteenShares();
  const canteenShare =
    cid !== "default" && canteenShares.shares[cid]
      ? canteenShares.shares[cid]
      : 1.0;
  // Unique hash seed per canteen for deterministic but varied predictions
  const canteenSeed =
    cid !== "default"
      ? cid.split("").reduce((s, c) => s + c.charCodeAt(0), 0)
      : 0;

  // Try ML prediction — predict both veg and non-veg, sum for total demand
  const mlInput = {
    Day_of_Week: DAY_NAMES[dayOfWeek],
    Meal_Type: mealType,
    Event_Context:
      eventContext === "Exam"
        ? "Mid_Sem_Exams"
        : eventContext === "Holiday"
          ? "Diwali_Break"
          : "Normal",
    Weather: weather.condition,
  };
  const [vegPred, nonVegPred] = await Promise.all([
    getMLPrediction({ ...mlInput, Is_Veg: true }),
    getMLPrediction({ ...mlInput, Is_Veg: false }),
  ]);
  let predictedCount =
    vegPred && nonVegPred
      ? vegPred + nonVegPred
      : vegPred || nonVegPred || null;

  // Scale ML prediction by canteen's capacity share + add per-canteen variance
  if (predictedCount && cid !== "default") {
    predictedCount = Math.round(predictedCount * canteenShare);
    // Add small per-canteen variance (±8%) so each canteen number is unique
    const cidHash =
      (canteenSeed * 7 + dayOfWeek * 13 + mealType.charCodeAt(0) * 3) % 100;
    const cidVariance = 1 + (cidHash / 100 - 0.5) * 0.16;
    predictedCount = Math.round(predictedCount * cidVariance);
  }

  // Fallback: historical average OR varied base demand
  if (!predictedCount) {
    const historicalAvg = await calculateHistoricalAverage(
      mealType,
      targetDate,
      canteenId,
    );
    if (historicalAvg > 50) {
      predictedCount = historicalAvg;
      // Scale historical average by canteen share if not default
      if (cid !== "default") {
        predictedCount = Math.round(predictedCount * canteenShare);
      }
    } else {
      // Use varied base demand scaled by canteen capacity share
      const base = getBaseDemand(mealType, dayOfWeek);
      const weatherMult = WEATHER_DEMAND_MULT[weather.condition] || 1.0;
      // Canteen-specific variance using canteen seed + date hash
      const dayHash =
        targetDate.getDate() * 7 +
        targetDate.getMonth() * 31 +
        mealType.charCodeAt(0) +
        canteenSeed;
      const variance =
        1 + (((dayHash * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.3;
      // Scale base demand by canteen's proportion of total capacity
      const scaledBase = cid !== "default" ? base * canteenShare : base;
      predictedCount = Math.round(scaledBase * weatherMult * variance);
    }
  }

  predictedCount = Math.max(1, Math.round(predictedCount * demandMultiplier));

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isSpecialPeriod = events.length > 0 || isWeekend;
  const specialPeriodType =
    events.length > 0 ? events[0].eventType : isWeekend ? "Weekend" : "Normal";

  const forecast = await Forecast.create({
    date: targetDate,
    mealType,
    predictedCount,
    weatherCondition: weather.condition,
    temperature: weather.temperature,
    humidity: weather.humidity,
    rainfall: weather.rainfall,
    isSpecialPeriod,
    specialPeriodType,
    modelVersion: "v2.0-gb",
    canteenId: cid,
  });

  return forecast;
};

/**
 * Helper: get ML-predicted count for a date + meal type
 */
const _getMLPredictedCount = async (targetDate, mealType) => {
  const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const dayOfWeek = targetDate.getDay();
  const weather = await getWeatherForDate(targetDate);
  const events = await AcademicCalendar.getActiveEvents(targetDate);
  const eventContext = events.length > 0 ? events[0].eventType : "Normal";
  const demandMultiplier = events.length > 0 ? events[0].demandMultiplier : 1.0;

  const mlInput = {
    Day_of_Week: DAY_NAMES[dayOfWeek],
    Meal_Type: mealType,
    Event_Context:
      eventContext === "Exam"
        ? "Mid_Sem_Exams"
        : eventContext === "Holiday"
          ? "Diwali_Break"
          : "Normal",
    Weather: weather.condition,
  };
  const [vegPred, nonVegPred] = await Promise.all([
    getMLPrediction({ ...mlInput, Is_Veg: true }),
    getMLPrediction({ ...mlInput, Is_Veg: false }),
  ]);
  const predictedCount =
    vegPred && nonVegPred
      ? vegPred + nonVegPred
      : vegPred || nonVegPred || null;

  if (predictedCount) {
    return Math.round(predictedCount * demandMultiplier);
  }
  return null;
};

/**
 * Default peak-factor templates (used when historical data is insufficient)
 */
const DEFAULT_PEAK_FACTORS = {
  BREAKFAST: [
    { hour: 7, factor: 0.3 },
    { hour: 8, factor: 0.5 },
    { hour: 9, factor: 0.2 },
  ],
  LUNCH: [
    { hour: 11, factor: 0.15 },
    { hour: 12, factor: 0.4 },
    { hour: 13, factor: 0.35 },
    { hour: 14, factor: 0.1 },
  ],
  SNACKS: [
    { hour: 16, factor: 0.4 },
    { hour: 17, factor: 0.6 },
  ],
  DINNER: [
    { hour: 19, factor: 0.3 },
    { hour: 20, factor: 0.45 },
    { hour: 21, factor: 0.25 },
  ],
};

const HOUR_LABELS = {
  7: "7:00 AM",
  8: "8:00 AM",
  9: "9:00 AM",
  10: "10:00 AM",
  11: "11:00 AM",
  12: "12:00 PM",
  13: "1:00 PM",
  14: "2:00 PM",
  15: "3:00 PM",
  16: "4:00 PM",
  17: "5:00 PM",
  18: "6:00 PM",
  19: "7:00 PM",
  20: "8:00 PM",
  21: "9:00 PM",
  22: "10:00 PM",
};

/**
 * Parse a slot time string like "12:00 PM" or "1:30 PM" into 24-hour integer
 */
const parseSlotHour = (timeStr) => {
  if (!timeStr) return null;
  // Take only the start time if range format "12:00 PM - 1:00 PM"
  const start = timeStr.split("-")[0].trim();
  const match = start.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h;
};

/**
 * Learn hourly peak factors from historical booking data.
 * Groups completed bookings by slot hour per meal type over the last N days.
 * Returns { BREAKFAST: [{hour, factor}, ...], ... } or null if insufficient data.
 */
const learnPeakFactors = async (targetDate, lookbackDays = 30, canteenId) => {
  const endDate = new Date(targetDate);
  endDate.setHours(0, 0, 0, 0);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - lookbackDays);

  // Find all slots in the lookback window that had bookings
  const slotQuery = {
    date: { $gte: startDate, $lt: endDate },
    booked: { $gt: 0 },
  };
  if (canteenId) slotQuery.canteenId = canteenId;
  const slots = await Slot.find(slotQuery)
    .select("date time mealType booked")
    .lean();

  if (slots.length < 10) return null; // Not enough data to learn patterns

  // Group booked counts by mealType → hour
  const mealHourCounts = {}; // { LUNCH: { 12: totalBooked, 13: totalBooked, ... } }
  for (const slot of slots) {
    const hour = parseSlotHour(slot.time);
    if (hour === null) continue;
    const mt = slot.mealType;
    if (!mealHourCounts[mt]) mealHourCounts[mt] = {};
    mealHourCounts[mt][hour] = (mealHourCounts[mt][hour] || 0) + slot.booked;
  }

  // Convert counts to normalized factors per meal type
  const factors = {};
  for (const mt of Object.keys(mealHourCounts)) {
    const hourMap = mealHourCounts[mt];
    const hours = Object.keys(hourMap)
      .map(Number)
      .sort((a, b) => a - b);
    const total = hours.reduce((s, h) => s + hourMap[h], 0);
    if (total === 0) continue;
    factors[mt] = hours.map((h) => ({
      hour: h,
      factor: Math.round((hourMap[h] / total) * 100) / 100,
    }));
  }

  // Only use learned factors if we have data for at least 2 meal types
  return Object.keys(factors).length >= 2 ? factors : null;
};

/**
 * Get actual booked counts per slot for a given date (for real-time overlay)
 */
const getActualSlotCounts = async (targetDate, canteenId) => {
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);
  const slotQuery = {
    date: { $gte: targetDate, $lt: nextDate },
    booked: { $gt: 0 },
  };
  if (canteenId) slotQuery.canteenId = canteenId;
  const slots = await Slot.find(slotQuery)
    .select("time mealType booked")
    .lean();

  const result = {}; // { "LUNCH_12": bookedCount }
  for (const slot of slots) {
    const hour = parseSlotHour(slot.time);
    if (hour === null) continue;
    const key = `${slot.mealType}_${hour}`;
    result[key] = (result[key] || 0) + slot.booked;
  }
  return result;
};

/**
 * Get hourly forecast for a date — uses learned booking patterns when available,
 * falls back to default peak factors, and overlays real-time slot bookings for today.
 */
const getHourlyForecast = async (date, canteenId) => {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = targetDate.getTime() === today.getTime();

  // 1. Get ML-predicted daily totals per meal (per canteen)
  const mealTypes = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"];
  const dailyForecasts = {};
  for (const mt of mealTypes) {
    const f = await generateForecast(targetDate, mt, canteenId);
    dailyForecasts[mt] = f.predictedCount;
  }

  // 2. Try to learn peak factors from historical booking patterns
  const learnedFactors = await learnPeakFactors(targetDate, 30, canteenId);

  // 3. Merge learned + default factors (learned takes priority)
  const peakFactors = {};
  for (const mt of mealTypes) {
    peakFactors[mt] =
      learnedFactors && learnedFactors[mt]
        ? learnedFactors[mt]
        : DEFAULT_PEAK_FACTORS[mt];
  }

  // 4. For today, also get real-time booked counts per slot
  const actualCounts = isToday
    ? await getActualSlotCounts(targetDate, canteenId)
    : {};

  // 5. Build hourly slots with predictions + actuals
  const hourlySlots = [];
  for (const mt of mealTypes) {
    const factors = peakFactors[mt];
    for (const { hour, factor } of factors) {
      const predicted = Math.round(dailyForecasts[mt] * factor);
      const actualKey = `${mt}_${hour}`;
      const actual = actualCounts[actualKey] || null;
      hourlySlots.push({
        hour,
        label: HOUR_LABELS[hour] || `${hour}:00`,
        mealType: mt,
        predicted,
        actual, // real-time booked count (only for today, null otherwise)
        dataSource:
          learnedFactors && learnedFactors[mt] ? "learned" : "default",
      });
    }
  }

  // Sort by hour for chronological display
  hourlySlots.sort((a, b) => a.hour - b.hour);

  return hourlySlots;
};

/**
 * Get category-level forecast (by item category)
 */
const getCategoryForecast = async (date, canteenId) => {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const mealTypes = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"];
  const result = [];

  for (const mealType of mealTypes) {
    const forecast = await generateForecast(targetDate, mealType, canteenId);
    const items = await MenuItem.find({
      category: mealType,
      isAvailable: true,
    });
    const itemCount = items.length || 1;
    const perItemShare = forecast.predictedCount / itemCount;

    const categoryItems = items.map((item) => ({
      itemId: item._id,
      itemName: item.itemName,
      dietaryType: item.dietaryType,
      predicted: Math.round(perItemShare * (item.isVeg ? 1.1 : 0.9)),
    }));

    result.push({
      mealType,
      totalPredicted: forecast.predictedCount,
      items: categoryItems,
    });
  }

  return result;
};

/**
 * Get daily forecast
 */
const getDailyForecast = async (date, canteenId) => {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const mealTypes = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"];
  const forecasts = await Promise.all(
    mealTypes.map((mealType) =>
      generateForecast(targetDate, mealType, canteenId),
    ),
  );

  return { date: formatDate(targetDate), forecasts };
};

/**
 * Get weekly forecast
 */
const getWeeklyForecast = async (startDate, canteenId) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const weeklyForecasts = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    weeklyForecasts.push(await getDailyForecast(date, canteenId));
  }
  return weeklyForecasts;
};

/**
 * Record actual consumption
 */
const recordActual = async (date, mealType, actualCount, canteenId) => {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const query = { date: targetDate, mealType };
  if (canteenId) query.canteenId = canteenId;
  const forecast = await Forecast.findOne(query);
  if (!forecast) throw ApiError.notFound("Forecast not found for this date");

  forecast.actualCount = actualCount;
  forecast.calculateAccuracy();
  await forecast.save();
  return forecast;
};

/**
 * Get forecast accuracy metrics (enhanced with RMSE, MAPE)
 */
const getAccuracyMetrics = async (query = {}) => {
  const { startDate, endDate, mealType, canteenId } = query;

  const matchStage = {
    actualCount: { $exists: true, $ne: null },
    accuracy: { $exists: true },
  };
  if (startDate && endDate) {
    matchStage.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }
  if (mealType) matchStage.mealType = mealType;
  if (canteenId) matchStage.canteenId = canteenId;

  const forecasts = await Forecast.find(matchStage);
  if (forecasts.length === 0) {
    return {
      byMealType: [],
      overall: {
        overallAccuracy: 0,
        totalForecasts: 0,
        mae: 0,
        rmse: 0,
        mape: 0,
      },
    };
  }

  const errors = forecasts.map((f) => f.predictedCount - f.actualCount);
  const absErrors = errors.map((e) => Math.abs(e));
  const mae = absErrors.reduce((s, e) => s + e, 0) / absErrors.length;
  const rmse = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length);
  const mape =
    (forecasts.reduce((s, f) => {
      return (
        s +
        Math.abs(f.predictedCount - f.actualCount) / Math.max(f.actualCount, 1)
      );
    }, 0) /
      forecasts.length) *
    100;

  const mealGroups = {};
  forecasts.forEach((f) => {
    if (!mealGroups[f.mealType]) mealGroups[f.mealType] = [];
    mealGroups[f.mealType].push(f);
  });

  const byMealType = Object.entries(mealGroups).map(([mt, items]) => {
    const mtErrors = items.map((f) => f.predictedCount - f.actualCount);
    const mtAbsErrors = mtErrors.map((e) => Math.abs(e));
    return {
      _id: mt,
      averageAccuracy: Math.round(
        items.reduce((s, f) => s + (f.accuracy || 0), 0) / items.length,
      ),
      mae:
        Math.round(
          (mtAbsErrors.reduce((s, e) => s + e, 0) / mtAbsErrors.length) * 100,
        ) / 100,
      rmse:
        Math.round(
          Math.sqrt(mtErrors.reduce((s, e) => s + e * e, 0) / mtErrors.length) *
            100,
        ) / 100,
      count: items.length,
    };
  });

  const trend = forecasts
    .sort((a, b) => a.date - b.date)
    .slice(-30)
    .map((f) => ({
      date: formatDate(f.date),
      mealType: f.mealType,
      predicted: f.predictedCount,
      actual: f.actualCount,
      accuracy: f.accuracy,
    }));

  return {
    byMealType,
    overall: {
      overallAccuracy: Math.round(
        forecasts.reduce((s, f) => s + (f.accuracy || 0), 0) / forecasts.length,
      ),
      totalForecasts: forecasts.length,
      mae: Math.round(mae * 100) / 100,
      rmse: Math.round(rmse * 100) / 100,
      mape: Math.round(mape * 100) / 100,
    },
    trend,
  };
};

/**
 * Get weekly trends for long-term analysis
 */
const getWeeklyTrends = async (weeks = 12, canteenId) => {
  const now = new Date();
  const trends = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - w * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const forecastQuery = {
      date: { $gte: weekStart, $lte: weekEnd },
      actualCount: { $exists: true, $ne: null },
    };
    if (canteenId) forecastQuery.canteenId = canteenId;
    const forecasts = await Forecast.find(forecastQuery);

    trends.push({
      weekStart: formatDate(weekStart),
      weekEnd: formatDate(weekEnd),
      totalPredicted: forecasts.reduce((s, f) => s + f.predictedCount, 0),
      totalActual: forecasts.reduce((s, f) => s + (f.actualCount || 0), 0),
      avgAccuracy:
        forecasts.length > 0
          ? Math.round(
              forecasts.reduce((s, f) => s + (f.accuracy || 0), 0) /
                forecasts.length,
            )
          : null,
      forecastCount: forecasts.length,
    });
  }
  return trends;
};

/**
 * Get monthly trends
 */
const getMonthlyTrends = async (months = 6, canteenId) => {
  const now = new Date();
  const trends = [];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  for (let m = months - 1; m >= 0; m--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() - m + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const forecastQuery = {
      date: { $gte: monthStart, $lte: monthEnd },
      actualCount: { $exists: true, $ne: null },
    };
    if (canteenId) forecastQuery.canteenId = canteenId;
    const forecasts = await Forecast.find(forecastQuery);

    trends.push({
      month: monthNames[monthStart.getMonth()],
      year: monthStart.getFullYear(),
      totalPredicted: forecasts.reduce((s, f) => s + f.predictedCount, 0),
      totalActual: forecasts.reduce((s, f) => s + (f.actualCount || 0), 0),
      avgAccuracy:
        forecasts.length > 0
          ? Math.round(
              forecasts.reduce((s, f) => s + (f.accuracy || 0), 0) /
                forecasts.length,
            )
          : null,
      forecastCount: forecasts.length,
    });
  }
  return trends;
};

/**
 * Get weather impact analysis from ML service
 */
const getWeatherImpact = async () => {
  try {
    const res = await fetch(`${FORECAST_SERVICE_URL}/analytics`);
    if (!res.ok) return null;
    const data = await res.json();

    const weatherDrivers = (data.top_drivers || []).filter(
      (d) =>
        d.factor.toLowerCase().includes("rain") ||
        d.factor.toLowerCase().includes("cold") ||
        d.factor.toLowerCase().includes("clear") ||
        d.factor.toLowerCase().includes("wtr"),
    );

    return {
      metrics: data.metrics,
      weatherDrivers,
      chartData: data.chart_data,
      totalRecords: data.total_records,
      averageDemand: data.average_demand,
    };
  } catch {
    return { weatherDrivers: [], metrics: {}, chartData: [] };
  }
};

/**
 * Forecast configuration management
 */
const getForecastConfigs = async () =>
  ForecastConfig.find().sort({ createdAt: -1 });
const createForecastConfig = async (data, userId) =>
  ForecastConfig.create({ ...data, createdBy: userId });
const activateForecastConfig = async (id) => ForecastConfig.activate(id);
const getActiveConfig = async () => ForecastConfig.getActive();

/**
 * Export this week's forecast-vs-actual data to the ML CSV dataset
 * Called every Saturday night so the model learns from real data
 */
const exportWeekToMLDataset = async () => {
  const fs = require("fs");
  const path = require("path");

  const now = new Date();
  // Get this past week: Monday → Saturday
  const saturdayEnd = new Date(now);
  saturdayEnd.setHours(23, 59, 59, 999);
  const mondayStart = new Date(saturdayEnd);
  mondayStart.setDate(mondayStart.getDate() - 6);
  mondayStart.setHours(0, 0, 0, 0);

  const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const WEATHER_MAP_REV = {
    Sunny: "Sunny",
    Cloudy: "Cloudy",
    Rainy: "Rainy",
    Stormy: "Heavy_Rain",
    Unknown: "Normal",
  };

  const forecasts = await Forecast.find({
    date: { $gte: mondayStart, $lte: saturdayEnd },
    actualCount: { $exists: true, $ne: null },
  });

  if (forecasts.length === 0) {
    console.log(
      "[ML Export] No forecast records with actuals found this week. Skipping.",
    );
    return { exported: 0 };
  }

  const csvPath = path.join(
    __dirname,
    "..",
    "..",
    "forecasting_api",
    "cafeteria_data_full_quarter.csv",
  );

  // Read existing CSV to get headers
  let headers =
    "Date,Day_of_Week,Meal_Type,Main_Dish,Is_Veg,Event_Context,Weather,Qty_Consumed,Qty_Predicted,Waste";
  if (fs.existsSync(csvPath)) {
    const firstLine = fs.readFileSync(csvPath, "utf8").split("\n")[0].trim();
    if (firstLine) headers = firstLine;
  }

  const headerCols = headers.split(",");

  // Build new rows
  const newRows = [];
  for (const f of forecasts) {
    const d = new Date(f.date);
    const dateStr = `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    const dayName = DAY_NAMES[d.getDay()];
    const weather = WEATHER_MAP_REV[f.weatherCondition] || "Normal";
    const waste = Math.max(0, (f.predictedCount || 0) - (f.actualCount || 0));
    const eventCtx =
      f.specialPeriodType === "Normal"
        ? "Normal"
        : f.specialPeriodType || "Normal";

    const rowMap = {
      Date: dateStr,
      Day_of_Week: dayName,
      Meal_Type: f.mealType,
      Main_Dish: `AutoExport_${f.mealType}`,
      Is_Veg: "True",
      Event_Context: eventCtx,
      Weather: weather,
      Qty_Consumed: f.actualCount || 0,
      Qty_Predicted: f.predictedCount || 0,
      Waste: waste,
    };

    const row = headerCols.map((col) => rowMap[col] ?? "").join(",");
    newRows.push(row);
  }

  // Append to CSV
  const csvContent = "\n" + newRows.join("\n");
  fs.appendFileSync(csvPath, csvContent, "utf8");

  // Trigger ML retrain by hitting the /retrain endpoint (if available)
  try {
    await fetch(`${FORECAST_SERVICE_URL}/retrain`, {
      method: "POST",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    /* retrain endpoint may not exist; model will pick up new data on next restart */
  }

  console.log(`[ML Export] Exported ${newRows.length} records to ML dataset.`);
  return { exported: newRows.length };
};

module.exports = {
  generateForecast,
  getDailyForecast,
  getWeeklyForecast,
  getHourlyForecast,
  getCategoryForecast,
  recordActual,
  getAccuracyMetrics,
  getWeeklyTrends,
  getMonthlyTrends,
  getWeatherImpact,
  getForecastConfigs,
  createForecastConfig,
  activateForecastConfig,
  getActiveConfig,
  exportWeekToMLDataset,
  fetchMultiDayWeather,
};
