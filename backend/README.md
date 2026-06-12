# CRM Backend

Express + TypeScript API with MongoDB (Mongoose), Clerk authentication, and
Clerk webhooks.

## Scripts

```bash
npm run dev           # API server with hot reload (tsx watch)
npm run worker        # deploy worker with hot reload (needs REDIS_URL)
npm run build         # compile TypeScript to dist/
npm start             # run the compiled API server
npm run start:worker  # run the compiled deploy worker
npm run typecheck     # type-check without emitting
```

The API server and the deploy worker are **separate processes**. When using
the async deploy queue (`REDIS_URL` set), run both — e.g. `npm run dev` in one
terminal and `npm run worker` in another. Without a worker, on-chain auctions
stay `pending`.

## Environment

Copy `.env.example` to `.env` and fill in:

| Variable                       | Description                                        |
| ------------------------------ | -------------------------------------------------- |
| `PORT`                         | HTTP port (default `4000`)                         |
| `MONGO_URI`                    | MongoDB connection string                          |
| `CLERK_PUBLISHABLE_KEY`        | Clerk instance key (must match the frontend)       |
| `CLERK_SECRET_KEY`             | Used to verify session tokens                      |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Used to verify Clerk webhook signatures (optional) |

## API

All `/todos` routes require a valid Clerk session token
(`Authorization: Bearer <jwt>`) and operate only on the caller's own data.

| Method   | Path                   | Auth   | Description                       |
| -------- | ---------------------- | ------ | -------------------------------- |
| `GET`    | `/health`              | public | Service + DB status              |
| `GET`    | `/groups`              | user   | List the user's groups           |
| `POST`   | `/groups`              | user   | Create a group (`{ name }`)      |
| `PATCH`  | `/groups/:id`          | user   | Update `name` and/or `isPublic`  |
| `DELETE` | `/groups/:id`          | user   | Delete a group (and its todos)   |
| `GET`    | `/todos?groupId=`      | user   | List the user's todos in a group |
| `GET`    | `/todos/public`        | user   | All tasks in any public group    |
| `POST`   | `/todos`               | user   | Create a todo (`{ groupId, title }`) |
| `PATCH`  | `/todos/reorder`       | user   | Reorder a group (`{ groupId, orderedIds }`) |
| `PATCH`  | `/todos/:id`           | user   | Update `title` and/or `completed`|
| `DELETE` | `/todos/:id`           | user   | Delete a todo                    |
| `GET`    | `/auctions`            | user   | List the user's auctions         |
| `GET`    | `/auctions/public`     | user   | All public auctions (with owner) |
| `POST`   | `/auctions`            | user   | Create (`{ title, startingPrice, … }`) |
| `DELETE` | `/auctions/:id`        | user   | Delete one of the user's auctions |
| `POST`   | `/api/webhooks/clerk`  | signed | Clerk webhook receiver (Svix)    |

Unauthenticated requests to protected routes get `401 { "error": "Unauthorized" }`.

**Public groups:** a group has an `isPublic` flag. When it's `true`, all of that
group's todos appear in `GET /todos/public` (visible to every authenticated
user) along with the owner's name and the group name. Private groups and their
todos are never exposed.

**Auction contracts:** when `BASE_SEPOLIA_HTTP` and `INTERNAL_WALLET_PRIVATE`
are configured, `POST /auctions` deploys a `SimpleAuction` contract to Base
Sepolia (app wallet pays gas, the seller's wallet is the beneficiary) and stores
`contractAddress` / `deploymentTxHash` on the auction. Each auction carries a
`deploymentStatus`:

- **`REDIS_URL` set (preferred):** the auction is created immediately as
  `pending` and the deploy runs asynchronously on a **BullMQ** queue (3 retries
  with backoff). The worker updates the record to `deployed` / `failed`. The
  frontend polls while `pending`. Run the worker as its own process:
  `npm run worker` (dev) / `npm run start:worker` (prod).
- **No `REDIS_URL`:** the deploy runs synchronously in the request; failure
  returns `502` and no auction is created.
- **No chain config:** the auction is created off-chain with status `none`.

The contract source lives in `contracts/SimpleAuction.sol`; recompile its
artifact with `npm run compile-contracts`. Run Redis with `docker compose up -d
redis`.

## Structure

```
src/
├── server.ts            # entry: connect DB, then listen
├── app.ts               # express app wiring + middleware order
├── config/
│   ├── env.ts           # typed environment variables
│   └── db.ts            # mongoose connection
├── middleware/
│   └── requireUser.ts   # 401 guard using Clerk's getAuth()
├── models/
│   ├── Group.ts         # { userId, name, isPublic, timestamps }
│   └── Todo.ts          # { userId, groupId, title, completed, timestamps }
└── routes/
    ├── health.ts        # GET /health
    ├── groups.ts        # user-scoped group CRUD
    ├── todos.ts         # user-scoped todo CRUD + public feed
    └── webhooks.ts      # Clerk/Svix webhook handler
```

## Webhooks with ngrok (local development)

Clerk signs webhooks with [Svix](https://docs.svix.com); verification requires
the **raw** request body, so the webhook route is mounted with a raw body parser
*before* `express.json()`.

```bash
npm run dev            # backend on :4000
ngrok http 4000        # → https://<id>.ngrok-free.app
```

In the Clerk dashboard → **Webhooks → Add Endpoint**:

1. URL: `https://<id>.ngrok-free.app/api/webhooks/clerk`
2. Subscribe to e.g. `user.created`, `user.updated`, `user.deleted`
3. Copy the **Signing Secret** into `CLERK_WEBHOOK_SIGNING_SECRET` and restart.

The handler verifies the signature (forged requests get `400`) and, on
`user.deleted`, removes that user's todos.

> Free ngrok URLs change on each restart — re-paste the URL in Clerk each time,
> or use a reserved domain to keep it stable.
