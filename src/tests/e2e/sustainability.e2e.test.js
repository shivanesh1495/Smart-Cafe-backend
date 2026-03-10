/**
 * End-to-End Integration Tests: Sustainability
 * Tests waste reports, stats, metrics
 * Real MongoDB, no mocks
 */
const request = require("supertest");
const app = require("../../app");
const { WasteReport, User } = require("../../models");

const createUserAndLogin = async (data) => {
  await request(app).post("/api/auth/register").send(data);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: data.email, password: data.password });
  return loginRes.body.data.token;
};

describe("Sustainability E2E Integration", () => {
  let managerToken, studentToken;
  let studentId;

  beforeEach(async () => {
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

    const student = await User.findOne({ email: "student@uni.com" });
    studentId = student._id;
  });

  // ==================== SUBMIT WASTE REPORT ====================
  describe("POST /api/sustainability/waste-report", () => {
    it("should submit waste report (student)", async () => {
      const res = await request(app)
        .post("/api/sustainability/waste-report")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          wasteAmount: "Some",
          reason: "Too much food",
          mealType: "LUNCH",
          notes: "Could not finish the rice",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.wasteAmount).toBe("Some");
      expect(res.body.data.reason).toBe("Too much food");
    });

    it("should submit waste report (manager)", async () => {
      const res = await request(app)
        .post("/api/sustainability/waste-report")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          wasteAmount: "Little",
          reason: "Too much food",
          mealType: "BREAKFAST",
        });

      expect(res.status).toBe(201);
    });

    it("should reject unauthenticated", async () => {
      const res = await request(app)
        .post("/api/sustainability/waste-report")
        .send({ wasteAmount: "None", reason: "Not hungry", mealType: "LUNCH" });

      expect(res.status).toBe(401);
    });
  });

  // ==================== GET MY REPORTS ====================
  describe("GET /api/sustainability/my-reports", () => {
    it("should return user waste reports", async () => {
      await WasteReport.create([
        {
          user: studentId,
          wasteAmount: "Some",
          reason: "Too much food",
          mealType: "LUNCH",
        },
        {
          user: studentId,
          wasteAmount: "Little",
          reason: "Not hungry",
          mealType: "DINNER",
        },
      ]);

      const res = await request(app)
        .get("/api/sustainability/my-reports")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.pagination).toBeDefined();
    });
  });

  // ==================== WASTE STATS (Management) ====================
  describe("GET /api/sustainability/stats", () => {
    it("should return waste statistics (manager)", async () => {
      await WasteReport.create([
        {
          user: studentId,
          wasteAmount: "Some",
          reason: "Too much food",
          mealType: "LUNCH",
          date: new Date(),
        },
        {
          user: studentId,
          wasteAmount: "Most",
          reason: "Did not like the taste",
          mealType: "DINNER",
          date: new Date(),
        },
        {
          user: studentId,
          wasteAmount: "None",
          reason: "Other",
          mealType: "BREAKFAST",
          date: new Date(),
        },
      ]);

      const res = await request(app)
        .get("/api/sustainability/stats")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should reject student", async () => {
      const res = await request(app)
        .get("/api/sustainability/stats")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==================== SUSTAINABILITY METRICS (All Authenticated) ====================
  describe("GET /api/sustainability/metrics", () => {
    it("should return sustainability metrics (manager)", async () => {
      const res = await request(app)
        .get("/api/sustainability/metrics")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should return sustainability metrics for student (personal eco-score)", async () => {
      const res = await request(app)
        .get("/api/sustainability/metrics")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.currentEcoScore).toBeDefined();
    });
  });
});
