/**
 * End-to-End Integration Tests: Notifications
 * Tests notification CRUD, broadcast, emergency, mark read
 * Real MongoDB, no mocks
 */
const request = require("supertest");
const app = require("../../app");
const { Notification, User } = require("../../models");

const createUserAndLogin = async (data) => {
  await request(app).post("/api/auth/register").send(data);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: data.email, password: data.password });
  return loginRes.body.data.token;
};

describe("Notification E2E Integration", () => {
  let adminToken, managerToken, staffToken, studentToken;
  let studentId, adminId;

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

    const student = await User.findOne({ email: "student@uni.com" });
    const admin = await User.findOne({ email: "admin@cafe.com" });
    studentId = student._id;
    adminId = admin._id;
  });

  // ==================== GET NOTIFICATIONS ====================
  describe("GET /api/notifications", () => {
    it("should return empty notifications initially", async () => {
      const res = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it("should return user-specific notifications", async () => {
      // Create notification directly
      await Notification.create({
        user: studentId,
        title: "Test Notification",
        message: "Hello student",
        type: "system",
      });
      await Notification.create({
        user: adminId,
        title: "Admin Notification",
        message: "Hello admin",
        type: "system",
      });

      const res = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe("Test Notification");
    });

    it("should filter unread only", async () => {
      await Notification.create([
        { user: studentId, title: "Unread", message: "msg", isRead: false },
        { user: studentId, title: "Read", message: "msg", isRead: true },
      ]);

      const res = await request(app)
        .get("/api/notifications?unreadOnly=true")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe("Unread");
    });

    it("should reject unauthenticated request", async () => {
      const res = await request(app).get("/api/notifications");
      expect(res.status).toBe(401);
    });
  });

  // ==================== UNREAD COUNT ====================
  describe("GET /api/notifications/unread-count", () => {
    it("should return unread count", async () => {
      await Notification.create([
        { user: studentId, title: "N1", message: "m", isRead: false },
        { user: studentId, title: "N2", message: "m", isRead: false },
        { user: studentId, title: "N3", message: "m", isRead: true },
      ]);

      const res = await request(app)
        .get("/api/notifications/unread-count")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.unreadCount).toBe(2);
    });
  });

  // ==================== MARK AS READ ====================
  describe("POST /api/notifications/:id/read", () => {
    it("should mark notification as read", async () => {
      const notif = await Notification.create({
        user: studentId,
        title: "Unread Notif",
        message: "msg",
        isRead: false,
      });

      const res = await request(app)
        .post(`/api/notifications/${notif._id}/read`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isRead).toBe(true);
    });

    it("should reject marking other user notification", async () => {
      const notif = await Notification.create({
        user: adminId,
        title: "Admin Notif",
        message: "msg",
        isRead: false,
      });

      const res = await request(app)
        .post(`/api/notifications/${notif._id}/read`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ==================== MARK ALL AS READ ====================
  describe("POST /api/notifications/read-all", () => {
    it("should mark all notifications as read", async () => {
      await Notification.create([
        { user: studentId, title: "N1", message: "m", isRead: false },
        { user: studentId, title: "N2", message: "m", isRead: false },
        { user: studentId, title: "N3", message: "m", isRead: false },
      ]);

      const res = await request(app)
        .post("/api/notifications/read-all")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.markedCount).toBe(3);

      // Verify all are read
      const unread = await Notification.countDocuments({
        user: studentId,
        isRead: false,
      });
      expect(unread).toBe(0);
    });
  });

  // ==================== DELETE NOTIFICATION ====================
  describe("DELETE /api/notifications/:id", () => {
    it("should delete own notification", async () => {
      const notif = await Notification.create({
        user: studentId,
        title: "Delete Me",
        message: "msg",
      });

      const res = await request(app)
        .delete(`/api/notifications/${notif._id}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).toBe(200);

      const deleted = await Notification.findById(notif._id);
      expect(deleted).toBeNull();
    });
  });

  // ==================== BROADCAST (Management) ====================
  describe("POST /api/notifications/broadcast", () => {
    it("should send broadcast to all users (manager)", async () => {
      const res = await request(app)
        .post("/api/notifications/broadcast")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          title: "Cafeteria Update",
          message: "New menu available tomorrow!",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.recipientCount).toBe(4); // all 4 users
      expect(res.body.data.title).toBe("Cafeteria Update");

      // Verify notifications created
      const notifs = await Notification.countDocuments({ broadcast: true });
      expect(notifs).toBe(4);
    });

    it("should send broadcast to specific roles", async () => {
      const res = await request(app)
        .post("/api/notifications/broadcast")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          title: "Staff Meeting",
          message: "Tomorrow at 9am",
          roles: ["canteen_staff"],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.recipientCount).toBe(1); // only staff
    });

    it("should reject broadcast from student", async () => {
      const res = await request(app)
        .post("/api/notifications/broadcast")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          title: "Spam",
          message: "spam",
        });

      expect(res.status).toBe(403);
    });
  });

  // ==================== EMERGENCY (Staff) ====================
  describe("POST /api/notifications/emergency", () => {
    it("should send emergency announcement (staff)", async () => {
      const res = await request(app)
        .post("/api/notifications/emergency")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          title: "Fire Alarm",
          message: "Please evacuate the cafeteria immediately",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.recipientCount).toBe(4);
      expect(res.body.data.title).toContain("Fire Alarm");
    });

    it("should reject emergency from student", async () => {
      const res = await request(app)
        .post("/api/notifications/emergency")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          title: "Fake Emergency",
          message: "Not real",
        });

      expect(res.status).toBe(403);
    });
  });
});
