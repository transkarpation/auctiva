// Minimal ABI for the on-chain SimpleAuction, used by the frontend to read
// auction state and place bids directly against the contract. Kept in sync with
// sol-contracts/contracts/SimpleAuction.sol. `as const` enables viem/wagmi type
// inference. Custom errors are included so reverts decode to readable names.
export const simpleAuctionAbi = [
  { type: 'function', name: 'bid', stateMutability: 'payable', inputs: [], outputs: [] },
  {
    type: 'function',
    name: 'auctionEnd',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getMinimumRequiredBid',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'highestBid',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'highestBidder',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'pendingReturns',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'auctionEndTime',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ended',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  { type: 'error', name: 'AuctionAlreadyEnded', inputs: [] },
  {
    type: 'error',
    name: 'BidNotHighEnough',
    inputs: [{ name: 'requiredBid', type: 'uint256' }],
  },
  { type: 'error', name: 'AuctionNotYetEnded', inputs: [] },
  { type: 'error', name: 'AuctionEndAlreadyCalled', inputs: [] },
  {
    type: 'event',
    name: 'HighestBidIncreased',
    inputs: [
      { name: 'bidder', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AuctionEnded',
    inputs: [
      { name: 'winner', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;
