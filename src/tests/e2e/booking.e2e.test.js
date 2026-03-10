/**
 * End-to-End Integration Tests: Complete Booking Flow
 * Tests the full journey: Menu → Slot → Booking → Token → Complete
 * Real MongoDB, no mocks
 */
const request = require("supertest");
const app = require("../../app");
const { User, MenuItem, Slot, Booking, Canteen } = require("../../models");

const formatSlotTime = (date) => {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")} ${period}`;
};

const getFutureSlotTime = () => {
  const now = new Date();
  const future = new Date(now.getTime() + 60 * 60000);

  if (
    future.getFullYear() !== now.getFullYear() ||
    future.getMonth() !== now.getMonth() ||
    future.getDate() !== now.getDate()
  ) {
    future.setHours(23, 59, 0, 0);
  }

  if (future <= now) {
    future.setMinutes(now.getMinutes() + 1, now.getSeconds(), 0);
  }

  return formatSlotTime(future);
};

// Helper to create user and get token
const createUserAndLogin = async (data) => {
  await request(app).post("/api/auth/register").send(data);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: data.email, password: data.password });
  return loginRes.body.data.token;
};

describe("Booking Flow E2E Integration", () => {
  let studentToken, staffToken, managerToken, adminToken;
  let menuItemId, slotId, canteenId;

  beforeEach(async () => {
    // Create users of all roles
    studentToken = await createUserAndLogin({
      fullName: "Test Student",
      email: "student@uni.com",
      password: "student123",
      role: "user",
    });

    staffToken = await createUserAndLogin({
      fullName: "Test Staff",
      email: "staff@cafe.com",
      password: "staff12345",
      role: "canteen_staff",
    });

    managerToken = await createUserAndLogin({
      fullName: "Test Manager",
      email: "manager@cafe.com",
      password: "manager123",
      role: "manager",
    });

    adminToken = await createUserAndLogin({
      fullName: "Test Admin",
      email: "admin@cafe.com",
      password: "admin12345",
      role: "admin",
    });

    // Create canteen
    const canteen = await Canteen.create({
      name: "Main Canteen",
      location: "Building A",
      capacity: 200,
      status: "Open",
    });
    canteenId = canteen._id;

    // Create menu item
    const menuItem = await MenuItem.create({
      itemName: "Masala Dosa",
      price: 50,
      isAvailable: true,
      category: "BREAKFAST",
      dietaryType: "Veg",
      isVeg: true,
      canteens: [canteenId],
    });
    menuItemId = menuItem._id;

    // Create meal slot for today
    const slotDate = new Date();
    slotDate.setHours(0, 0, 0, 0);
    const slotTime = getFutureSlotTime();

    const slot = await Slot.create({
      date: slotDate,
      time: slotTime,
      capacity: 50,
      mealType: "LUNCH",
      status: "Open",
    });
    slotId = slot._id;
  });

  // ==================== MENU ITEMS ====================
  describe("Menu Items API", () => {
    it("should list menu items publicly", async () => {
      const res = await request(app).get("/api/menu-items");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].itemName).toBe("Masala Dosa");
    });

    it("should get menu item by ID", async () => {
      const res = await request(app).get(`/api/menu-items/${menuItemId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.itemName).toBe("Masala Dosa");
      expect(res.body.data.price).toBe(50);
    });

    it("should create menu item (manager)", async () => {
      const res = await request(app)
        .post("/api/menu-items")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          itemName: "Idli Sambar",
          price: 40,
          category: "BREAKFAST",
          dietaryType: "Veg",
          isVeg: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.itemName).toBe("Idli Sambar");
    });

    it("should reject menu item creation by student", async () => {
      const res = await request(app)
        .post("/api/menu-items")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          itemName: "Unauthorized Item",
          price: 30,
        });

      expect(res.status).toBe(403);
    });

    it("should toggle menu item availability (manager)", async () => {
      const res = await request(app)
        .patch(`/api/menu-items/${menuItemId}/toggle`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isAvailable).toBe(false);

      // Toggle back
      const res2 = await request(app)
        .patch(`/api/menu-items/${menuItemId}/toggle`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res2.body.data.isAvailable).toBe(true);
    });
  });

  // ==================== SLOTS ====================
  describe("Slots API", () => {
    it("should get today slots publicly", async () => {
      const res = await request(app).get("/api/slots/today");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should get slots with auth", async () => {
      const res = await request(app)
        .get("/api/slots")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should create slot (manager)", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const res = await request(app)
        .post("/api/slots")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          date: tomorrow.toISOString(),
          time: "08:00 AM",
          capacity: 30,
          mealType: "BREAKFAST",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.capacity).toBe(30);
      expect(res.body.data.mealType).toBe("BREAKFAST");
    });

    it("should update slot capacity (manager)", async () => {
      const res = await request(app)
        .patch(`/api/slots/${slotId}/capacity`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ capacity: 100 });

      expect(res.status).toBe(200);
      expect(res.body.data.capacity).toBe(100);
    });

    it("should reject slot creation by student", async () => {
      const res = await request(app)
        .post("/api/slots")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          date: new Date().toISOString(),
          time: "02:00 PM",
          capacity: 20,
        });

      expect(res.status).toBe(403);
    });
  });

  // ==================== BOOKING CREATION ====================
  describe("Booking Flow", () => {
    it("should create a booking (student)", async () => {
      const res = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 2 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.tokenNumber).toBeDefined();
      expect(res.body.data.totalAmount).toBe(100); // 50 * 2
      expect(res.body.data.status).toBe("confirmed");
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].quantity).toBe(2);
    });

    it("should increment slot booked count after booking", async () => {
      await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      const slot = await Slot.findById(slotId);
      expect(slot.booked).toBe(1);
    });

    it("should reject duplicate booking for same slot", async () => {
      await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      const res = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      expect(res.status).toBe(409);
    });

    it("should reject booking for full slot", async () => {
      await Slot.findByIdAndUpdate(slotId, { booked: 50, status: "Full" });

      const res = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      expect(res.status).toBe(400);
    });

    it("should reject booking for cancelled slot", async () => {
      await Slot.findByIdAndUpdate(slotId, { status: "Cancelled" });

      const res = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      expect(res.status).toBe(400);
    });

    it("should reject booking for unavailable menu item", async () => {
      await MenuItem.findByIdAndUpdate(menuItemId, { isAvailable: false });

      const res = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      expect(res.status).toBe(400);
    });

    it("should reject booking without auth", async () => {
      const res = await request(app)
        .post("/api/bookings")
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      expect(res.status).toBe(401);
    });
  });

  // ==================== MY BOOKINGS ====================
  describe("GET /api/bookings/my", () => {
    it("should return user bookings", async () => {
      // Create a booking first
      await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      const res = await request(app)
        .get("/api/bookings/my")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== CANCEL BOOKING ====================
  describe("POST /api/bookings/:id/cancel", () => {
    let bookingId;

    beforeEach(async () => {
      const bookRes = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });
      bookingId = bookRes.body.data.id;
    });

    it("should cancel own booking", async () => {
      const res = await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ reason: "Changed plans" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("cancelled");
    });

    it("should decrement slot booked count on cancel", async () => {
      const slotBefore = await Slot.findById(slotId);
      const bookedBefore = slotBefore.booked;

      await request(app)
        .post(`/api/bookings/${bookingId}/cancel`)
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ reason: "Changed plans" });

      const slotAfter = await Slot.findById(slotId);
      expect(slotAfter.booked).toBe(bookedBefore - 1);
    });
  });

  // ==================== COMPLETE BOOKING (Staff) ====================
  describe("POST /api/bookings/:id/complete", () => {
    let bookingId;

    beforeEach(async () => {
      const bookRes = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });
      bookingId = bookRes.body.data.id;
    });

    it("should complete booking (staff)", async () => {
      const res = await request(app)
        .post(`/api/bookings/${bookingId}/complete`)
        .set("Authorization", `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("completed");
    });

    it("should reject completing already completed booking", async () => {
      await request(app)
        .post(`/api/bookings/${bookingId}/complete`)
        .set("Authorization", `Bearer ${staffToken}`);

      const res = await request(app)
        .post(`/api/bookings/${bookingId}/complete`)
        .set("Authorization", `Bearer ${staffToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ==================== TOKEN LOOKUP (Staff) ====================
  describe("GET /api/bookings/token/:tokenNumber", () => {
    it("should find booking by token number", async () => {
      const bookRes = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      const tokenNumber = bookRes.body.data.tokenNumber;

      const res = await request(app)
        .get(`/api/bookings/token/${tokenNumber}`)
        .set("Authorization", `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tokenNumber).toBe(tokenNumber);
    });

    it("should return 404 for non-existent token", async () => {
      const res = await request(app)
        .get("/api/bookings/token/T-0000")
        .set("Authorization", `Bearer ${staffToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ==================== WALK-IN BOOKING (Staff) ====================
  describe("POST /api/bookings/walkin", () => {
    it("should create walk-in booking (staff)", async () => {
      const res = await request(app)
        .post("/api/bookings/walkin")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          slotId: slotId.toString(),
          guestName: "Walk-in Guest",
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.isWalkin).toBe(true);
      expect(res.body.data.guestName).toBe("Walk-in Guest");
      expect(res.body.data.tokenNumber).toBeDefined();
    });

    it("should reject walk-in booking from student", async () => {
      const res = await request(app)
        .post("/api/bookings/walkin")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          guestName: "Guest",
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      expect(res.status).toBe(403);
    });
  });

  // ==================== NO-SHOW (Staff) ====================
  describe("POST /api/bookings/:id/no-show", () => {
    it("should mark booking as no-show", async () => {
      const bookRes = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      const res = await request(app)
        .post(`/api/bookings/${bookRes.body.data.id}/no-show`)
        .set("Authorization", `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("no_show");
    });
  });

  // ==================== BOOKING STATS (Management) ====================
  describe("GET /api/bookings/stats", () => {
    it("should return booking statistics (manager)", async () => {
      // Create and complete a booking
      const bookRes = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 2 }],
        });

      await request(app)
        .post(`/api/bookings/${bookRes.body.data.id}/complete`)
        .set("Authorization", `Bearer ${staffToken}`);

      const res = await request(app)
        .get("/api/bookings/stats")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalBookings).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== ALL BOOKINGS (Management) ====================
  describe("GET /api/bookings", () => {
    it("should list all bookings (manager)", async () => {
      await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          slotId: slotId.toString(),
          items: [{ menuItemId: menuItemId.toString(), quantity: 1 }],
        });

      const res = await request(app)
        .get("/api/bookings")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });

    it("should reject listing for student", async () => {
      const res = await request(app)
        .get("/api/bookings")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });
});
