require("dotenv").config();
const mongoose = require("mongoose");
const config = require("./src/config");
const User = require("./src/models/User");

(async () => {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log("Connected to MongoDB");

    // Check if admin already exists
    const existing = await User.findOne({ email: "admin@gmail.com" });
    if (existing) {
      console.log(
        "Admin user already exists with this email. Updating role to admin...",
      );
      existing.role = "admin";
      await existing.save();
      console.log("User role updated to admin.");
    } else {
      const admin = await User.create({
        fullName: "admin",
        email: "admin@gmail.com",
        password: "admin123", // auto-hashed by pre-save hook
        role: "admin",
        status: "active",
      });
      console.log("Admin user created successfully!");
      console.log("  Name:", admin.fullName);
      console.log("  Email:", admin.email);
      console.log("  Role:", admin.role);
    }

    process.exit(0);
  } catch (err) {
    console.error("Error creating admin user:", err.message);
    process.exit(1);
  }
})();
