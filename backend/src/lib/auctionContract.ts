import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";
import { env } from "../env.js";
import { SimpleAuctionArtifact } from "../SimpleAuction.js";

const { abi, bytecode } = SimpleAuctionArtifact;

// Deployment needs both an RPC endpoint and a funded deployer key.
export function chainEnabled(): boolean {
  return Boolean(env.baseSepoliaHttp && env.internalWalletPrivate);
}

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
  if (!env.baseSepoliaHttp || !env.internalWalletPrivate) {
    throw new Error(
      "Chain is not configured (BASE_SEPOLIA_HTTP and INTERNAL_WALLET_PRIVATE)"
    );
  }

  const provider = new JsonRpcProvider(env.baseSepoliaHttp);
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
