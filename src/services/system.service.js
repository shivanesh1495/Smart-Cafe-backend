const { SystemSetting, AuditLog } = require("../models");
const ApiError = require("../utils/ApiError");

/**
 * Get all settings
 */
const getAllSettings = async (category) => {
  const filter = {};

  if (category) {
    filter.category = category;
  }

  const settings = await SystemSetting.find(filter).sort({
    category: 1,
    settingKey: 1,
  });

  // Add typedValue to each setting
  return settings.map((s) => ({
    ...s.toJSON(),
    typedValue: s.typedValue,
  }));
};

/**
 * Get settings grouped by category
 */
const getSettingsGrouped = async () => {
  const settings = await SystemSetting.find().sort({ settingKey: 1 });

  const grouped = {};

  for (const setting of settings) {
    if (!grouped[setting.category]) {
      grouped[setting.category] = [];
    }
    grouped[setting.category].push({
      ...setting.toJSON(),
      typedValue: setting.typedValue,
    });
  }

  return grouped;
};

/**
 * Get setting by key
 */
const getSetting = async (key) => {
  const setting = await SystemSetting.findOne({
    settingKey: key.toUpperCase(),
  });

  if (!setting) {
    return null;
  }

  return {
    ...setting.toJSON(),
    typedValue: setting.typedValue,
  };
};

/**
 * Get setting value by key
 */
const getSettingValue = async (key) => {
  return SystemSetting.getValue(key);
};

const getPublicSettings = async () => {
  const toBoolean = (value, fallback) => {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return Boolean(value);
  };

  const toNumber = (value, fallback) => {
    if (value === null || value === undefined || value === "") return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  // Booking service settings
  const onlineBookingEnabled = await SystemSetting.getValue(
    "ONLINE_BOOKING_ENABLED",
  );
  const walkinEnabled = await SystemSetting.getValue("WALKIN_ENABLED");
  const slotDuration = await SystemSetting.getValue("SLOT_DURATION");
  const operatingSchedule = await SystemSetting.getValue("OPERATING_SCHEDULE");
  const masterBookingEnabled = await SystemSetting.getValue(
    "MASTER_BOOKING_ENABLED",
  );
  const autoBackupEnabled = await SystemSetting.getValue("AUTO_BACKUP_ENABLED");
  const tokenExpiryMins = await SystemSetting.getValue(
    "TOKEN_EXPIRY_DURATION_MINS",
  );
  const portionSize = await SystemSetting.getValue("PORTION_SIZE");
  const surplusDonationEnabled = await SystemSetting.getValue(
    "SURPLUS_DONATION_ENABLED",
  );

  // POLICY SETTINGS - Include these so students see the rules set by admin
  const maxBookingsPerDay = await SystemSetting.getValue(
    "MAX_BOOKINGS_PER_STUDENT_PER_DAY",
  );
  const peakBookingWindow = await SystemSetting.getValue(
    "PEAK_BOOKING_WINDOW_MINS",
  );
  const noShowGrace = await SystemSetting.getValue("NO_SHOW_GRACE_PERIOD_MINS");
  const noShowPenalty = await SystemSetting.getValue("NO_SHOW_PENALTY_DAYS");
  const ricePortionLimit = await SystemSetting.getValue("RICE_PORTION_LIMIT_G");
  const curryPortionLimit = await SystemSetting.getValue(
    "CURRY_PORTION_LIMIT_ML",
  );
  const maxCapacityPerSlot = await SystemSetting.getValue(
    "MAX_CAPACITY_PER_SLOT",
  );
  const facultyReserved = await SystemSetting.getValue(
    "FACULTY_RESERVED_SLOTS",
  );
  const guestReserved = await SystemSetting.getValue("GUEST_RESERVED_SLOTS");

  return {
    // Existing public settings
    onlineBookingEnabled: toBoolean(onlineBookingEnabled, true),
    walkinEnabled: toBoolean(walkinEnabled, true),
    slotDuration:
      typeof slotDuration === "number"
        ? slotDuration
        : Number(slotDuration) || 15,
    operatingSchedule:
      typeof operatingSchedule === "string"
        ? (() => {
            try {
              return JSON.parse(operatingSchedule);
            } catch {
              return null;
            }
          })()
        : operatingSchedule || null,
    masterBookingEnabled: toBoolean(masterBookingEnabled, true),
    autoBackupEnabled: toBoolean(autoBackupEnabled, true),
    tokenExpiryMins:
      typeof tokenExpiryMins === "number"
        ? tokenExpiryMins
        : Number(tokenExpiryMins) || 60,
    portionSize: portionSize || "Standard",
    surplusDonationEnabled: toBoolean(surplusDonationEnabled, false),

    // NEW: Policy settings that admin configures
    policies: {
      maxBookingsPerDay: toNumber(maxBookingsPerDay, 2),
      peakBookingWindowMins: toNumber(peakBookingWindow, 30),
      tokenExpiryMins: toNumber(tokenExpiryMins, 60),
      noShowGraceMins: toNumber(noShowGrace, 15),
      noShowPenaltyDays: toNumber(noShowPenalty, 7),
      ricePortionLimitG: toNumber(ricePortionLimit, 250),
      curryPortionLimitMl: toNumber(curryPortionLimit, 150),
      maxCapacityPerSlot: toNumber(maxCapacityPerSlot, 200),
      facultyReservedSlots: toNumber(facultyReserved, 50),
      guestReservedSlots: toNumber(guestReserved, 20),
    },
  };
};

/**
 * Create or update setting
 */
const upsertSetting = async (data) => {
  const setting = await SystemSetting.findOneAndUpdate(
    { settingKey: data.settingKey.toUpperCase() },
    {
      ...data,
      settingKey: data.settingKey.toUpperCase(),
    },
    { upsert: true, new: true, runValidators: true },
  );

  return {
    ...setting.toJSON(),
    typedValue: setting.typedValue,
  };
};

/**
 * Update setting value
 */
const updateSettingValue = async (key, value, userId) => {
  const normalizedKey = key.toUpperCase();
  const setting = await SystemSetting.findOne({
    settingKey: normalizedKey,
  });

  if (!setting) {
    const defaults = {
      MASTER_BOOKING_ENABLED: {
        dataType: "BOOLEAN",
        category: "BOOKING",
        description: "Master booking control",
        isEditable: true,
      },
      AUTO_BACKUP_ENABLED: {
        dataType: "BOOLEAN",
        category: "GENERAL",
        description: "Enable or disable daily backups",
        isEditable: true,
      },
      ONLINE_BOOKING_ENABLED: {
        dataType: "BOOLEAN",
        category: "BOOKING",
        description: "Enable or disable online booking",
        isEditable: true,
      },
      WALKIN_ENABLED: {
        dataType: "BOOLEAN",
        category: "BOOKING",
        description: "Enable or disable walk-in service",
        isEditable: true,
      },
      SLOT_DURATION: {
        dataType: "NUMBER",
        category: "BOOKING",
        description: "Slot duration in minutes",
        isEditable: true,
      },
      OPERATING_SCHEDULE: {
        dataType: "JSON",
        category: "BOOKING",
        description: "Operating schedule by day",
        isEditable: true,
      },
      MAX_BOOKINGS_PER_STUDENT_PER_DAY: {
        dataType: "NUMBER",
        category: "CAPACITY",
        description: "Max bookings per student per day",
        isEditable: true,
      },
      PEAK_BOOKING_WINDOW_MINS: {
        dataType: "NUMBER",
        category: "CAPACITY",
        description: "Peak booking window in minutes",
        isEditable: true,
      },
      TOKEN_EXPIRY_DURATION_MINS: {
        dataType: "NUMBER",
        category: "CAPACITY",
        description: "Token expiry duration in minutes",
        isEditable: true,
      },
      NO_SHOW_GRACE_PERIOD_MINS: {
        dataType: "NUMBER",
        category: "CAPACITY",
        description: "No-show grace period in minutes",
        isEditable: true,
      },
      NO_SHOW_PENALTY_DAYS: {
        dataType: "NUMBER",
        category: "CAPACITY",
        description: "No-show penalty days",
        isEditable: true,
      },
      RICE_PORTION_LIMIT_G: {
        dataType: "NUMBER",
        category: "CAPACITY",
        description: "Rice portion limit in grams",
        isEditable: true,
      },
      CURRY_PORTION_LIMIT_ML: {
        dataType: "NUMBER",
        category: "CAPACITY",
        description: "Curry portion limit in ml",
        isEditable: true,
      },
      MAX_CAPACITY_PER_SLOT: {
        dataType: "NUMBER",
        category: "CAPACITY",
        description: "Maximum capacity per slot",
        isEditable: true,
      },
      FACULTY_RESERVED_SLOTS: {
        dataType: "NUMBER",
        category: "CAPACITY",
        description: "Faculty reserved slots",
        isEditable: true,
      },
      GUEST_RESERVED_SLOTS: {
        dataType: "NUMBER",
        category: "CAPACITY",
        description: "Guest reserved slots",
        isEditable: true,
      },
      PORTION_SIZE: {
        dataType: "STRING",
        category: "FOOD",
        description: "Default portion size for meals",
        isEditable: true,
      },
      SURPLUS_DONATION_ENABLED: {
        dataType: "BOOLEAN",
        category: "FOOD",
        description: "Enable surplus food donation tracking",
        isEditable: true,
      },
      QUEUE_ENABLED: {
        dataType: "BOOLEAN",
        category: "BOOKING",
        description: "Enable real-time queue management",
        isEditable: true,
      },
    };

    if (!defaults[normalizedKey]) {
      throw ApiError.notFound("Setting not found");
    }

    const created = await SystemSetting.setValue(normalizedKey, value, {
      ...defaults[normalizedKey],
    });

    return {
      ...created.toJSON(),
      typedValue: created.typedValue,
    };
  }

  if (!setting.isEditable) {
    throw ApiError.forbidden("This setting cannot be edited");
  }

  const previousValue = setting.settingValue;
  setting.settingValue = String(value);
  await setting.save();

  if (
    [
      "MASTER_BOOKING_ENABLED",
      "AUTO_BACKUP_ENABLED",
      "ONLINE_BOOKING_ENABLED",
      "WALKIN_ENABLED",
    ].includes(normalizedKey)
  ) {
    await AuditLog.log({
      action: `Setting updated: ${normalizedKey}`,
      user: userId,
      userName: "Admin",
      userRole: "admin",
      resource: "SystemSetting",
      details: {
        key: normalizedKey,
        previousValue,
        newValue: String(value),
      },
    });
  }

  return {
    ...setting.toJSON(),
    typedValue: setting.typedValue,
  };
};

const getAuditLogs = async (limit = 10) => {
  const entries = await AuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(Number(limit) || 10)
    .lean();

  return entries;
};

/**
 * Bulk update settings
 */
const bulkUpdateSettings = async (settings, userId) => {
  const results = [];

  for (const { key, value } of settings) {
    try {
      const updated = await updateSettingValue(key, value, userId);
      results.push(updated);
    } catch (error) {
      // Continue with other settings
      results.push({ key, error: error.message });
    }
  }

  return results;
};

/**
 * Delete setting
 */
const deleteSetting = async (key) => {
  const setting = await SystemSetting.findOneAndDelete({
    settingKey: key.toUpperCase(),
  });

  if (!setting) {
    throw ApiError.notFound("Setting not found");
  }

  return setting;
};

/**
 * Initialize default settings
 */
const initializeDefaults = async () => {
  const defaults = [
    {
      settingKey: "BOOKING_ENABLED",
      settingValue: "true",
      dataType: "BOOLEAN",
      category: "BOOKING",
      description: "Master switch for booking system",
      isEditable: true,
    },
    {
      settingKey: "DEFAULT_SLOT_CAPACITY",
      settingValue: "50",
      dataType: "NUMBER",
      category: "CAPACITY",
      description: "Default capacity for new slots",
      isEditable: true,
    },
    {
      settingKey: "MAX_BOOKINGS_PER_USER",
      settingValue: "3",
      dataType: "NUMBER",
      category: "BOOKING",
      description: "Maximum bookings per user per day",
      isEditable: true,
    },
    {
      settingKey: "CANCELLATION_DEADLINE_MINUTES",
      settingValue: "30",
      dataType: "NUMBER",
      category: "BOOKING",
      description: "Minutes before slot time when cancellation is allowed",
      isEditable: true,
    },
    {
      settingKey: "MAX_BOOKINGS_PER_STUDENT_PER_DAY",
      settingValue: "2",
      dataType: "NUMBER",
      category: "CAPACITY",
      description: "Max bookings per student per day",
      isEditable: true,
    },
    {
      settingKey: "PEAK_BOOKING_WINDOW_MINS",
      settingValue: "30",
      dataType: "NUMBER",
      category: "CAPACITY",
      description: "Peak booking window in minutes",
      isEditable: true,
    },
    {
      settingKey: "TOKEN_EXPIRY_DURATION_MINS",
      settingValue: "60",
      dataType: "NUMBER",
      category: "CAPACITY",
      description: "Token expiry duration in minutes",
      isEditable: true,
    },
    {
      settingKey: "NO_SHOW_GRACE_PERIOD_MINS",
      settingValue: "15",
      dataType: "NUMBER",
      category: "CAPACITY",
      description: "No-show grace period in minutes",
      isEditable: true,
    },
    {
      settingKey: "NO_SHOW_PENALTY_DAYS",
      settingValue: "7",
      dataType: "NUMBER",
      category: "CAPACITY",
      description: "No-show penalty days",
      isEditable: true,
    },
    {
      settingKey: "PORTION_SIZE",
      settingValue: "Regular",
      dataType: "STRING",
      category: "FOOD",
      description: "Default portion size for meals",
      isEditable: true,
    },
    {
      settingKey: "SURPLUS_DONATION_ENABLED",
      settingValue: "false",
      dataType: "BOOLEAN",
      category: "FOOD",
      description: "Enable surplus food donation tracking",
      isEditable: true,
    },
    {
      settingKey: "QUEUE_ENABLED",
      settingValue: "true",
      dataType: "BOOLEAN",
      category: "BOOKING",
      description: "Enable real-time queue management",
      isEditable: true,
    },
  ];

  for (const setting of defaults) {
    await SystemSetting.findOneAndUpdate(
      { settingKey: setting.settingKey },
      setting,
      { upsert: true },
    );
  }
};

module.exports = {
  getAllSettings,
  getSettingsGrouped,
  getSetting,
  getSettingValue,
  getPublicSettings,
  getAuditLogs,
  upsertSetting,
  updateSettingValue,
  bulkUpdateSettings,
  deleteSetting,
  initializeDefaults,
};
