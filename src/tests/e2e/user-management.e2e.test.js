/**
 * End-to-End Integration Tests: User Management (Admin)
 * Tests user CRUD, role management, status management
 * Real MongoDB, no mocks
 */
const request = require("supertest");
const app = require("../../app");
const { User } = require("../../models");

const createUserAndLogin = async (data) => {
  await request(app).post("/api/auth/register").send(data);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: data.email, password: data.password });
  return loginRes.body.data.token;
};

describe("User Management E2E Integration", () => {
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

  // ==================== USER LIST ====================
  describe("GET /api/users", () => {
    it("should list all users (admin)", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBe(3); // admin, manager, student
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.total).toBe(3);
    });

    it("should filter users by role", async () => {
      const res = await request(app)
        .get("/api/users?role=admin")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.every((u) => u.role === "admin")).toBe(true);
    });

    it("should search users by name", async () => {
      const res = await request(app)
        .get("/api/users?search=Student")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it("should reject for non-admin users", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it("should allow manager (management route)", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });
  });

  // ==================== USER STATS ====================
  describe("GET /api/users/stats", () => {
    it("should return user statistics (manager)", async () => {
      const res = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.active).toBe(3);
      expect(res.body.data.byRole).toBeDefined();
      expect(Array.isArray(res.body.data.byRole)).toBe(true);
    });

    it("should reject for student", async () => {
      const res = await request(app)
        .get("/api/users/stats")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==================== USER CREATE (Admin) ====================
  describe("POST /api/users", () => {
    it("should create user (admin)", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          fullName: "New Staff",
          email: "newstaff@cafe.com",
          password: "newstaff123",
          role: "canteen_staff",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe("newstaff@cafe.com");
      expect(res.body.data.role).toBe("canteen_staff");
    });

    it("should reject duplicate email", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          fullName: "Duplicate",
          email: "student@uni.com", // already exists
          password: "pass123456",
          role: "user",
        });

      expect(res.status).toBe(409);
    });
  });

  // ==================== ROLE MANAGEMENT ====================
  describe("PATCH /api/users/:id/role", () => {
    it("should update user role (admin)", async () => {
      const user = await User.findOne({ email: "student@uni.com" });

      const res = await request(app)
        .patch(`/api/users/${user._id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "manager" });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe("manager");
    });

    it("should reject role update by non-admin", async () => {
      const user = await User.findOne({ email: "student@uni.com" });

      const res = await request(app)
        .patch(`/api/users/${user._id}/role`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ role: "admin" });

      expect(res.status).toBe(403);
    });
  });

  // ==================== STATUS MANAGEMENT ====================
  describe("PATCH /api/users/:id/status", () => {
    it("should suspend user (admin)", async () => {
      const user = await User.findOne({ email: "student@uni.com" });

      const res = await request(app)
        .patch(`/api/users/${user._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "suspended" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("suspended");
    });

    it("should reactivate suspended user", async () => {
      const user = await User.findOne({ email: "student@uni.com" });
      await User.findByIdAndUpdate(user._id, { status: "suspended" });

      const res = await request(app)
        .patch(`/api/users/${user._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "active" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("active");
    });
  });

  // ==================== DELETE USER ====================
  describe("DELETE /api/users/:id", () => {
    it("should delete user (admin)", async () => {
      const user = await User.findOne({ email: "student@uni.com" });

      const res = await request(app)
        .delete(`/api/users/${user._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const deleted = await User.findById(user._id);
      expect(deleted).toBeNull();
    });
  });

  // ==================== FORCE LOGOUT ====================
  describe("POST /api/users/:id/force-logout", () => {
    it("should force logout user (admin)", async () => {
      const user = await User.findOne({ email: "student@uni.com" });
      await User.findByIdAndUpdate(user._id, { isOnline: true });

      const res = await request(app)
        .post(`/api/users/${user._id}/force-logout`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const updated = await User.findById(user._id);
      expect(updated.isOnline).toBe(false);
    });
  });
});
