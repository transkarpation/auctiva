import { http, createConfig } from 'wagmi';
import { base, baseSepolia, mainnet } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

// Connectors. EIP-6963 discovery is on by default, so every installed
// browser-extension wallet (MetaMask, Rabby, Brave, Coinbase, …) shows up
// automatically in addition to the ones declared here.
const connectors = [
  injected(),
  coinbaseWallet({ appName: 'Auctiva' }),
  // WalletConnect adds hundreds of mobile/desktop wallets via QR, but needs a
  // project id (https://cloud.reown.com). Only enabled when configured.
  ...(walletConnectProjectId
    ? [walletConnect({ projectId: walletConnectProjectId })]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base, mainnet],
  connectors,
  transports: {
    [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_HTTP),
    [base.id]: http(),
    [mainnet.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
