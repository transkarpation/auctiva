import {
  JsonRpcProvider,
  Wallet,
  ContractFactory,
  Contract,
  Interface,
  ZeroAddress,
} from "ethers";
import { env } from "../env.js";
import { SimpleAuctionArtifact } from "../SimpleAuction.js";

const { abi, bytecode } = SimpleAuctionArtifact;
const auctionInterface = new Interface([...abi]);

export type DeployResult = {
  contractAddress: string;
  deploymentTxHash: string;
};

// Deploys a fresh SimpleAuction to Base Sepolia, paid for by the app's wallet,
// with the seller's address as beneficiary.
export async function deploySimpleAuction(params: {
  startingPriceWei: string;
  biddingTimeSeconds: number;
  beneficiary: string;
  minBidIncrementWei: string;
}): Promise<DeployResult> {
  const provider = new JsonRpcProvider(env.bcHttp);
  const wallet = new Wallet(env.internalWalletPrivate, provider);
  const factory = new ContractFactory([...abi], bytecode, wallet);

  const contract = await factory.deploy(
    BigInt(params.startingPriceWei),
    BigInt(params.biddingTimeSeconds),
    params.beneficiary,
    BigInt(params.minBidIncrementWei)
  );
  const tx = contract.deploymentTransaction();
  await contract.waitForDeployment();

  return {
    contractAddress: await contract.getAddress(),
    deploymentTxHash: tx?.hash ?? "",
  };
}

// Outcome of validating a bid transaction against an auction's contract.
export type BidConfirmation =
  | { status: "ok"; bidder: string; amountWei: string; blockNumber: number }
  | { status: "not_found" } // tx unknown or not yet mined
  | { status: "reverted" } // tx mined but failed
  | { status: "wrong_contract" } // tx not sent to this auction's contract
  | { status: "no_bid_event" }; // tx succeeded but placed no bid here

// Verifies a transaction is a successful bid on `contractAddress` and extracts
// the bid details from the on-chain HighestBidIncreased event. Reading the
// event (rather than trusting the caller) is what makes the confirmation
// trustworthy: it proves a bid was actually accepted and by whom, for how much.
export async function confirmBidTransaction(
  txHash: string,
  contractAddress: string
): Promise<BidConfirmation> {
  const provider = new JsonRpcProvider(env.bcHttp);
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) return { status: "not_found" };
  if (receipt.status !== 1) return { status: "reverted" };
  if (receipt.to?.toLowerCase() !== contractAddress.toLowerCase()) {
    return { status: "wrong_contract" };
  }

  // Look for this contract's HighestBidIncreased event among the tx logs.
  for (const lg of receipt.logs) {
    if (lg.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
    let parsed;
    try {
      parsed = auctionInterface.parseLog({
        topics: [...lg.topics],
        data: lg.data,
      });
    } catch {
      continue; // not one of this contract's known events
    }
    if (parsed?.name === "HighestBidIncreased") {
      return {
        status: "ok",
        bidder: parsed.args.bidder as string,
        amountWei: (parsed.args.amount as bigint).toString(),
        blockNumber: receipt.blockNumber,
      };
    }
  }

  return { status: "no_bid_event" };
}

export type AuctionOnChainState = {
  // True once the bidding period is over (block time >= auctionEndTime).
  ended: boolean;
  // True if at least one bid was placed (highestBidder is set).
  hasBids: boolean;
};

// Reads the live auction state from its on-chain contract. Used to decide
// whether an auction is safe to delete (only ended auctions with no bids are).
export async function getAuctionOnChainState(
  contractAddress: string
): Promise<AuctionOnChainState> {
  const provider = new JsonRpcProvider(env.bcHttp);
  const contract = new Contract(contractAddress, [...abi], provider);

  const [auctionEndTime, highestBidder] = await Promise.all([
    contract.auctionEndTime() as Promise<bigint>,
    contract.highestBidder() as Promise<string>,
  ]);

  return {
    ended: Date.now() >= Number(auctionEndTime) * 1000,
    hasBids: highestBidder !== ZeroAddress,
  };
}
