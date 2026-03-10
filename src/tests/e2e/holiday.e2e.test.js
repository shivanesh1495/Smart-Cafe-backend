/**
 * End-to-End Integration Tests: Holiday Management
 * Tests holiday CRUD, upcoming, check date
 * Real MongoDB, no mocks
 */
const request = require("supertest");
const app = require("../../app");
const { Holiday } = require("../../models");

const createUserAndLogin = async (data) => {
  await request(app).post("/api/auth/register").send(data);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: data.email, password: data.password });
  return loginRes.body.data.token;
};

describe("Holiday Management E2E Integration", () => {
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

  // ==================== CREATE HOLIDAY ====================
  describe("POST /api/holidays", () => {
    it("should create holiday (admin)", async () => {
      const res = await request(app)
        .post("/api/holidays")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Republic Day",
          date: "2025-01-26",
          description: "National holiday",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Republic Day");
    });

    it("should reject from manager", async () => {
      const res = await request(app)
        .post("/api/holidays")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          name: "Test Holiday",
          date: "2025-03-01",
        });

      expect(res.status).toBe(403);
    });

    it("should reject from student", async () => {
      const res = await request(app)
        .post("/api/holidays")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          name: "Fake Holiday",
          date: "2025-04-01",
        });

      expect(res.status).toBe(403);
    });
  });

  // ==================== GET ALL HOLIDAYS (Admin) ====================
  describe("GET /api/holidays", () => {
    it("should list all holidays (admin)", async () => {
      await Holiday.create([
        { name: "Independence Day", date: new Date("2025-08-15") },
        { name: "Diwali", date: new Date("2025-10-20") },
      ]);

      const res = await request(app)
        .get("/api/holidays")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should reject non-admin", async () => {
      const res = await request(app)
        .get("/api/holidays")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==================== UPCOMING HOLIDAYS (All authenticated) ====================
  describe("GET /api/holidays/upcoming", () => {
    it("should return upcoming holidays (student)", async () => {
      // Create a far-future holiday to ensure it shows up
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      await Holiday.create({
        name: "Upcoming Day",
        date: futureDate,
      });

      const res = await request(app)
        .get("/api/holidays/upcoming")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should accept days parameter", async () => {
      const res = await request(app)
        .get("/api/holidays/upcoming?days=90")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ==================== CHECK HOLIDAY ====================
  describe("GET /api/holidays/check", () => {
    it("should check if date is a holiday", async () => {
      await Holiday.create({
        name: "Christmas",
        date: new Date("2025-12-25"),
      });

      const res = await request(app)
        .get("/api/holidays/check?date=2025-12-25")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should return for non-holiday date", async () => {
      const res = await request(app)
        .get("/api/holidays/check?date=2025-06-17")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ==================== UPDATE HOLIDAY ====================
  describe("PUT /api/holidays/:id", () => {
    it("should update holiday (admin)", async () => {
      const holiday = await Holiday.create({
        name: "Test Holiday",
        date: new Date("2025-03-01"),
      });

      const res = await request(app)
        .put(`/api/holidays/${holiday._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Updated Holiday Name" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Holiday Name");
    });
  });

  // ==================== DELETE HOLIDAY ====================
  describe("DELETE /api/holidays/:id", () => {
    it("should delete holiday (admin)", async () => {
      const holiday = await Holiday.create({
        name: "Delete Me",
        date: new Date("2025-05-01"),
      });

      const res = await request(app)
        .delete(`/api/holidays/${holiday._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const deleted = await Holiday.findById(holiday._id);
      expect(deleted).toBeNull();
    });

    it("should reject from student", async () => {
      const holiday = await Holiday.create({
        name: "Protected",
        date: new Date("2025-06-01"),
      });

      const res = await request(app)
        .delete(`/api/holidays/${holiday._id}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });
});
