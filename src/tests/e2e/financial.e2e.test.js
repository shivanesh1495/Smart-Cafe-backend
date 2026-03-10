/**
 * End-to-End Integration Tests: Financial Management
 * Tests transactions, expenses, daily/monthly summaries, settlement
 * Real MongoDB, no mocks
 */
const request = require("supertest");
const app = require("../../app");
const FinancialTransaction = require("../../models/FinancialTransaction");
const { User, Canteen } = require("../../models");

const createUserAndLogin = async (data) => {
  await request(app).post("/api/auth/register").send(data);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: data.email, password: data.password });
  return loginRes.body.data.token;
};

describe("Financial Management E2E Integration", () => {
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

  // ==================== CREATE TRANSACTION ====================
  describe("POST /api/financial", () => {
    it("should create transaction (manager)", async () => {
      const res = await request(app)
        .post("/api/financial")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          transactionType: "SALE",
          amount: 5000,
          description: "Daily meal sales",
          category: "BOOKING",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.transactionType).toBe("SALE");
      expect(res.body.data.amount).toBe(5000);
    });

    it("should reject from student", async () => {
      const res = await request(app)
        .post("/api/financial")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          transactionType: "SALE",
          amount: 100,
          description: "test",
          category: "BOOKING",
        });

      expect(res.status).toBe(403);
    });
  });

  // ==================== RECORD EXPENSE ====================
  describe("POST /api/financial/expense", () => {
    it("should record expense (manager)", async () => {
      const res = await request(app)
        .post("/api/financial/expense")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          amount: 2000,
          description: "Vegetable purchases",
          category: "STOCK_PURCHASE",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.transactionType).toBe("EXPENSE");
      expect(res.body.data.amount).toBeDefined();
    });
  });

  // ==================== GET TRANSACTIONS ====================
  describe("GET /api/financial", () => {
    it("should list transactions", async () => {
      await FinancialTransaction.create([
        {
          transactionType: "SALE",
          amount: 5000,
          description: "Sales",
          category: "BOOKING",
          date: new Date(),
        },
        {
          transactionType: "EXPENSE",
          amount: 2000,
          description: "Supplies",
          category: "STOCK_PURCHASE",
          date: new Date(),
        },
      ]);

      const res = await request(app)
        .get("/api/financial")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // ==================== GET TRANSACTION BY ID ====================
  describe("GET /api/financial/:id", () => {
    it("should get transaction by ID", async () => {
      const tx = await FinancialTransaction.create({
        transactionType: "SALE",
        amount: 3000,
        description: "Lunch sales",
        category: "BOOKING",
        date: new Date(),
      });

      const res = await request(app)
        .get(`/api/financial/${tx._id}`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(3000);
    });
  });

  // ==================== DAILY SUMMARY ====================
  describe("GET /api/financial/summary/daily", () => {
    it("should return daily summary", async () => {
      const today = new Date();
      await FinancialTransaction.create([
        {
          transactionType: "SALE",
          amount: 5000,
          description: "Sales",
          category: "BOOKING",
          date: today,
        },
        {
          transactionType: "EXPENSE",
          amount: 2000,
          description: "Supplies",
          category: "STOCK_PURCHASE",
          date: today,
        },
      ]);

      const res = await request(app)
        .get("/api/financial/summary/daily")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should accept date parameter", async () => {
      const res = await request(app)
        .get("/api/financial/summary/daily?date=2024-01-15")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
    });

    it("should include manual staff cash entry in canteen manager summary", async () => {
      const staffEmail = "cashstaff@cafe.com";
      const staffToken = await createUserAndLogin({
        fullName: "Cash Staff",
        email: staffEmail,
        password: "staff12345",
        role: "canteen_staff",
      });

      const canteen = await Canteen.create({
        name: "Test Canteen",
        capacity: 120,
      });

      await User.findOneAndUpdate(
        { email: staffEmail },
        { canteenId: canteen._id },
      );

      const cashAmount = 130;
      const cashRes = await request(app)
        .post("/api/staff/cash")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ amount: cashAmount });

      expect(cashRes.status).toBe(201);

      const summaryRes = await request(app)
        .get(`/api/financial/summary/daily?canteenId=${canteen._id.toString()}`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.data.totalRevenue).toBe(cashAmount);

      const cashBucket = summaryRes.body.data.byPaymentMethod.find(
        (row) => row._id === "CASH",
      );
      expect(cashBucket).toBeDefined();
      expect(cashBucket.total).toBe(cashAmount);
    });
  });

  // ==================== MONTHLY SUMMARY ====================
  describe("GET /api/financial/summary/monthly", () => {
    it("should return monthly summary", async () => {
      const res = await request(app)
        .get("/api/financial/summary/monthly?year=2024&month=6")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should default to current month", async () => {
      const res = await request(app)
        .get("/api/financial/summary/monthly")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ==================== SETTLEMENT REPORT (Admin-only) ====================
  describe("GET /api/financial/settlement", () => {
    it("should return settlement report (admin)", async () => {
      const res = await request(app)
        .get(
          "/api/financial/settlement?startDate=2024-01-01&endDate=2024-12-31",
        )
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should require dates", async () => {
      const res = await request(app)
        .get("/api/financial/settlement")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it("should reject manager (admin-only)", async () => {
      const res = await request(app)
        .get(
          "/api/financial/settlement?startDate=2024-01-01&endDate=2024-12-31",
        )
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
