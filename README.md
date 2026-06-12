# Auctiva

A full-stack app with per-user task management and on-chain auctions.

- **Frontend** — React + TypeScript + Vite + [Mantine](https://mantine.dev), auth via [Clerk](https://clerk.com), wallet/on-chain via [wagmi](https://wagmi.sh) + [viem](https://viem.sh).
- **Backend** — Express + TypeScript + Mongoose, Clerk session verification, Clerk webhooks (Svix), auction deployment via ethers (Base Sepolia), realtime via Centrifugo.
- **Infra (Docker Compose)** — MongoDB (+ Mongo Express), Redis (BullMQ deploy queue + Centrifugo engine), and Centrifugo (realtime websockets).

## Features

- Per-user **groups & todos** with public discovery.
- **Auctions** priced in **wei** with a configurable **minimum bid increment**,
  deployed as `SimpleAuction` contracts to Base Sepolia.
- **On-chain bidding** straight from the browser wallet (incremental top-ups via
  refundable credit).
- **Realtime** per-user channels (Centrifugo): auction deploy-status updates push
  live to the owner.
- **User mirror**: Clerk users synced into MongoDB via webhooks.

## Architecture

```
auctiva/
├── docker-compose.yml   # MongoDB + Mongo Express + Redis + Centrifugo
├── backend/             # Express API (port 4000) + deploy worker
├── frontend/            # Vite app (port 5173)
└── sol-contracts/       # Hardhat project — SimpleAuction.sol (source of truth)
```

The frontend authenticates users with Clerk and calls the backend with the
Clerk session token (`Authorization: Bearer <jwt>`). The backend verifies the
token and scopes all data to the signed-in user. Auctions are deployed by the
backend; **bids go directly from the user's wallet to the contract**. Realtime
messages flow backend → Centrifugo → the user's personal channel.

## Prerequisites

- Node.js 20+
- Docker (for MongoDB) — on WSL, enable Docker Desktop's WSL integration
- A [Clerk](https://dashboard.clerk.com) application (free tier is fine)

## Setup

### 1. Infrastructure

```bash
cp .env.example .env          # optional: customize Mongo / Centrifugo secrets
docker compose up -d          # MongoDB, Mongo Express, Redis, Centrifugo
```

- MongoDB → `mongodb://admin:secret@localhost:27017`
- Mongo Express UI → http://localhost:8081
- Redis → `redis://localhost:6379` (BullMQ queue + Centrifugo engine)
- Centrifugo → ws/admin on http://localhost:8000

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
cp .env.example .env          # set VITE_PUBLIC_CLERK_PUBLISHABLE_KEY (+ RPC for bidding)
npm install
npm run dev                   # http://localhost:5173
```

Sign in, then create / edit / complete / delete tasks — they persist per user
in MongoDB.

## Environment variables

| Location        | Variable                            | Purpose                                       |
| --------------- | ----------------------------------- | --------------------------------------------- |
| `./.env`        | `MONGO_USERNAME` / `_PASSWORD`      | MongoDB root credentials                      |
| `./.env`        | `CENTRIFUGO_*`                      | Centrifugo admin/API/token secrets + origins  |
| `backend/.env`  | `MONGO_URI`                         | MongoDB connection string                     |
| `backend/.env`  | `CLERK_PUBLISHABLE_KEY`             | Clerk instance (must match frontend)          |
| `backend/.env`  | `CLERK_SECRET_KEY`                  | Verifies session tokens                       |
| `backend/.env`  | `CLERK_WEBHOOK_SIGNING_SECRET`      | Verifies Clerk webhooks (optional)            |
| `backend/.env`  | `INTERNAL_WALLET_PRIVATE`           | Deployer key — **local only, never commit**   |
| `backend/.env`  | `BASE_SEPOLIA_HTTP` / `_WSS`        | Base Sepolia RPC (enables auction deploy)     |
| `backend/.env`  | `REDIS_URL`                         | BullMQ deploy queue (optional → sync deploy)  |
| `backend/.env`  | `CENTRIFUGO_TOKEN_HMAC_SECRET` / `_API_*` | Realtime token signing + publish        |
| `frontend/.env` | `VITE_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend SDK                            |
| `frontend/.env` | `VITE_API_URL`                      | Backend base URL (default `:4000`)            |
| `frontend/.env` | `VITE_CENTRIFUGO_URL`               | Centrifugo websocket endpoint                 |
| `frontend/.env` | `VITE_BASE_SEPOLIA_HTTP`            | RPC for wallet/contract reads                 |

> `.env` files are git-ignored. Use the committed `.env.example` files as
> templates — **never put real keys in `.env.example`**.

See per-package docs for details:
[`backend/README.md`](backend/README.md) · [`frontend/README.md`](frontend/README.md).

## Webhooks (optional)

To sync Clerk user events locally, expose the backend with ngrok and register the
endpoint in the Clerk dashboard. The webhook upserts users into MongoDB and
removes a user's data on deletion. See [`backend/README.md`](backend/README.md).
