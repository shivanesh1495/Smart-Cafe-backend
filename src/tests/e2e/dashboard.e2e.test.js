/**
 * End-to-End Integration Tests: Dashboard
 * Tests admin, manager, staff, student dashboards with RBAC
 * Real MongoDB, no mocks
 */
const request = require("supertest");
const app = require("../../app");
const { User, Booking, Slot, MenuItem } = require("../../models");

const createUserAndLogin = async (data) => {
  await request(app).post("/api/auth/register").send(data);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: data.email, password: data.password });
  return loginRes.body.data.token;
};

describe("Dashboard E2E Integration", () => {
  let adminToken, managerToken, staffToken, studentToken;

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
    staffToken = await createUserAndLogin({
      fullName: "Staff User",
      email: "staff@cafe.com",
      password: "staff12345",
      role: "canteen_staff",
    });
    studentToken = await createUserAndLogin({
      fullName: "Student User",
      email: "student@uni.com",
      password: "student123",
      role: "user",
    });
  });

  // ==================== ADMIN DASHBOARD ====================
  describe("GET /api/dashboard/admin", () => {
    it("should return admin dashboard stats", async () => {
      const res = await request(app)
        .get("/api/dashboard/admin")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalUsers).toBeDefined();
      expect(res.body.data.activeUsers).toBeDefined();
      expect(res.body.data.todayBookings).toBeDefined();
      expect(res.body.data.todayRevenue).toBeDefined();
      expect(res.body.data.usersByRole).toBeDefined();
    });

    it("should show correct user counts", async () => {
      const res = await request(app)
        .get("/api/dashboard/admin")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.body.data.totalUsers).toBe(4);
      expect(res.body.data.activeUsers).toBe(4);
      expect(res.body.data.usersByRole.admin).toBe(1);
      expect(res.body.data.usersByRole.manager).toBe(1);
      expect(res.body.data.usersByRole.user).toBe(1);
    });

    it("should reject manager", async () => {
      const res = await request(app)
        .get("/api/dashboard/admin")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
    });

    it("should reject student", async () => {
      const res = await request(app)
        .get("/api/dashboard/admin")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==================== MANAGER DASHBOARD ====================
  describe("GET /api/dashboard/manager", () => {
    it("should return manager dashboard stats", async () => {
      const res = await request(app)
        .get("/api/dashboard/manager")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.bookingsByStatus).toBeDefined();
      expect(res.body.data.slotStats).toBeDefined();
      expect(res.body.data.popularItems).toBeDefined();
    });

    it("should also work for admin", async () => {
      const res = await request(app)
        .get("/api/dashboard/manager")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it("should reject student", async () => {
      const res = await request(app)
        .get("/api/dashboard/manager")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==================== STAFF DASHBOARD ====================
  describe("GET /api/dashboard/staff", () => {
    it("should return staff dashboard stats", async () => {
      const res = await request(app)
        .get("/api/dashboard/staff")
        .set("Authorization", `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pendingBookings).toBeDefined();
      expect(res.body.data.completedToday).toBeDefined();
    });

    it("should reject student", async () => {
      const res = await request(app)
        .get("/api/dashboard/staff")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ==================== STUDENT DASHBOARD ====================
  describe("GET /api/dashboard/student", () => {
    it("should return student dashboard", async () => {
      const res = await request(app)
        .get("/api/dashboard/student")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.myBookings).toBeDefined();
      expect(res.body.data.availableSlots).toBeDefined();
    });

    it("should reject admin", async () => {
      const res = await request(app)
        .get("/api/dashboard/student")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it("should reject manager", async () => {
      const res = await request(app)
        .get("/api/dashboard/student")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
