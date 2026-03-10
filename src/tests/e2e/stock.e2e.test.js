/**
 * End-to-End Integration Tests: Stock Management
 * Tests stock CRUD, restock, consume, adjust, alerts, transactions
 * Real MongoDB, no mocks
 */
const request = require("supertest");
const app = require("../../app");
const StockItem = require("../../models/StockItem");

const createUserAndLogin = async (data) => {
  await request(app).post("/api/auth/register").send(data);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: data.email, password: data.password });
  return loginRes.body.data.token;
};

describe("Stock Management E2E Integration", () => {
  let adminToken, managerToken, studentToken;

  beforeEach(async () => {
    adminToken = await createUserAndLogin({
      fullName: "Admin User",
      email: "admin@cafe.com",
      password: "admin12345",
      role: "admin",
    });
    managerToken = await createUserAndLogin({
      fullName: "Manager User",
      email: "manager@cafe.com",
      password: "manager123",
      role: "manager",
    });
    studentToken = await createUserAndLogin({
      fullName: "Student User",
      email: "student@uni.com",
      password: "student123",
      role: "user",
    });
  });

  // ==================== CREATE STOCK ITEM ====================
  describe("POST /api/stock", () => {
    it("should create stock item (manager)", async () => {
      const res = await request(app)
        .post("/api/stock")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          itemName: "Rice",
          category: "GRAINS",
          currentStock: 100,
          unit: "KG",
          minStockLevel: 20,
          unitPrice: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.itemName).toBe("Rice");
      expect(res.body.data.currentStock).toBe(100);
    });

    it("should reject stock creation from student", async () => {
      const res = await request(app)
        .post("/api/stock")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          itemName: "Rice",
          category: "GRAINS",
          currentStock: 100,
          unit: "KG",
        });

      expect(res.status).toBe(403);
    });
  });

  // ==================== GET STOCK ITEMS ====================
  describe("GET /api/stock", () => {
    it("should list stock items", async () => {
      await StockItem.create([
        {
          itemName: "Rice",
          category: "GRAINS",
          currentStock: 100,
          unit: "KG",
          minStockLevel: 20,
          unitPrice: 50,
        },
        {
          itemName: "Oil",
          category: "OILS",
          currentStock: 50,
          unit: "LITERS",
          minStockLevel: 10,
          unitPrice: 120,
        },
      ]);

      const res = await request(app)
        .get("/api/stock")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.stockItems || res.body.data.items).toBeDefined();
    });
  });

  // ==================== GET BY ID ====================
  describe("GET /api/stock/:id", () => {
    it("should get stock item by ID", async () => {
      const item = await StockItem.create({
        itemName: "Flour",
        category: "GRAINS",
        currentStock: 80,
        unit: "KG",
        minStockLevel: 15,
        unitPrice: 40,
      });

      const res = await request(app)
        .get(`/api/stock/${item._id}`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.itemName).toBe("Flour");
    });
  });

  // ==================== UPDATE STOCK ITEM ====================
  describe("PATCH /api/stock/:id", () => {
    it("should update stock item", async () => {
      const item = await StockItem.create({
        itemName: "Sugar",
        category: "OTHER",
        currentStock: 60,
        unit: "KG",
        minStockLevel: 10,
        unitPrice: 45,
      });

      const res = await request(app)
        .patch(`/api/stock/${item._id}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ minStockLevel: 25 });

      expect(res.status).toBe(200);
      expect(res.body.data.minStockLevel).toBe(25);
    });
  });

  // ==================== RESTOCK ====================
  describe("POST /api/stock/:id/restock", () => {
    it("should restock item", async () => {
      const item = await StockItem.create({
        itemName: "Salt",
        category: "SPICES",
        currentStock: 10,
        unit: "KG",
        minStockLevel: 5,
        unitPrice: 20,
      });

      const res = await request(app)
        .post(`/api/stock/${item._id}/restock`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ quantity: 50, unitPrice: 22 });

      expect(res.status).toBe(200);
      expect(res.body.data.currentStock).toBe(60); // 10 + 50
    });
  });

  // ==================== CONSUME ====================
  describe("POST /api/stock/:id/consume", () => {
    it("should consume stock", async () => {
      const item = await StockItem.create({
        itemName: "Milk",
        category: "DAIRY",
        currentStock: 40,
        unit: "LITERS",
        minStockLevel: 10,
        unitPrice: 60,
      });

      const res = await request(app)
        .post(`/api/stock/${item._id}/consume`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ quantity: 15, reason: "Morning tea preparation" });

      expect(res.status).toBe(200);
      expect(res.body.data.currentStock).toBe(25); // 40 - 15
    });
  });

  // ==================== ADJUST ====================
  describe("POST /api/stock/:id/adjust", () => {
    it("should adjust stock to specific quantity", async () => {
      const item = await StockItem.create({
        itemName: "Eggs",
        category: "PROTEINS",
        currentStock: 100,
        unit: "PIECES",
        minStockLevel: 30,
        unitPrice: 8,
      });

      const res = await request(app)
        .post(`/api/stock/${item._id}/adjust`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ newQuantity: 85, reason: "Audit correction" });

      expect(res.status).toBe(200);
      expect(res.body.data.currentStock).toBe(85);
    });
  });

  // ==================== LOW STOCK ALERTS ====================
  describe("GET /api/stock/alerts", () => {
    it("should return low stock alerts", async () => {
      await StockItem.create([
        {
          itemName: "Rice",
          category: "GRAINS",
          currentStock: 5,
          unit: "KG",
          minStockLevel: 20,
          unitPrice: 50,
        }, // low
        {
          itemName: "Oil",
          category: "OILS",
          currentStock: 100,
          unit: "LITERS",
          minStockLevel: 10,
          unitPrice: 120,
        }, // ok
      ]);

      const res = await request(app)
        .get("/api/stock/alerts")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.alerts).toBeDefined();
      expect(res.body.data.alerts.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.count).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== STOCK TRANSACTIONS ====================
  describe("GET /api/stock/transactions", () => {
    it("should return stock transactions after restock", async () => {
      const item = await StockItem.create({
        itemName: "Butter",
        category: "DAIRY",
        currentStock: 20,
        unit: "KG",
        minStockLevel: 5,
        unitPrice: 200,
      });

      // Perform a restock to generate a transaction
      await request(app)
        .post(`/api/stock/${item._id}/restock`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ quantity: 30, unitPrice: 210 });

      const res = await request(app)
        .get("/api/stock/transactions")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // ==================== STOCK SUMMARY ====================
  describe("GET /api/stock/summary", () => {
    it("should return stock summary", async () => {
      await StockItem.create([
        {
          itemName: "Rice",
          category: "GRAINS",
          currentStock: 100,
          unit: "KG",
          minStockLevel: 20,
          unitPrice: 50,
        },
        {
          itemName: "Oil",
          category: "OILS",
          currentStock: 5,
          unit: "LITERS",
          minStockLevel: 10,
          unitPrice: 120,
        },
      ]);

      const res = await request(app)
        .get("/api/stock/summary")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // ==================== DELETE STOCK ITEM (Admin-only) ====================
  describe("DELETE /api/stock/:id", () => {
    it("should soft-delete stock item (admin)", async () => {
      const item = await StockItem.create({
        itemName: "Expired Stock",
        category: "OTHER",
        currentStock: 0,
        unit: "KG",
        minStockLevel: 5,
        unitPrice: 10,
      });

      const res = await request(app)
        .delete(`/api/stock/${item._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Soft delete sets isActive = false
      const deleted = await StockItem.findById(item._id);
      expect(deleted.isActive).toBe(false);
    });

    it("should reject delete from manager (admin-only)", async () => {
      const item = await StockItem.create({
        itemName: "Stock Item",
        category: "OTHER",
        currentStock: 10,
        unit: "KG",
        minStockLevel: 5,
        unitPrice: 10,
      });

      const res = await request(app)
        .delete(`/api/stock/${item._id}`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
