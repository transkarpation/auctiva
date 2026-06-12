import { request, type TokenGetter } from './client';

export type Auction = {
  _id: string;
  title: string;
  description: string;
  // Minimum first bid, in wei (decimal integer string). 1 ETH = 1e18 wei.
  startingPrice: string;
  // Minimum amount (wei) each later bid must exceed the current highest by.
  minBidIncrement: string;
  walletAddress: string;
  isPublic: boolean;
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
};

export const auctionsApi = {
  // The current user's auctions.
  listMine: (getToken: TokenGetter) => request<Auction[]>(getToken, '/auctions'),

  // All public auctions across users.
  listPublic: (getToken: TokenGetter) =>
    request<PublicAuction[]>(getToken, '/auctions/public'),

  create: (getToken: TokenGetter, data: NewAuction) =>
    request<Auction>(getToken, '/auctions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  remove: (getToken: TokenGetter, id: string) =>
    request<void>(getToken, `/auctions/${id}`, { method: 'DELETE' }),
};
