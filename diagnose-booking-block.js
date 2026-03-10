const { MongoClient } = require("mongodb");

const uri =
  process.env.MONGODB_URI ||
  process.env.MONGODB_URL ||
  "mongodb://localhost:27017/smart-cafe";

async function run() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db("smart-cafe");

  const settings = db.collection("systemsettings");
  const users = db.collection("users");
  const slots = db.collection("slots");
  const bookings = db.collection("bookings");
  const menuItems = db.collection("menuitems");

  const policyKeys = [
    "MASTER_BOOKING_ENABLED",
    "ONLINE_BOOKING_ENABLED",
    "NO_SHOW_PENALTY_DAYS",
    "MAX_BOOKINGS_PER_STUDENT_PER_DAY",
    "PEAK_BOOKING_WINDOW_MINS",
    "FACULTY_RESERVED_SLOTS",
    "GUEST_RESERVED_SLOTS",
  ];

  const policyDocs = await settings
    .find({ settingKey: { $in: policyKeys } })
    .toArray();
  const policyMap = Object.fromEntries(
    policyDocs.map((d) => [d.settingKey, d.settingValue]),
  );

  const now = new Date();
  const cutoff = new Date(now);
  const penaltyDays = Number(policyMap.NO_SHOW_PENALTY_DAYS || 7);
  cutoff.setDate(cutoff.getDate() - penaltyDays);

  const recentSlots = await slots
    .find({ date: { $gte: cutoff } })
    .project({ _id: 1, date: 1, time: 1 })
    .toArray();
  const recentSlotIds = recentSlots.map((s) => s._id);

  const blockedNoShows = await bookings
    .find({
      status: "no_show",
      slot: { $in: recentSlotIds },
    })
    .project({
      _id: 1,
      user: 1,
      tokenNumber: 1,
      slot: 1,
      createdAt: 1,
      cancelledAt: 1,
    })
    .toArray();

  const userDocs = await users
    .find({ role: "user" })
    .project({ _id: 1, fullName: 1, email: 1, status: 1 })
    .toArray();
  const userMap = new Map(userDocs.map((u) => [String(u._id), u]));

  const grouped = new Map();
  for (const b of blockedNoShows) {
    const key = String(b.user);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(b);
  }

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const todayOpenSlots = await slots
    .find({
      date: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ["Open", "FastFilling", "Full"] },
      isDisabled: { $ne: true },
    })
    .project({ _id: 1, date: 1, time: 1, status: 1, booked: 1, capacity: 1 })
    .toArray();

  const inStockItems = await menuItems
    .find({
      isAvailable: true,
      availableQuantity: { $gt: 0 },
    })
    .project({ itemName: 1, availableQuantity: 1, price: 1 })
    .toArray();

  console.log("=== BOOKING POLICY SNAPSHOT ===");
  for (const k of policyKeys) {
    console.log(`${k}: ${policyMap[k]}`);
  }

  console.log("\n=== NO-SHOW PENALTY WINDOW ===");
  console.log("Now:", now.toISOString());
  console.log("Penalty days:", penaltyDays);
  console.log("Cutoff:", cutoff.toISOString());
  console.log("Recent slots considered:", recentSlots.length);
  console.log("No-show bookings in window:", blockedNoShows.length);

  console.log("\n=== USERS BLOCKED RIGHT NOW ===");
  if (grouped.size === 0) {
    console.log("None");
  } else {
    for (const [uid, list] of grouped.entries()) {
      const u = userMap.get(uid);
      console.log(
        `- ${u ? `${u.fullName} (${u.email})` : uid} => ${list.length} no-show booking(s)`,
      );
      for (const b of list) {
        const s = recentSlots.find((x) => String(x._id) === String(b.slot));
        console.log(
          `  token=${b.tokenNumber} slot=${s ? `${new Date(s.date).toISOString().slice(0, 10)} ${s.time}` : String(b.slot)}`,
        );
      }
    }
  }

  console.log("\n=== TODAY SLOTS (BOOKABLE CHECK) ===");
  console.log("Count:", todayOpenSlots.length);
  for (const s of todayOpenSlots.slice(0, 12)) {
    console.log(
      `- ${new Date(s.date).toISOString().slice(0, 10)} ${s.time} status=${s.status} booked=${s.booked}/${s.capacity}`,
    );
  }

  console.log("\n=== FOOD STOCK CHECK ===");
  console.log("In-stock menu items:", inStockItems.length);
  for (const i of inStockItems.slice(0, 10)) {
    console.log(`- ${i.itemName}: qty=${i.availableQuantity} price=${i.price}`);
  }

  await client.close();
}

run().catch((e) => {
  console.error("DIAGNOSIS ERROR:", e.message);
  process.exit(1);
});
