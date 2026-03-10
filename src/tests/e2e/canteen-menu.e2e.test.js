/**
 * End-to-End Integration Tests: Canteen & Menu Management
 * Tests canteen CRUD, menu CRUD, and menu item operations
 * Real MongoDB, no mocks
 */
const request = require("supertest");
const app = require("../../app");
const { Canteen, MenuItem, Menu } = require("../../models");

const createUserAndLogin = async (data) => {
  await request(app).post("/api/auth/register").send(data);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: data.email, password: data.password });
  return loginRes.body.data.token;
};

describe("Canteen & Menu E2E Integration", () => {
  let managerToken, studentToken, adminToken;

  beforeEach(async () => {
    managerToken = await createUserAndLogin({
      fullName: "Manager",
      email: "manager@cafe.com",
      password: "manager123",
      role: "manager",
    });
    studentToken = await createUserAndLogin({
      fullName: "Student",
      email: "student@uni.com",
      password: "student123",
      role: "user",
    });
    adminToken = await createUserAndLogin({
      fullName: "Admin",
      email: "admin@cafe.com",
      password: "admin12345",
      role: "admin",
    });
  });

  // ==================== CANTEEN CRUD ====================
  describe("Canteen API", () => {
    it("should create canteen (manager)", async () => {
      const res = await request(app)
        .post("/api/canteens")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          name: "North Wing Canteen",
          location: "Building B, Floor 1",
          capacity: 150,
          status: "Open",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("North Wing Canteen");
      expect(res.body.data.capacity).toBe(150);
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.id).toBeDefined();
    });

    it("should list canteens publicly", async () => {
      await Canteen.create({
        name: "Canteen A",
        capacity: 100,
        status: "Open",
      });
      await Canteen.create({
        name: "Canteen B",
        capacity: 80,
        status: "Closed",
      });

      const res = await request(app).get("/api/canteens");
      expect(res.status).toBe(200);
      expect(res.body.data.canteens.length).toBe(2);
    });

    it("should get canteen by ID", async () => {
      const canteen = await Canteen.create({
        name: "Test Canteen",
        capacity: 100,
      });

      const res = await request(app).get(`/api/canteens/${canteen._id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Test Canteen");
    });

    it("should update canteen (manager)", async () => {
      const canteen = await Canteen.create({
        name: "Old Name",
        capacity: 100,
      });

      const res = await request(app)
        .patch(`/api/canteens/${canteen._id}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ name: "New Name", capacity: 200 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("New Name");
      expect(res.body.data.capacity).toBe(200);
    });

    it("should toggle canteen status (manager)", async () => {
      const canteen = await Canteen.create({
        name: "Toggle Canteen",
        capacity: 100,
        isActive: true,
      });

      const res = await request(app)
        .patch(`/api/canteens/${canteen._id}/toggle`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it("should update occupancy and auto-set crowd level (manager)", async () => {
      const canteen = await Canteen.create({
        name: "Crowd Canteen",
        capacity: 100,
        occupancy: 0,
      });

      // Low crowd (< 40%)
      let res = await request(app)
        .patch(`/api/canteens/${canteen._id}/occupancy`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ occupancy: 20 });

      expect(res.body.data.crowd).toBe("Low");

      // Medium crowd (40-75%)
      res = await request(app)
        .patch(`/api/canteens/${canteen._id}/occupancy`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ occupancy: 60 });

      expect(res.body.data.crowd).toBe("Medium");

      // High crowd (> 75%)
      res = await request(app)
        .patch(`/api/canteens/${canteen._id}/occupancy`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ occupancy: 90 });

      expect(res.body.data.crowd).toBe("High");
    });

    it("should delete canteen (manager)", async () => {
      const canteen = await Canteen.create({
        name: "Delete Me",
        capacity: 50,
      });

      const res = await request(app)
        .delete(`/api/canteens/${canteen._id}`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);

      const deleted = await Canteen.findById(canteen._id);
      expect(deleted).toBeNull();
    });

    it("should reject canteen creation by student", async () => {
      const res = await request(app)
        .post("/api/canteens")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ name: "Unauthorized", capacity: 50 });

      expect(res.status).toBe(403);
    });
  });

  // ==================== MENU CRUD ====================
  describe("Menu API", () => {
    it("should create menu (manager)", async () => {
      const today = new Date().toISOString().split("T")[0];

      const res = await request(app)
        .post("/api/menus")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          menuDate: today,
          mealType: "LUNCH",
          isActive: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.mealType).toBe("LUNCH");
    });

    it("should reject duplicate menu (same date + meal type)", async () => {
      const today = new Date().toISOString().split("T")[0];

      await request(app)
        .post("/api/menus")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ menuDate: today, mealType: "BREAKFAST" });

      const res = await request(app)
        .post("/api/menus")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ menuDate: today, mealType: "BREAKFAST" });

      expect(res.status).toBe(409);
    });

    it("should list menus publicly", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await Menu.create({ menuDate: today, mealType: "LUNCH", isActive: true });

      const res = await request(app).get("/api/menus");
      expect(res.status).toBe(200);
    });

    it("should update menu (manager)", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const menu = await Menu.create({
        menuDate: today,
        mealType: "DINNER",
        isActive: true,
      });

      const res = await request(app)
        .patch(`/api/menus/${menu._id}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it("should delete menu (manager)", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const menu = await Menu.create({
        menuDate: today,
        mealType: "SNACKS",
        isActive: true,
      });

      const res = await request(app)
        .delete(`/api/menus/${menu._id}`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ==================== MENU ITEMS CRUD ====================
  describe("Menu Items API", () => {
    it("should create, update, and delete menu items", async () => {
      // Create
      const createRes = await request(app)
        .post("/api/menu-items")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          itemName: "Paneer Butter Masala",
          price: 120,
          category: "LUNCH",
          dietaryType: "Veg",
          isVeg: true,
          allergens: ["dairy"],
          ecoScore: "B",
        });

      expect(createRes.status).toBe(201);
      const itemId = createRes.body.data.id;

      // Update
      const updateRes = await request(app)
        .patch(`/api/menu-items/${itemId}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ price: 130, description: "Rich and creamy" });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.price).toBe(130);

      // Delete
      const deleteRes = await request(app)
        .delete(`/api/menu-items/${itemId}`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(deleteRes.status).toBe(200);
    });

    it("should filter menu items by category", async () => {
      await MenuItem.create({
        itemName: "Breakfast Item",
        price: 30,
        category: "BREAKFAST",
      });
      await MenuItem.create({
        itemName: "Lunch Item",
        price: 80,
        category: "LUNCH",
      });

      const res = await request(app).get("/api/menu-items?category=BREAKFAST");
      expect(res.status).toBe(200);
      expect(res.body.data.every((item) => item.category === "BREAKFAST")).toBe(
        true,
      );
    });

    it("should filter menu items by dietary type", async () => {
      await MenuItem.create({
        itemName: "Veg Item",
        price: 50,
        dietaryType: "Veg",
        isVeg: true,
      });
      await MenuItem.create({
        itemName: "Non-Veg Item",
        price: 100,
        dietaryType: "Non-Veg",
        isVeg: false,
      });

      const res = await request(app).get("/api/menu-items?dietaryType=Veg");
      expect(res.status).toBe(200);
      expect(res.body.data.every((item) => item.dietaryType === "Veg")).toBe(
        true,
      );
    });
  });
});
