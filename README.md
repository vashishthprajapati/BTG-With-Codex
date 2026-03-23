# BTG Auth App

A full-stack authentication app with email OTP verification, password reset, and OAuth (Google/GitHub). The UI includes login, signup, verify, forgot/reset, and dashboard pages.

## Features

- Email + password signup with OTP verification
- Pending user flow stored separately before verification
- Login with session-based auth
- Password reset via email
- OAuth login (Google/GitHub)
- Dashboard with account details
- Rate-limited OTP resend and TTL cleanup

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
├── agents.md
├── package.json
└── package-lock.json
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill in values:

```text
MONGODB_URI=
SESSION_SECRET=
FRONTEND_ORIGIN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

3. Start the server:

```bash
npm run dev
```

4. Open the app:

```text
http://localhost:3000
```

## Key Endpoints

```text
POST /api/signup
POST /api/verify-otp
POST /api/otp/resend
POST /api/login
POST /api/logout
GET  /api/me
POST /api/password/forgot
POST /api/password/reset
GET  /api/auth/google
GET  /api/auth/github
```

## Notes

- Static files are served from `public/`.
- Server entrypoint is `src/server.js`.
- Pending users auto-expire via TTL index and periodic cleanup.
- OAuth requires valid provider credentials in `.env`.

