import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Divider,
  Group,
  NumberInput,
  Stack,
  Text,
} from '@mantine/core';
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { formatEther, parseEther } from 'viem';
import { ConnectWalletButton } from '../wallet/ConnectWalletButton';
import { simpleAuctionAbi } from '../../contracts/simpleAuction';
import type { Auction } from '../../api/auctions';

function ethToWei(input: number | string): bigint | null {
  const s = typeof input === 'number' ? String(input) : input.trim();
  if (s === '') return null;
  try {
    return parseEther(s);
  } catch {
    return null;
  }
}

const eq = (a?: string, b?: string) =>
  Boolean(a) && Boolean(b) && a!.toLowerCase() === b!.toLowerCase();

type Props = { auction: Auction };

// Lets a connected wallet bid directly on the auction's deployed contract.
// Because the contract counts funds the bidder already has locked (refundable
// credit + their own live bid), a returning bidder only needs to send the
// remaining top-up — which is what this panel pre-fills.
export function BidPanel({ auction }: Props) {
  const address = auction.contractAddress as `0x${string}` | undefined;
  const { address: account, isConnected, chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();

  const contract = { address, abi: simpleAuctionAbi, chainId: baseSepolia.id } as const;

  // Core auction state (always readable from Base Sepolia regardless of the
  // wallet's current chain).
  const state = useReadContracts({
    query: { enabled: Boolean(address) },
    contracts: [
      { ...contract, functionName: 'getMinimumRequiredBid' },
      { ...contract, functionName: 'highestBid' },
      { ...contract, functionName: 'highestBidder' },
      { ...contract, functionName: 'ended' },
      { ...contract, functionName: 'auctionEndTime' },
    ],
  });

  // The caller's refundable credit from being outbid before.
  const credits = useReadContract({
    ...contract,
    functionName: 'pendingReturns',
    args: account ? [account] : undefined,
    query: { enabled: Boolean(address && account) },
  });

  const minRequired = (state.data?.[0]?.result as bigint | undefined) ?? 0n;
  const highestBid = (state.data?.[1]?.result as bigint | undefined) ?? 0n;
  const highestBidder = state.data?.[2]?.result as string | undefined;
  const ended = (state.data?.[3]?.result as boolean | undefined) ?? false;
  const endTime = (state.data?.[4]?.result as bigint | undefined) ?? 0n;
  const credit = (credits.data as bigint | undefined) ?? 0n;

  const isHighest = eq(account, highestBidder);
  const staked = isHighest ? highestBid : 0n;
  const existing = credit + staked;
  const topUp = minRequired > existing ? minRequired - existing : 0n;

  // Snapshot "now" once at mount (a lazy initializer keeps render pure); good
  // enough to hide the bid form for an already-expired auction.
  const [nowSec] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  const timeUp = endTime !== 0n && nowSec > endTime;
  const closed = ended || timeUp;

  // Amount to send, in ETH. While the user hasn't typed anything (empty state)
  // the field shows — and bids — the minimum top-up, derived from on-chain data
  // without an effect.
  const [sendEth, setSendEth] = useState<number | string>('');
  const userTyped = sendEth !== '';
  const displayValue = userTyped ? sendEth : formatEther(topUp);
  const sendWei = useMemo(
    () => (userTyped ? ethToWei(sendEth) : topUp),
    [userTyped, sendEth, topUp],
  );
  const totalBid = sendWei !== null ? sendWei + existing : null;
  const meetsMin = totalBid !== null && totalBid >= minRequired && minRequired > 0n;

  const { writeContract, data: hash, isPending: signing, error: writeError, reset } =
    useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: baseSepolia.id });

  // After a confirmed bid/withdraw, refresh on-chain state. (refetch/reset are
  // not React state, so this stays out of the cascading-render trap.)
  useEffect(() => {
    if (receipt.isSuccess) {
      void state.refetch();
      void credits.refetch();
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  if (!address) return null;

  const wrongChain = isConnected && chainId !== baseSepolia.id;
  const busy = signing || receipt.isLoading;

  const placeBid = () => {
    if (sendWei === null) return;
    writeContract({
      address,
      abi: simpleAuctionAbi,
      functionName: 'bid',
      value: sendWei,
      chainId: baseSepolia.id,
    });
  };

  const withdraw = () => {
    writeContract({
      address,
      abi: simpleAuctionAbi,
      functionName: 'withdraw',
      chainId: baseSepolia.id,
    });
  };

  return (
    <>
      <Divider my={4} />
      <Stack gap={6}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Highest bid
          </Text>
          <Text size="sm" fw={600}>
            {highestBid === 0n
              ? 'No bids yet'
              : `${formatEther(highestBid)} ETH${isHighest ? ' (you)' : ''}`}
          </Text>
        </Group>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Minimum next bid
          </Text>
          <Text size="sm">{formatEther(minRequired)} ETH</Text>
        </Group>

        {credit > 0n && (
          <Text size="xs" c="teal">
            You have {formatEther(credit)} ETH credit applied to your next bid.
          </Text>
        )}

        {closed ? (
          <Alert color="gray" variant="light" p="xs">
            This auction is closed for bidding.
          </Alert>
        ) : !isConnected ? (
          <ConnectWalletButton />
        ) : wrongChain ? (
          <Button
            variant="default"
            loading={switching}
            onClick={() => switchChain({ chainId: baseSepolia.id })}
          >
            Switch to Base Sepolia to bid
          </Button>
        ) : isHighest ? (
          <Text size="sm" c="dimmed">
            You are the highest bidder.
          </Text>
        ) : (
          <>
            <NumberInput
              label="Amount to send (ETH)"
              description={
                existing > 0n
                  ? `Plus ${formatEther(existing)} ETH already locked → total bid ${
                      totalBid !== null ? formatEther(totalBid) : '—'
                    } ETH`
                  : undefined
              }
              value={displayValue}
              onChange={setSendEth}
              min={0}
              allowNegative={false}
              decimalScale={18}
              suffix=" ETH"
            />
            <Button
              onClick={placeBid}
              loading={busy}
              disabled={sendWei === null || !meetsMin}
            >
              {topUp > 0n ? `Bid (send ${formatEther(topUp)} ETH min)` : 'Place bid'}
            </Button>
            {sendWei !== null && !meetsMin && (
              <Text size="xs" c="red">
                Total bid must be at least {formatEther(minRequired)} ETH.
              </Text>
            )}
          </>
        )}

        {credit > 0n && !busy && (
          <Button size="xs" variant="subtle" onClick={withdraw} loading={busy}>
            Withdraw {formatEther(credit)} ETH credit
          </Button>
        )}

        {writeError && (
          <Text size="xs" c="red">
            {writeError.message.split('\n')[0]}
          </Text>
        )}
        {receipt.isSuccess && (
          <Text size="xs" c="teal">
            Transaction confirmed.
          </Text>
        )}
      </Stack>
    </>
  );
}
