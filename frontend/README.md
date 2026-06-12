# Auctiva Frontend

React + TypeScript + Vite single-page app. Auth with [Clerk](https://clerk.com),
UI with [Mantine](https://mantine.dev), data fetching with TanStack Query, wallet
+ on-chain interaction with [wagmi](https://wagmi.sh) / [viem](https://viem.sh),
and realtime updates over [Centrifugo](https://centrifugal.dev).

## Features

- **Tasks** — per-user groups and todos, drag-to-reorder, public group discovery.
- **Auctions** — create auctions priced in **wei** (ETH input → `parseEther`),
  with a configurable **minimum bid increment**. Deployed to Base Sepolia by the
  backend.
- **On-chain bidding** — the `BidPanel` reads live contract state and places
  bids **directly against the contract** via the connected wallet. It computes
  the incremental top-up (reusing the bidder's refundable credit / live bid), so
  a returning bidder only sends the difference. Includes withdraw and
  chain-switch handling.
- **Realtime** — a single Centrifugo connection (`RealtimeProvider`) subscribes
  to the user's personal channel; auction deploy-status changes update the UI
  live, and a header bell shows incoming messages.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run lint
```

## Environment

Create `.env` (git-ignored; see `.env.example`):

| Variable                          | Purpose                                              |
| --------------------------------- | ---------------------------------------------------- |
| `VITE_PUBLIC_CLERK_PUBLISHABLE_KEY`| Clerk frontend SDK (required)                       |
| `VITE_API_URL`                    | Backend base URL (default `http://localhost:4000`)   |
| `VITE_CENTRIFUGO_URL`             | Centrifugo websocket (default `ws://localhost:8000/connection/websocket`) |
| `VITE_BASE_SEPOLIA_HTTP`          | Base Sepolia RPC for wallet reads (optional)         |
| `VITE_WALLETCONNECT_PROJECT_ID`   | Enables WalletConnect mobile wallets (optional)      |

## Structure

```
src/
├── main.tsx                     # providers: Clerk, Wagmi, QueryClient, Router
├── App.tsx                      # shell, nav, realtime status
├── wagmi.ts                     # wagmi config (Base Sepolia + connectors)
├── api/                         # typed fetch wrappers (auctions, groups, realtime, …)
├── hooks/                       # useAuctions, useGroups, … (data + realtime patches)
├── realtime/
│   └── RealtimeProvider.tsx     # single Centrifugo connection + personal channel
├── contracts/
│   └── simpleAuction.ts         # minimal ABI for reads + bid()/withdraw()
└── components/
    ├── auctions/
    │   ├── MyAuctions.tsx        # create form (ETH → wei)
    │   ├── AuctionCard.tsx       # shows price/increment + BidPanel when deployed
    │   └── BidPanel.tsx          # on-chain bidding (wagmi reads/writes)
    ├── realtime/RealtimeMenu.tsx # header bell + connection badge
    ├── tasks/ · discover/ · navbar/ · wallet/
```

> The contract ABI in `contracts/simpleAuction.ts` is hand-maintained — keep it
> in sync with `sol-contracts/contracts/SimpleAuction.sol`.
