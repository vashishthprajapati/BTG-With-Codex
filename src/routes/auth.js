const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const passport = require("passport");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const PendingUser = require("../models/PendingUser");

const router = express.Router();

const safeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl || null
});

const setSessionUser = (req, user) => {
  if (!req || !req.session || !user) return;
  req.session.userId = user._id.toString();
  req.session.user = {
    id: user._id.toString(),
    name: user.name,
    email: user.email
  };
};

const saveSession = (req) =>
  new Promise((resolve, reject) => {
    if (!req || !req.session) return resolve();
    req.session.save((err) => (err ? reject(err) : resolve()));
  });

const createRateLimiter = ({ windowMs, max }) => {
  const hits = new Map();
  return (req, res, next) => {
    const key = `${req.ip}:${(req.body && req.body.email) || "unknown"}`.toLowerCase();
    const now = Date.now();
    const entry = hits.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) {
      entry.count = 0;
      entry.start = now;
    }
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > max) {
      const retryAfter = Math.ceil((windowMs - (now - entry.start)) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    next();
  };
};

const resendLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 3 });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendOtpEmail = async (to, otp) => {
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP not configured");
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "no-reply@example.com",
    to,
    subject: "Your BTG verification code",
    text: `Your verification code is ${otp}. It expires in 10 minutes.`,
  });
};

const sendResetEmail = async (to, resetUrl) => {
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP not configured");
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "no-reply@example.com",
    to,
    subject: "Reset your BTG password",
    text: `Reset your password using this link: ${resetUrl} (valid for 1 hour).`,
  });
};

const createOtp = () => {
  const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  return { otp, otpHash, otpExpires };
};

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "Email already registered." });
    }

    const { otp, otpHash, otpExpires } = createOtp();
    const passwordHash = await bcrypt.hash(password, 10);

    await PendingUser.deleteOne({ email: email.toLowerCase() });
    const pending = await PendingUser.create({
      name,
      email,
      passwordHash,
      otpHash,
      otpExpires,
    });

    await sendOtpEmail(email, otp);

    res.json({ message: "OTP sent to your email.", email: pending.email });
  } catch (error) {
    if (error && error.message === "SMTP not configured") {
      return res.status(500).json({ error: "SMTP not configured." });
    }
    res.status(500).json({ error: "Signup failed." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Missing credentials." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ error: "Use social login for this account." });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    setSessionUser(req, user);
    await saveSession(req);
    res.json({ user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ error: "Login failed." });
  }
});

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required." });
  }

  const pending = await PendingUser.findOne({ email: email.toLowerCase() });
  if (!pending) {
    return res.status(400).json({ error: "Invalid OTP." });
  }

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  if (!pending.otpHash || pending.otpHash !== otpHash || pending.otpExpires < new Date()) {
    return res.status(400).json({ error: "Invalid or expired OTP." });
  }

  const user = await User.create({
    name: pending.name,
    email: pending.email,
    passwordHash: pending.passwordHash,
  });

  await PendingUser.deleteOne({ _id: pending._id });

  setSessionUser(req, user);
  await saveSession(req);
  res.json({ user: safeUser(user) });
});

router.post("/otp/resend", resendLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const pending = await PendingUser.findOne({ email: email.toLowerCase() });
  if (!pending) {
    return res.json({ message: "If the email exists, a new OTP has been sent." });
  }

  const { otp, otpHash, otpExpires } = createOtp();
  pending.otpHash = otpHash;
  pending.otpExpires = otpExpires;
  await pending.save();

  await sendOtpEmail(pending.email, otp);

  res.json({ message: "OTP resent." });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    const cookieOptions = req.app?.locals?.sessionCookieOptions || {};
    res.clearCookie("btg.sid", cookieOptions);
    res.json({ ok: true });
  });
});

router.get("/me", async (req, res) => {
  if (req.user) {
    setSessionUser(req, req.user);
    await saveSession(req);
    return res.json({ user: safeUser(req.user) });
  }

  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  const user = await User.findById(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  setSessionUser(req, user);
  await saveSession(req);
  res.json({ user: safeUser(user) });
});

router.get("/session", async (req, res) => {
  const sessionId = req.sessionID || null;
  if (!req.session || (!req.session.userId && !req.session.user)) {
    return res.status(401).json({ error: "Not authenticated.", sessionId });
  }

  let user = req.session.user || null;
  if (!user && req.session.userId) {
    const dbUser = await User.findById(req.session.userId);
    if (dbUser) {
      user = { id: dbUser._id.toString(), name: dbUser.name, email: dbUser.email };
      req.session.user = user;
    }
  }

  if (!user) {
    return res.status(401).json({ error: "Not authenticated.", sessionId });
  }

  return res.json({ sessionId, user });
});

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/?error=oauth" }),
  (req, res) => {
    if (req.user) {
      setSessionUser(req, req.user);
    }
    req.session.save(() => {
      res.redirect(process.env.FRONTEND_ORIGIN || "/");
    });
  }
);

router.get("/auth/github", passport.authenticate("github", { scope: ["user:email"] }));

router.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/?error=oauth" }),
  (req, res) => {
    if (req.user) {
      setSessionUser(req, req.user);
    }
    req.session.save(() => {
      res.redirect(process.env.FRONTEND_ORIGIN || "/");
    });
  }
);

router.post("/password/forgot", async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.json({ message: "If the email exists, a reset link has been sent." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  user.resetTokenHash = tokenHash;
  user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const resetUrl = `${req.protocol}://${req.get("host")}/reset.html?token=${token}`;

  try {
    await sendResetEmail(user.email, resetUrl);
    res.json({ message: "If the email exists, a reset link has been sent." });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      return res.json({
        message: "If the email exists, a reset link has been sent.",
        resetUrl,
      });
    }
    return res.status(500).json({ error: "SMTP not configured." });
  }
});

router.post("/password/reset", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: "Token and password are required." });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetTokenHash: tokenHash,
    resetTokenExpires: { $gt: new Date() },
  });

  if (!user) {
    return res.status(400).json({ error: "Invalid or expired token." });
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  user.resetTokenHash = null;
  user.resetTokenExpires = null;
  await user.save();

  res.json({ message: "Password reset successful." });
});

module.exports = router;
