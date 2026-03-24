const path = require("path");
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GithubStrategy = require("passport-github2").Strategy;
require("dotenv").config();

const authRoutes = require("./routes/auth");
const User = require("./models/User");
const PendingUser = require("./models/PendingUser");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/btg_auth";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_LOCAL_FRONTEND = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(FRONTEND_ORIGIN);
const SAME_SITE = IS_PRODUCTION || !IS_LOCAL_FRONTEND ? "none" : "lax";
const COOKIE_SECURE = IS_PRODUCTION || SAME_SITE === "none";
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: SAME_SITE,
  secure: COOKIE_SECURE
};

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error", err);
    process.exit(1);
  });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);

app.use(
  session({
    name: "btg.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGODB_URI, stringify: false }),
    cookie: SESSION_COOKIE_OPTIONS,
  })
);

app.locals.sessionCookieOptions = SESSION_COOKIE_OPTIONS;

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        let user = await User.findOne({ oauthProvider: "google", oauthId: profile.id });

        if (!user && email) {
          user = await User.findOne({ email: email.toLowerCase() });
        }

        if (!user) {
          user = await User.create({
            name: profile.displayName || "Google User",
            email: email || `google-${profile.id}@no-email.local`,
            passwordHash: await require("bcryptjs").hash(Date.now().toString(), 8),
            oauthProvider: "google",
            oauthId: profile.id,
            avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
          });
        } else {
          user.oauthProvider = "google";
          user.oauthId = profile.id;
          if (!user.avatarUrl && profile.photos && profile.photos[0]) {
            user.avatarUrl = profile.photos[0].value;
          }
          await user.save();
        }

        done(null, user);
      } catch (error) {
        done(error);
      }
    }
  )
);

passport.use(
  new GithubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      callbackURL: process.env.GITHUB_CALLBACK_URL || "",
      scope: ["user:email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        let user = await User.findOne({ oauthProvider: "github", oauthId: profile.id });

        if (!user && email) {
          user = await User.findOne({ email: email.toLowerCase() });
        }

        if (!user) {
          user = await User.create({
            name: profile.displayName || profile.username || "GitHub User",
            email: email || `github-${profile.id}@no-email.local`,
            passwordHash: await require("bcryptjs").hash(Date.now().toString(), 8),
            oauthProvider: "github",
            oauthId: profile.id,
            avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
          });
        } else {
          user.oauthProvider = "github";
          user.oauthId = profile.id;
          if (!user.avatarUrl && profile.photos && profile.photos[0]) {
            user.avatarUrl = profile.photos[0].value;
          }
          await user.save();
        }

        done(null, user);
      } catch (error) {
        done(error);
      }
    }
  )
);

app.use("/api", authRoutes);

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const cleanupExpiredPending = async () => {
  try {
    await PendingUser.deleteMany({ otpExpires: { $lt: new Date() } });
  } catch (error) {
    console.error("Pending user cleanup failed", error);
  }
};

setInterval(cleanupExpiredPending, 15 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
