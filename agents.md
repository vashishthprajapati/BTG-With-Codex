# Agents Documentation

## Overview

This document maps the current project structure and responsibilities for the full-stack authentication app.

---

## Project Structure

```text
BTG
├── public
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── verify.html
│   ├── verify.js
│   ├── forgot.html
│   ├── forgot.js
│   ├── reset.html
│   ├── reset.js
│   ├── dashboard.html
│   ├── dashboard.js
├── src
│   ├── server.js
│   ├── models
│   │   ├── User.js
│   │   └── PendingUser.js
│   └── routes
│       └── auth.js
├── .env
├── .env.example
├── package.json
└── package-lock.json
```

---

## Agents (Mapped)

### 1. Backend Agent

**Role:** Owns API, database models, auth flows, and sessions.

**Responsibilities:**

- Express server setup
- MongoDB models (User, PendingUser)
- OTP verification and password reset
- OAuth integration
- Session handling (express-session + MongoDB store)
- CORS configuration

**Location:**

```
src/server.js
src/models/
src/routes/
```

---

### 2. Frontend Agent

**Role:** Owns UI pages, validation, and client-side flows.

**Responsibilities:**

- Login/Signup UI
- Verify OTP UI
- Forgot/Reset Password UI
- Dashboard UI
- Client-side validation
- Redirect handling based on session

**Location:**

```
public/*.html
public/*.js
public/styles.css
```

---

### 3. Config Agent

**Role:** Manages environment configuration and secrets.

**Responsibilities:**

- MongoDB connection string
- OAuth keys
- SMTP credentials
- Frontend origin

**Location:**

```
.env
.env.example
```

---

## Execution Flow

```text
User Signup
  -> POST /api/signup
  -> PendingUser created + OTP email
  -> verify.html
  -> POST /api/verify-otp
  -> User created (PendingUser removed)

User Login
  -> POST /api/login
  -> Session created
  -> dashboard.html

Password Reset
  -> POST /api/password/forgot
  -> reset.html
  -> POST /api/password/reset
```

---

## Notes

- Static assets are served from `public/` by Express.
- Server entrypoint is `src/server.js`.
- Pending users are auto-expired using TTL index.
- OAuth is enabled for Google/GitHub when keys are present.

---
