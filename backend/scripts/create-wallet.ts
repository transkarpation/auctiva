/**
 * Generates a fresh Ethereum wallet and prints its address + private key.
 *
 * Usage:
 *   npm run create-wallet         # one wallet
 *   npm run create-wallet -- 3    # three wallets
 *
 * WARNING: the private key (and mnemonic) printed here grant full control of
 * the wallet. Never share them, commit them, or paste them anywhere untrusted.
 */
import { Wallet } from "ethers";

function createWallet(): void {
  // createRandom() generates a cryptographically secure random wallet.
  const wallet = Wallet.createRandom();

  console.log("Address:     ", wallet.address);
  console.log("Private key: ", wallet.privateKey);
  if (wallet.mnemonic) {
    console.log("Mnemonic:    ", wallet.mnemonic.phrase);
  }
}

function main(): void {
  const count = Math.max(1, Number(process.argv[2]) || 1);

  console.log("⚠  Keep the private key secret — anyone with it controls the wallet.\n");
  for (let i = 0; i < count; i++) {
    if (count > 1) console.log(`# Wallet ${i + 1}`);
    createWallet();
    console.log();
  }
}

main();
