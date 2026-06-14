import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Loader,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconExternalLink, IconWallet } from '@tabler/icons-react';
import { formatEther } from 'viem';
import { auctionsApi, type Bid, type PublicAuction } from '../../api/auctions';
import { BidPanel } from './BidPanel';

function formatPrice(wei: string): string {
  try {
    return `${formatEther(BigInt(wei))} ETH`;
  } catch {
    return `${wei} wei`;
  }
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Only Base Sepolia is supported today.
const explorerTxUrl = (hash: string) => `https://sepolia.basescan.org/tx/${hash}`;
const explorerAddressUrl = (addr: string) => `https://sepolia.basescan.org/address/${addr}`;

function formatEndsAt(endsAt?: string): string | null {
  if (!endsAt) return null;
  const d = new Date(endsAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getTime() < Date.now() ? 'Ended' : 'Ends'} ${d.toLocaleString()}`;
}

function StatusBadge({ status }: { status: PublicAuction['deploymentStatus'] }) {
  if (status === 'deployed') return <Badge color="green" variant="light">On-chain</Badge>;
  if (status === 'pending') return <Badge color="yellow" variant="light">Deploying</Badge>;
  if (status === 'failed') return <Badge color="red" variant="light">Deploy failed</Badge>;
  return null;
}

function BidsHistory({ bids }: { bids: Bid[] }) {
  if (bids.length === 0) {
    return (
      <Text c="dimmed" size="sm" py="sm">
        No bids yet.
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={480}>
      <Table striped highlightOnHover verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Bidder</Table.Th>
            <Table.Th>Amount</Table.Th>
            <Table.Th>When</Table.Th>
            <Table.Th>Transaction</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {bids.map((b) => (
            <Table.Tr key={b._id}>
              <Table.Td>
                <Anchor href={explorerAddressUrl(b.bidder)} target="_blank" size="sm">
                  {shortAddress(b.bidder)}
                </Anchor>
              </Table.Td>
              <Table.Td>
                <Text fw={600} size="sm">
                  {formatPrice(b.amount)}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {new Date(b.createdAt).toLocaleString()}
                </Text>
              </Table.Td>
              <Table.Td>
                <Anchor href={explorerTxUrl(b.transactionHash)} target="_blank" size="sm">
                  <Group gap={4} wrap="nowrap">
                    <IconExternalLink size={12} />
                    {shortAddress(b.transactionHash)}
                  </Group>
                </Anchor>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function AuctionDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { getToken, userId } = useAuth();
  const token = useCallback(() => getToken(), [getToken]);

  const [auction, setAuction] = useState<PublicAuction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([
        auctionsApi.get(token, id),
        auctionsApi.listBids(token, id),
      ]);
      setAuction(a);
      setBids(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load auction');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const images = auction?.images ?? [];
  const ends = formatEndsAt(auction?.endsAt);

  return (
    <Stack>
      <Group>
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconArrowLeft size={14} />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
      </Group>

      {error && (
        <Alert color="red" title="Error">
          {error}
        </Alert>
      )}

      {loading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : !auction ? (
        !error && (
          <Text c="dimmed" ta="center" py="xl">
            Auction not found.
          </Text>
        )
      ) : (
        <>
          <Card withBorder radius="md" padding="lg">
            <Stack>
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Title order={2}>{auction.title}</Title>
                <Group gap="xs" wrap="nowrap">
                  <StatusBadge status={auction.deploymentStatus} />
                  <Badge color={auction.isPublic ? 'teal' : 'gray'} variant="light">
                    {auction.isPublic ? 'Public' : 'Private'}
                  </Badge>
                </Group>
              </Group>

              {images.length > 0 && (
                <SimpleGrid cols={{ base: 1, sm: images.length > 1 ? 2 : 1 }}>
                  {images.map((img) => (
                    <Image
                      key={img.fileId}
                      src={img.url}
                      radius="md"
                      h={220}
                      fit="cover"
                      alt={auction.title}
                      fallbackSrc="https://placehold.co/600x400?text=Image+unavailable"
                    />
                  ))}
                </SimpleGrid>
              )}

              {auction.description && <Text c="dimmed">{auction.description}</Text>}

              <Group gap="xl">
                <div>
                  <Text size="xs" c="dimmed">Starting price</Text>
                  <Text fw={700}>{formatPrice(auction.startingPrice)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Min raise per bid</Text>
                  <Text fw={700}>{formatPrice(auction.minBidIncrement)}</Text>
                </div>
                {auction.state && (
                  <div>
                    <Text size="xs" c="dimmed">Highest bid</Text>
                    <Text fw={700}>
                      {BigInt(auction.state.highestBid) > 0n
                        ? formatPrice(auction.state.highestBid)
                        : '—'}
                    </Text>
                  </div>
                )}
              </Group>

              <Group gap="lg">
                <Text size="sm" c="dimmed">by {auction.ownerName}</Text>
                {auction.walletAddress && (
                  <Group gap={4} wrap="nowrap">
                    <IconWallet size={14} />
                    <Text size="sm" c="dimmed" title={auction.walletAddress}>
                      {shortAddress(auction.walletAddress)}
                    </Text>
                  </Group>
                )}
                {ends && <Text size="sm" c="dimmed">{ends}</Text>}
                {auction.contractAddress && (
                  <Anchor
                    href={explorerAddressUrl(auction.contractAddress)}
                    target="_blank"
                    size="sm"
                  >
                    <Group gap={4} wrap="nowrap">
                      <IconExternalLink size={12} />
                      Contract {shortAddress(auction.contractAddress)}
                    </Group>
                  </Anchor>
                )}
              </Group>

              {auction.deploymentStatus === 'deployed' && auction.contractAddress && (
                <BidPanel auction={auction} isOwner={auction.ownerId === userId} />
              )}
            </Stack>
          </Card>

          <Card withBorder radius="md" padding="lg">
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={4}>Bid history</Title>
                <Button size="xs" variant="default" onClick={() => void load()}>
                  Refresh
                </Button>
              </Group>
              <BidsHistory bids={bids} />
            </Stack>
          </Card>
        </>
      )}
    </Stack>
  );
}
