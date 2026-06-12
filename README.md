# CRM

A full-stack CRM app with per-user task management.

- **Frontend** — React + TypeScript + Vite + [Mantine](https://mantine.dev), auth via [Clerk](https://clerk.com).
- **Backend** — Express + TypeScript + Mongoose, Clerk session verification, Clerk webhooks (Svix).
- **Database** — MongoDB (via Docker Compose, with Mongo Express admin UI).

## Architecture

```
crm-fa/
├── docker-compose.yml   # MongoDB + Mongo Express
├── backend/             # Express API (port 4000)
└── frontend/            # Vite app (port 5173)
```

The frontend authenticates users with Clerk and calls the backend with the
Clerk session token (`Authorization: Bearer <jwt>`). The backend verifies the
token and scopes all data to the signed-in user.

## Prerequisites

- Node.js 20+
- Docker (for MongoDB) — on WSL, enable Docker Desktop's WSL integration
- A [Clerk](https://dashboard.clerk.com) application (free tier is fine)

## Setup

### 1. Database

```bash
cp .env.example .env          # optional: customize Mongo credentials
docker compose up -d
```

- MongoDB → `mongodb://admin:secret@localhost:27017`
- Mongo Express UI → http://localhost:8081

### 2. Backend

```bash
cd backend
cp .env.example .env          # fill in CLERK_SECRET_KEY + CLERK_PUBLISHABLE_KEY
npm install
npm run dev                   # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
# set VITE_PUBLIC_CLERK_PUBLISHABLE_KEY in .env
npm install
npm run dev                   # http://localhost:5173
```

Sign in, then create / edit / complete / delete tasks — they persist per user
in MongoDB.

## Environment variables

| Location        | Variable                        | Purpose                                  |
| --------------- | ------------------------------- | ---------------------------------------- |
| `./.env`        | `MONGO_USERNAME` / `_PASSWORD`  | MongoDB root credentials                 |
| `backend/.env`  | `MONGO_URI`                     | MongoDB connection string                |
| `backend/.env`  | `CLERK_PUBLISHABLE_KEY`         | Clerk instance (must match frontend)     |
| `backend/.env`  | `CLERK_SECRET_KEY`              | Verifies session tokens                  |
| `backend/.env`  | `CLERK_WEBHOOK_SIGNING_SECRET`  | Verifies Clerk webhooks (optional)       |
| `frontend/.env` | `VITE_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend SDK                   |
| `frontend/.env` | `VITE_API_URL`                  | Backend base URL (default `:4000`)       |

> `.env` files are git-ignored. Use the committed `.env.example` files as templates.

## Webhooks (optional)

To sync Clerk user events locally, expose the backend with ngrok and register the
endpoint in the Clerk dashboard. See [`backend/README.md`](backend/README.md).
