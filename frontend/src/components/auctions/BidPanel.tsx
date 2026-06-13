import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/react';
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
  useConnection,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { useQuery } from '@tanstack/react-query';
import { formatEther, parseEther } from 'viem';
import { ConnectWalletButton } from '../wallet/ConnectWalletButton';
import { simpleAuctionAbi } from '../../contracts/simpleAuction';
import { auctionsApi, type Auction } from '../../api/auctions';

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

type Props = { auction: Auction; isOwner?: boolean };

// Lets a connected wallet bid directly on the auction's deployed contract.
// Because the contract counts funds the bidder already has locked (refundable
// credit + their own live bid), a returning bidder only needs to send the
// remaining top-up — which is what this panel pre-fills.
export function BidPanel({ auction, isOwner = false }: Props) {
  const address = auction.contractAddress as `0x${string}` | undefined;
  const { address: account, isConnected, chainId } = useConnection();
  const { mutate: switchChain, isPending: switching } = useSwitchChain();

  const contract = { address, abi: simpleAuctionAbi, chainId: baseSepolia.id } as const;

  const { getToken } = useAuth();
  const token = useCallback(() => getToken(), [getToken]);

  // Core auction state — read server-side (highest bid, minimum next bid, end
  // time) so the browser doesn't need its own RPC connection.
  const stateQuery = useQuery({
    queryKey: ['auction-state', auction._id],
    enabled: Boolean(address),
    queryFn: () => auctionsApi.state(token, auction._id),
  });

  // The caller's refundable credit from being outbid before.
  const credits = useReadContract({
    ...contract,
    functionName: 'pendingReturns',
    args: account ? [account] : undefined,
    query: { enabled: Boolean(address && account) },
  });

  const minRequired = stateQuery.data ? BigInt(stateQuery.data.minimumBid) : 0n;
  const highestBid = stateQuery.data ? BigInt(stateQuery.data.highestBid) : 0n;
  const highestBidder = stateQuery.data?.highestBidder;
  const ended = stateQuery.data?.ended ?? false;
  const endTime = stateQuery.data ? BigInt(stateQuery.data.endTime) : 0n;
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

  const { mutate: writeContract, data: hash, isPending: signing, error: writeError, reset } =
    useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: baseSepolia.id });

  // Tracks which on-chain action the pending tx is, so we only report bids (not
  // withdrawals) to the backend once confirmed.
  const [lastAction, setLastAction] = useState<'bid' | 'withdraw' | null>(null);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  // After a confirmed bid/withdraw, refresh on-chain state. (refetch/reset are
  // not React state, so this stays out of the cascading-render trap.) For a bid,
  // also report the transaction to the backend so it's verified and stored.
  useEffect(() => {
    if (!receipt.isSuccess) return;
    void stateQuery.refetch();
    void credits.refetch();

    if (lastAction === 'bid' && hash) {
      const txHash = hash;
      setRecording(true);
      setRecorded(false);
      setRecordError(null);
      auctionsApi
        .confirmBid(token, auction._id, txHash)
        .then(() => setRecorded(true))
        .catch((err) =>
          setRecordError(err instanceof Error ? err.message : 'Failed to record bid'),
        )
        .finally(() => setRecording(false));
    }

    setLastAction(null);
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  if (!address) return null;

  const wrongChain = isConnected && chainId !== baseSepolia.id;
  const busy = signing || receipt.isLoading;

  const placeBid = () => {
    if (sendWei === null) return;
    setLastAction('bid');
    writeContract({
      address,
      abi: simpleAuctionAbi,
      functionName: 'bid',
      value: sendWei,
      chainId: baseSepolia.id,
    });
  };

  const withdraw = () => {
    setLastAction('withdraw');
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

        {isOwner ? (
          <Text size="sm" c="dimmed">
            You own this auction — you can't bid on it.
          </Text>
        ) : closed ? (
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

        {!isOwner && credit > 0n && !busy && (
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
        {recording && (
          <Text size="xs" c="dimmed">
            Recording your bid…
          </Text>
        )}
        {recorded && (
          <Text size="xs" c="teal">
            Bid recorded.
          </Text>
        )}
        {recordError && (
          <Text size="xs" c="red">
            {recordError}
          </Text>
        )}
      </Stack>
    </>
  );
}
