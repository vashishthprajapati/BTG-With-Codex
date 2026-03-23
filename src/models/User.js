const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    oauthProvider: { type: String, default: null },
    oauthId: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    resetTokenHash: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
