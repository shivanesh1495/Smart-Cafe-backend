/**
 * End-to-End Integration Tests: Forecast
 * Tests daily/weekly forecasts, record actuals, accuracy metrics
 * Real MongoDB, no mocks
 */
const request = require("supertest");
const app = require("../../app");
const { Forecast } = require("../../models");

const createUserAndLogin = async (data) => {
  await request(app).post("/api/auth/register").send(data);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: data.email, password: data.password });
  return loginRes.body.data.token;
};

describe("Forecast E2E Integration", () => {
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

  // ==================== DAILY FORECAST ====================
  describe("GET /api/forecast/daily", () => {
    it("should return daily forecast (manager)", async () => {
      const res = await request(app)
        .get("/api/forecast/daily")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should accept date parameter", async () => {
      const res = await request(app)
        .get("/api/forecast/daily?date=2024-06-15")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
    });

    it("should reject student", async () => {
      const res = await request(app)
        .get("/api/forecast/daily")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==================== WEEKLY FORECAST ====================
  describe("GET /api/forecast/weekly", () => {
    it("should return weekly forecast (manager)", async () => {
      const res = await request(app)
        .get("/api/forecast/weekly")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should reject student", async () => {
      const res = await request(app)
        .get("/api/forecast/weekly")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==================== RECORD ACTUAL (Admin-only) ====================
  describe("POST /api/forecast/record-actual", () => {
    it("should record actual consumption (admin)", async () => {
      // Seed a forecast document first (recordActual updates existing forecast)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await Forecast.create({
        date: today,
        mealType: "LUNCH",
        predictedCount: 200,
      });

      const res = await request(app)
        .post("/api/forecast/record-actual")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          date: new Date().toISOString().split("T")[0],
          mealType: "LUNCH",
          actualCount: 150,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.actualCount).toBe(150);
    });

    it("should reject manager (admin-only)", async () => {
      const res = await request(app)
        .post("/api/forecast/record-actual")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          date: new Date().toISOString().split("T")[0],
          mealType: "lunch",
          actualCount: 150,
        });

      expect(res.status).toBe(403);
    });
  });

  // ==================== ACCURACY METRICS ====================
  describe("GET /api/forecast/accuracy", () => {
    it("should return accuracy metrics (manager)", async () => {
      const res = await request(app)
        .get("/api/forecast/accuracy")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should reject student", async () => {
      const res = await request(app)
        .get("/api/forecast/accuracy")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });
});
