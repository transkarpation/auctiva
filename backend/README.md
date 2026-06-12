# Auctiva Backend

Express + TypeScript API with MongoDB (Mongoose), Clerk authentication, Clerk
webhooks (Svix), on-chain auction deployment (ethers + Base Sepolia), and
realtime push via Centrifugo.

## Scripts

```bash
npm run dev           # API server with hot reload (tsx watch)
npm run worker        # deploy worker with hot reload (needs REDIS_URL)
npm run build         # compile TypeScript to dist/
npm start             # run the compiled API server
npm run start:worker  # run the compiled deploy worker
npm run typecheck     # type-check without emitting
npm run create-wallet # generate a fresh deployer wallet (address + private key)
npm run backfill-users # backfill the users collection from Clerk (one-off)
```

The API server and the deploy worker are **separate processes**. When using the
async deploy queue (`REDIS_URL` set), run both — e.g. `npm run dev` in one
terminal and `npm run worker` in another. Without a worker, on-chain auctions
stay `pending`.

## Environment

Copy `.env.example` to `.env` and fill in:

| Variable                       | Description                                                  |
| ------------------------------ | ------------------------------------------------------------ |
| `PORT`                         | HTTP port (default `4000`)                                   |
| `MONGO_URI`                    | MongoDB connection string                                    |
| `CLERK_PUBLISHABLE_KEY`        | Clerk instance key (must match the frontend)                 |
| `CLERK_SECRET_KEY`             | Used to verify session tokens                                |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Verifies Clerk webhook signatures (optional)                 |
| `INTERNAL_WALLET_ADDRESS`      | App-owned deployer wallet address (optional)                 |
| `INTERNAL_WALLET_PRIVATE`      | Deployer private key — **local `.env` only, never commit**   |
| `BASE_SEPOLIA_HTTP` / `_WSS`   | Base Sepolia RPC endpoints (use your own provider key)       |
| `REDIS_URL`                    | Redis for the BullMQ deploy queue (optional → sync deploy)   |
| `CENTRIFUGO_TOKEN_HMAC_SECRET` | Signs Centrifugo connection tokens (match the container)     |
| `CENTRIFUGO_API_URL`           | Centrifugo HTTP API base (default `http://localhost:8000/api`)|
| `CENTRIFUGO_API_KEY`           | Centrifugo HTTP API key (match the container)                |

## API

Protected routes require a valid Clerk session token
(`Authorization: Bearer <jwt>`) and operate only on the caller's own data.
Unauthenticated requests get `401 { "error": "Unauthorized" }`.

| Method   | Path                        | Auth   | Description                                   |
| -------- | --------------------------- | ------ | -------------------------------------------- |
| `GET`    | `/health`                   | public | Service + DB status                          |
| `GET`    | `/groups`                   | user   | List the user's groups                       |
| `POST`   | `/groups`                   | user   | Create a group (`{ name }`)                  |
| `PATCH`  | `/groups/:id`               | user   | Update `name` and/or `isPublic`              |
| `DELETE` | `/groups/:id`               | user   | Delete a group (and its todos)               |
| `GET`    | `/todos?groupId=`           | user   | List the user's todos in a group             |
| `GET`    | `/todos/public`             | user   | All tasks in any public group                |
| `POST`   | `/todos`                    | user   | Create a todo (`{ groupId, title }`)         |
| `PATCH`  | `/todos/reorder`            | user   | Reorder a group (`{ groupId, orderedIds }`)  |
| `PATCH`  | `/todos/:id`                | user   | Update `title` and/or `completed`            |
| `DELETE` | `/todos/:id`                | user   | Delete a todo                                |
| `GET`    | `/auctions`                 | user   | List the user's auctions                     |
| `GET`    | `/auctions/public`          | user   | Public auctions **that are deployed** + owner|
| `POST`   | `/auctions`                 | user   | Create an auction (see body below)           |
| `DELETE` | `/auctions/:id`             | user   | Delete one of the user's auctions            |
| `GET`    | `/realtime/centrifugo-token`| user   | Mint a Centrifugo connection token + channel |
| `POST`   | `/realtime/notify-self`     | user   | Demo: publish to the caller's personal channel |
| `POST`   | `/api/webhooks/clerk`       | signed | Clerk webhook receiver (Svix)                |

HTTP requests are logged with **morgan** (`dev` format in development,
`combined` in production).

**Public groups:** a group's `isPublic` flag exposes its todos via
`GET /todos/public` (with owner + group name). Private groups are never exposed.

## Auctions (wei amounts, on-chain)

`POST /auctions` body:

```jsonc
{
  "title": "string",
  "description": "string?",
  "startingPrice": "1000000000000000000",   // wei (decimal integer string)
  "minBidIncrement": "100000000000000000",   // wei — minimum raise per bid
  "walletAddress": "0x… (seller / beneficiary)",
  "isPublic": false,
  "endsAt": "ISO date?"
}
```

Monetary amounts are **wei**, stored and transmitted as decimal integer
**strings** (wei routinely exceeds JS's safe integer range). The frontend takes
ETH input and converts with viem's `parseEther`.

When `BASE_SEPOLIA_HTTP` and `INTERNAL_WALLET_PRIVATE` are configured,
`POST /auctions` deploys a `SimpleAuction` contract to Base Sepolia (app wallet
pays gas; the seller's wallet is the beneficiary), passing
`(startingPrice, biddingTime, beneficiary, minBidIncrement)`. The on-chain
minimum next bid is `startingPrice` until the first bid, then
`highestBid + minBidIncrement`; returning bidders only need to send the
incremental top-up (their refundable credit is reused).

`deploymentStatus` transitions:

- **`REDIS_URL` set (preferred):** created as `pending`; the deploy runs on a
  **BullMQ** queue (3 retries with backoff). The worker updates the record to
  `deployed` / `failed` and **publishes the change to the owner's personal
  channel** (frontend updates live; it also polls as a fallback). Run the worker
  as its own process: `npm run worker` (dev) / `npm run start:worker` (prod).
- **No `REDIS_URL`:** the deploy runs synchronously in the request; failure
  returns `502`.
- **No chain config:** the auction is created off-chain with status `none`.

**Contract artifact:** the deployed ABI + bytecode live in
`src/SimpleAuction.ts`, synced from the Hardhat project in `../sol-contracts`.
After changing the contract there, recompile and re-sync:

```bash
(cd ../sol-contracts && npx hardhat compile)
# then regenerate backend/src/SimpleAuction.ts from
# sol-contracts/artifacts/contracts/SimpleAuction.sol/SimpleAuction.json
```

Bidding itself happens **client-side**: the frontend talks to the deployed
contract directly via the user's wallet (see `frontend/`).

## Realtime (Centrifugo)

The backend mints short-lived **connection JWTs** for the signed-in user
(`GET /realtime/centrifugo-token`, signed with `CENTRIFUGO_TOKEN_HMAC_SECRET`,
`sub` = Clerk user id) and returns the user's **personal channel**
`personal:#<userId>`. That namespace is user-limited in Centrifugo, so a client
can only subscribe to its own channel. The server pushes messages with the
Centrifugo HTTP API (`lib/centrifugo.ts` → `publishToUser`) — e.g. auction
deploy status changes (`lib/auctionEvents.ts`).

Centrifugo runs as a Docker service (see root `docker-compose.yml`) on
`:8000`, using Redis as its engine. Browser origins must be allow-listed via
`CENTRIFUGO_CLIENT_ALLOWED_ORIGINS`.

## Structure

```
src/
├── server.ts             # entry: connect DB, then listen
├── app.ts                # express wiring: cors, morgan, raw webhook body, json, clerk, routes
├── worker.ts             # standalone BullMQ deploy worker
├── env.ts                # typed environment variables (zod)
├── SimpleAuction.ts      # compiled contract artifact (ABI + bytecode)
├── config/db.ts          # mongoose connection
├── middleware/
│   └── requireUser.ts    # 401 guard using Clerk's getAuth()
├── models/
│   ├── Group.ts          # { userId, name, isPublic }
│   ├── Todo.ts           # { userId, groupId, title, completed }
│   ├── Auction.ts        # { userId, title, startingPrice(wei), minBidIncrement(wei), … }
│   └── User.ts           # Clerk user mirror { clerkId, email, firstName, … }
├── lib/
│   ├── auctionContract.ts # ethers deploy of SimpleAuction
│   ├── auctionEvents.ts   # publishAuctionUpdate → owner's personal channel
│   ├── centrifugo.ts      # connection-token JWT + HTTP API publish
│   ├── owners.ts          # resolve Clerk user ids → display names
│   ├── validate.ts        # zod helpers
│   └── slug.ts
├── queue/
│   └── deployQueue.ts     # BullMQ queue + deploy worker
└── routes/
    ├── health.ts
    ├── groups.ts
    ├── todos.ts
    ├── auctions.ts
    ├── realtime.ts        # Centrifugo token + notify-self
    └── webhooks.ts        # Clerk/Svix webhook → user upsert / delete
```

## Users & webhooks (ngrok for local dev)

Clerk is the source of truth for users; the `users` collection is a local
mirror kept in sync by the webhook:

- `user.created` / `user.updated` → **upsert** the user (`clerkId`, email, name…)
- `user.deleted` → remove the user record **and** that user's todos

Run `npm run backfill-users` once to import users that existed before webhook
persistence (it reads distinct `userId`s from groups/todos/auctions and fetches
them from the Clerk API).

Clerk signs webhooks with [Svix](https://docs.svix.com); verification needs the
**raw** body, so the webhook route is mounted with a raw body parser *before*
`express.json()`.

```bash
npm run dev            # backend on :4000
ngrok http 4000        # → https://<id>.ngrok-free.app
```

Clerk dashboard → **Webhooks → Add Endpoint**:

1. URL: `https://<id>.ngrok-free.app/api/webhooks/clerk`
2. Subscribe to `user.created`, `user.updated`, `user.deleted`
3. Copy the **Signing Secret** into `CLERK_WEBHOOK_SIGNING_SECRET` and restart.

Forged requests get `400`. Free ngrok URLs change on restart — re-paste in Clerk
or use a reserved domain.
