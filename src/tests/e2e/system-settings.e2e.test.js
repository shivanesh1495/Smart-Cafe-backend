/**
 * End-to-End Integration Tests: System Settings
 * Tests system settings CRUD, grouped, bulk update
 * Real MongoDB, no mocks
 */
const request = require("supertest");
const app = require("../../app");
const { SystemSetting } = require("../../models");

const createUserAndLogin = async (data) => {
  await request(app).post("/api/auth/register").send(data);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: data.email, password: data.password });
  return loginRes.body.data.token;
};

describe("System Settings E2E Integration", () => {
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

  // ==================== CREATE / UPSERT ====================
  describe("POST /api/system", () => {
    it("should create a new setting (admin)", async () => {
      const res = await request(app)
        .post("/api/system")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          settingKey: "MAX_BOOKINGS_PER_DAY",
          settingValue: "5",
          category: "BOOKING",
          description: "Maximum bookings per user per day",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.settingKey).toBe("MAX_BOOKINGS_PER_DAY");
      expect(res.body.data.settingValue).toBe("5");
    });

    it("should upsert existing setting", async () => {
      await SystemSetting.create({
        settingKey: "MAX_BOOKINGS_PER_DAY",
        settingValue: "5",
        category: "BOOKING",
      });

      const res = await request(app)
        .post("/api/system")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          settingKey: "MAX_BOOKINGS_PER_DAY",
          settingValue: "10",
          category: "BOOKING",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.settingValue).toBe("10");
    });

    it("should reject non-admin", async () => {
      const res = await request(app)
        .post("/api/system")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ settingKey: "TEST", settingValue: "1", category: "GENERAL" });

      expect(res.status).toBe(403);
    });

    it("should reject manager (admin-only)", async () => {
      const res = await request(app)
        .post("/api/system")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ settingKey: "TEST", settingValue: "1", category: "GENERAL" });

      expect(res.status).toBe(403);
    });
  });

  // ==================== GET ALL ====================
  describe("GET /api/system", () => {
    it("should get all settings", async () => {
      await SystemSetting.create([
        { settingKey: "SETTING_A", settingValue: "a", category: "GENERAL" },
        { settingKey: "SETTING_B", settingValue: "b", category: "BOOKING" },
      ]);

      const res = await request(app)
        .get("/api/system")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it("should filter by category", async () => {
      await SystemSetting.create([
        { settingKey: "SETTING_A", settingValue: "a", category: "GENERAL" },
        { settingKey: "SETTING_B", settingValue: "b", category: "BOOKING" },
      ]);

      const res = await request(app)
        .get("/api/system?category=BOOKING")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].settingKey).toBe("SETTING_B");
    });
  });

  // ==================== GET GROUPED ====================
  describe("GET /api/system/grouped", () => {
    it("should return settings grouped by category", async () => {
      await SystemSetting.create([
        { settingKey: "A1", settingValue: "v", category: "GENERAL" },
        { settingKey: "A2", settingValue: "v", category: "GENERAL" },
        { settingKey: "B1", settingValue: "v", category: "BOOKING" },
      ]);

      const res = await request(app)
        .get("/api/system/grouped")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // ==================== GET BY KEY ====================
  describe("GET /api/system/:key", () => {
    it("should get setting by key", async () => {
      await SystemSetting.create({
        settingKey: "MY_SETTING",
        settingValue: "42",
        dataType: "NUMBER",
        category: "GENERAL",
      });

      const res = await request(app)
        .get("/api/system/MY_SETTING")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.settingKey).toBe("MY_SETTING");
      expect(res.body.data.settingValue).toBe("42");
    });
  });

  // ==================== UPDATE VALUE ====================
  describe("PATCH /api/system/:key", () => {
    it("should update setting value", async () => {
      await SystemSetting.create({
        settingKey: "MAX_CAPACITY",
        settingValue: "100",
        category: "CAPACITY",
      });

      const res = await request(app)
        .patch("/api/system/MAX_CAPACITY")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ value: "200" });

      expect(res.status).toBe(200);
      expect(res.body.data.settingValue).toBe("200");
    });
  });

  // ==================== BULK UPDATE ====================
  describe("POST /api/system/bulk", () => {
    it("should bulk update settings", async () => {
      await SystemSetting.create([
        { settingKey: "SETTING_X", settingValue: "1", category: "GENERAL" },
        { settingKey: "SETTING_Y", settingValue: "2", category: "GENERAL" },
      ]);

      const res = await request(app)
        .post("/api/system/bulk")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          settings: [
            { key: "SETTING_X", value: "10" },
            { key: "SETTING_Y", value: "20" },
          ],
        });

      expect(res.status).toBe(200);
    });
  });

  // ==================== DELETE ====================
  describe("DELETE /api/system/:key", () => {
    it("should delete setting", async () => {
      await SystemSetting.create({
        settingKey: "DELETEME",
        settingValue: "x",
        category: "GENERAL",
      });

      const res = await request(app)
        .delete("/api/system/DELETEME")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const deleted = await SystemSetting.findOne({ settingKey: "DELETEME" });
      expect(deleted).toBeNull();
    });
  });
});
