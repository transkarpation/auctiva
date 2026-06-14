import { request, type TokenGetter } from './client';

// An image attached to an auction. `url` is a CloudFront signed URL snapshot
// the backend stored at upload time.
export type AuctionImage = {
  fileId: string;
  url: string;
};

export type Auction = {
  _id: string;
  title: string;
  description: string;
  images?: AuctionImage[];
  // Minimum first bid, in wei (decimal integer string). 1 ETH = 1e18 wei.
  startingPrice: string;
  // Minimum amount (wei) each later bid must exceed the current highest by.
  minBidIncrement: string;
  walletAddress: string;
  isPublic: boolean;
  // Lifecycle: a draft is owner-only and editable; publishing deploys it.
  status?: 'draft' | 'published';
  endsAt?: string;
  contractAddress?: string;
  deploymentTxHash?: string;
  chain?: string;
  deploymentStatus?: 'none' | 'pending' | 'deployed' | 'failed';
  createdAt: string;
  updatedAt: string;
};

export type PublicAuction = Auction & {
  ownerId: string;
  ownerName: string;
  // Live on-chain state, read by the backend. Null if the read failed.
  state: AuctionState | null;
};

// A bid recorded by the backend after on-chain confirmation.
export type Bid = {
  _id: string;
  auctionId: string;
  userId: string;
  contractAddress: string;
  // Bidder wallet address (lowercased) from the on-chain event.
  bidder: string;
  // Bid amount in wei (decimal integer string).
  amount: string;
  transactionHash: string;
  blockNumber: number;
  createdAt: string;
  updatedAt: string;
};

// Live on-chain state of a deployed auction, read by the backend.
export type AuctionState = {
  // Smallest acceptable next bid, in wei (decimal integer string).
  minimumBid: string;
  // Current highest bid, in wei.
  highestBid: string;
  // Highest bidder's address (zero address when there are no bids).
  highestBidder: string;
  // The contract's ended() flag (set once the auction is finalized on-chain).
  ended: boolean;
  // Auction end time, unix seconds.
  endTime: number;
};

export type NewAuction = {
  title: string;
  description?: string;
  // Wei (decimal integer strings).
  startingPrice: string;
  minBidIncrement: string;
  walletAddress: string;
  isPublic?: boolean;
  endsAt?: string;
  // Ids of already-uploaded files (POST /files) to attach as images.
  imageFileIds?: string[];
};

export const auctionsApi = {
  // The current user's auctions.
  listMine: (getToken: TokenGetter) => request<Auction[]>(getToken, '/auctions'),

  // All public auctions across users.
  listPublic: (getToken: TokenGetter) =>
    request<PublicAuction[]>(getToken, '/auctions/public'),

  // One auction (owner-only unless public), with owner name + live state.
  get: (getToken: TokenGetter, id: string) =>
    request<PublicAuction>(getToken, `/auctions/${id}`),

  // Recorded bid history for one auction, newest first.
  listBids: (getToken: TokenGetter, id: string) =>
    request<Bid[]>(getToken, `/auctions/${id}/bids`),

  // Creates the auction as a draft (not yet on chain).
  create: (getToken: TokenGetter, data: NewAuction) =>
    request<Auction>(getToken, '/auctions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Edit a draft auction (any subset of fields).
  update: (getToken: TokenGetter, id: string, data: Partial<NewAuction>) =>
    request<Auction>(getToken, `/auctions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Publish a draft — flips it to published and triggers deployment.
  publish: (getToken: TokenGetter, id: string) =>
    request<Auction>(getToken, `/auctions/${id}/publish`, { method: 'POST' }),

  remove: (getToken: TokenGetter, id: string) =>
    request<void>(getToken, `/auctions/${id}`, { method: 'DELETE' }),

  // Live on-chain state (highest bid, minimum next bid, end time) read by the
  // backend so the client doesn't need its own RPC connection.
  state: (getToken: TokenGetter, id: string) =>
    request<AuctionState>(getToken, `/auctions/${id}/state`),

  // Record a bid the user placed on-chain. The backend verifies the transaction
  // against the auction's contract before storing it.
  confirmBid: (getToken: TokenGetter, id: string, transactionHash: string) =>
    request<Bid>(getToken, `/auctions/${id}/bids/confirm`, {
      method: 'POST',
      body: JSON.stringify({ transactionHash }),
    }),
};
