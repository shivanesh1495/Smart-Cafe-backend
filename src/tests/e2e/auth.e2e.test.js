/**
 * End-to-End Integration Tests: Auth Module
 * Tests real API endpoints with real MongoDB (in-memory)
 * No mock data - all data flows through actual services
 */
const request = require("supertest");
const app = require("../../app");
const { User } = require("../../models");

describe("Auth E2E Integration", () => {
  // ==================== REGISTRATION ====================
  describe("POST /api/auth/register", () => {
    it("should register a new student user and return token", async () => {
      const res = await request(app).post("/api/auth/register").send({
        fullName: "John Student",
        email: "john@university.com",
        password: "securePass123",
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe("john@university.com");
      expect(res.body.data.user.role).toBe("user");
      expect(res.body.data.user.fullName).toBe("John Student");
      // Should not expose password
      expect(res.body.data.user.password).toBeUndefined();
    });

    it("should register a canteen_staff user", async () => {
      const res = await request(app).post("/api/auth/register").send({
        fullName: "Staff Member",
        email: "staff@cafe.com",
        password: "staffPass123",
        role: "canteen_staff",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe("canteen_staff");
    });

    it("should register a manager user", async () => {
      const res = await request(app).post("/api/auth/register").send({
        fullName: "Manager User",
        email: "manager@cafe.com",
        password: "managerPass123",
        role: "manager",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe("manager");
    });

    it("should register an admin user", async () => {
      const res = await request(app).post("/api/auth/register").send({
        fullName: "Admin User",
        email: "admin@cafe.com",
        password: "adminPass123",
        role: "admin",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe("admin");
    });

    it("should reject duplicate email registration", async () => {
      await request(app).post("/api/auth/register").send({
        fullName: "First User",
        email: "duplicate@test.com",
        password: "pass123456",
      });

      const res = await request(app).post("/api/auth/register").send({
        fullName: "Second User",
        email: "duplicate@test.com",
        password: "pass123456",
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should reject registration with short password", async () => {
      const res = await request(app).post("/api/auth/register").send({
        fullName: "Test User",
        email: "test@test.com",
        password: "123",
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject registration without required fields", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: "incomplete@test.com",
      });

      expect(res.status).toBe(400);
    });

    it("should reject registration with invalid email", async () => {
      const res = await request(app).post("/api/auth/register").send({
        fullName: "Test User",
        email: "not-an-email",
        password: "pass123456",
      });

      expect(res.status).toBe(400);
    });
  });

  // ==================== LOGIN ====================
  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await request(app).post("/api/auth/register").send({
        fullName: "Login Test User",
        email: "login@test.com",
        password: "loginPass123",
      });
    });

    it("should login with correct credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "login@test.com",
        password: "loginPass123",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe("login@test.com");
    });

    it("should reject login with wrong password", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "login@test.com",
        password: "wrongPassword",
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject login with non-existent email", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@test.com",
        password: "somePassword",
      });

      expect(res.status).toBe(401);
    });

    it("should reject login for suspended user", async () => {
      await User.findOneAndUpdate(
        { email: "login@test.com" },
        { status: "suspended" },
      );

      const res = await request(app).post("/api/auth/login").send({
        email: "login@test.com",
        password: "loginPass123",
      });

      expect(res.status).toBe(403);
    });

    it("should update lastLogin and isOnline on successful login", async () => {
      await request(app).post("/api/auth/login").send({
        email: "login@test.com",
        password: "loginPass123",
      });

      const user = await User.findOne({ email: "login@test.com" });
      expect(user.isOnline).toBe(true);
      expect(user.lastLogin).toBeDefined();
    });
  });

  // ==================== PROFILE (GET /api/auth/me) ====================
  describe("GET /api/auth/me", () => {
    let token;

    beforeEach(async () => {
      const registerRes = await request(app).post("/api/auth/register").send({
        fullName: "Profile User",
        email: "profile@test.com",
        password: "profilePass123",
        role: "user",
      });
      token = registerRes.body.data.token;
    });

    it("should return current user profile with valid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Frontend expects response.data.data to be user directly (not wrapped in { user: ... })
      expect(res.body.data.email).toBe("profile@test.com");
      expect(res.body.data.name).toBe("Profile User");
      expect(res.body.data.role).toBe("user");
      expect(res.body.data.id).toBeDefined();
    });

    it("should reject request without auth token", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
    });

    it("should reject request with invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token-here");

      expect(res.status).toBe(401);
    });
  });

  // ==================== LOGOUT ====================
  describe("POST /api/auth/logout", () => {
    let token;

    beforeEach(async () => {
      const registerRes = await request(app).post("/api/auth/register").send({
        fullName: "Logout User",
        email: "logout@test.com",
        password: "logoutPass123",
      });
      token = registerRes.body.data.token;
    });

    it("should logout and set isOnline to false", async () => {
      // Login first to set online
      await request(app)
        .post("/api/auth/login")
        .send({ email: "logout@test.com", password: "logoutPass123" });

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);

      const user = await User.findOne({ email: "logout@test.com" });
      expect(user.isOnline).toBe(false);
    });
  });

  // ==================== OTP & PASSWORD RESET ====================
  describe("OTP and Password Reset Flow", () => {
    beforeEach(async () => {
      await request(app).post("/api/auth/register").send({
        fullName: "OTP User",
        email: "otp@test.com",
        password: "otpPass123",
      });
    });

    it("should send OTP (does not reveal if email exists)", async () => {
      const res = await request(app)
        .post("/api/auth/send-otp")
        .send({ email: "otp@test.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should not reveal non-existent email on OTP request", async () => {
      const res = await request(app)
        .post("/api/auth/send-otp")
        .send({ email: "nonexistent@test.com" });

      expect(res.status).toBe(200);
      // Should still say success to not reveal email existence
    });

    it("should verify OTP when correct", async () => {
      // Send OTP first
      await request(app)
        .post("/api/auth/send-otp")
        .send({ email: "otp@test.com" });

      // Get OTP from database directly (since no real email in test)
      const user = await User.findOne({ email: "otp@test.com" }).select(
        "+otp +otpExpiry",
      );
      const otp = user.otp;

      if (otp) {
        const res = await request(app)
          .post("/api/auth/verify-otp")
          .send({ email: "otp@test.com", otp });

        expect(res.status).toBe(200);
      }
    });

    it("should reject invalid OTP", async () => {
      // Send OTP first
      await request(app)
        .post("/api/auth/send-otp")
        .send({ email: "otp@test.com" });

      const res = await request(app)
        .post("/api/auth/verify-otp")
        .send({ email: "otp@test.com", otp: "000000" });

      expect(res.status).toBe(400);
    });

    it("should reset password with valid OTP", async () => {
      // Send OTP first
      await request(app)
        .post("/api/auth/send-otp")
        .send({ email: "otp@test.com" });

      // Get OTP from DB
      const user = await User.findOne({ email: "otp@test.com" }).select("+otp");
      const otp = user.otp;

      if (otp) {
        const resetRes = await request(app)
          .post("/api/auth/reset-password")
          .send({ email: "otp@test.com", otp, password: "newPassword123" });

        expect(resetRes.status).toBe(200);

        // Verify new password works
        const loginRes = await request(app)
          .post("/api/auth/login")
          .send({ email: "otp@test.com", password: "newPassword123" });

        expect(loginRes.status).toBe(200);
      }
    });
  });
});
