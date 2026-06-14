import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Loader,
  Stack,
  Text,
} from '@mantine/core';
import { IconExternalLink, IconWallet } from '@tabler/icons-react';
import { formatEther } from 'viem';
import type { Auction } from '../../api/auctions';
import { BidPanel } from './BidPanel';

function DeploymentBadge({ status }: { status: Auction['deploymentStatus'] }) {
  if (status === 'pending') {
    return (
      <Badge color="yellow" variant="light" leftSection={<Loader size={10} color="yellow" />}>
        Deploying
      </Badge>
    );
  }
  if (status === 'deployed') {
    return (
      <Badge color="green" variant="light">
        On-chain
      </Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge color="red" variant="light">
        Deploy failed
      </Badge>
    );
  }
  return null;
}

// Block explorer for the chain the contract was deployed on.
function explorerAddressUrl(chain: string | undefined, address: string): string {
  // Currently only Base Sepolia is supported.
  void chain;
  return `https://sepolia.basescan.org/address/${address}`;
}

// Formats a wei amount (decimal integer string) as a human ETH value.
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

function formatEndsAt(endsAt?: string): string | null {
  if (!endsAt) return null;
  const d = new Date(endsAt);
  if (Number.isNaN(d.getTime())) return null;
  const ended = d.getTime() < Date.now();
  return `${ended ? 'Ended' : 'Ends'} ${d.toLocaleString()}`;
}

type Props = {
  auction: Auction;
  ownerName?: string;
  isOwner?: boolean;
  onDelete?: () => void;
  deleting?: boolean;
};

export function AuctionCard({ auction, ownerName, isOwner, onDelete, deleting }: Props) {
  const ends = formatEndsAt(auction.endsAt);
  const images = auction.images ?? [];

  return (
    <Card withBorder radius="md" padding="lg">
      {images.length > 0 && (
        <Card.Section pos="relative">
          <Image
            src={images[0].url}
            height={180}
            fit="cover"
            alt={auction.title}
            fallbackSrc="https://placehold.co/600x400?text=Image+unavailable"
          />
          {images.length > 1 && (
            <Badge color="dark" variant="filled" pos="absolute" bottom={8} right={8}>
              +{images.length - 1}
            </Badge>
          )}
        </Card.Section>
      )}

      <Stack gap="xs" mt={images.length > 0 ? 'md' : undefined}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} truncate>
            {auction.title}
          </Text>
          <Group gap="xs" wrap="nowrap">
            <DeploymentBadge status={auction.deploymentStatus} />
            {auction.isPublic ? (
              <Badge color="teal" variant="light">
                Public
              </Badge>
            ) : (
              <Badge color="gray" variant="light">
                Private
              </Badge>
            )}
          </Group>
        </Group>

        {auction.description && (
          <Text size="sm" c="dimmed" lineClamp={3}>
            {auction.description}
          </Text>
        )}

        <Group justify="space-between" align="flex-end">
          <div>
            <Text size="xs" c="dimmed">
              Starting price
            </Text>
            <Text fw={700}>{formatPrice(auction.startingPrice)}</Text>
            {auction.minBidIncrement && (
              <Text size="xs" c="dimmed">
                +{formatPrice(auction.minBidIncrement)} min raise
              </Text>
            )}
          </div>
          <Stack gap={2} align="flex-end">
            {ownerName && (
              <Text size="xs" c="dimmed">
                by {ownerName}
              </Text>
            )}
            {auction.walletAddress && (
              <Group gap={4} wrap="nowrap">
                <IconWallet size={12} />
                <Text size="xs" c="dimmed" title={auction.walletAddress}>
                  {shortAddress(auction.walletAddress)}
                </Text>
              </Group>
            )}
            {ends && (
              <Text size="xs" c="dimmed">
                {ends}
              </Text>
            )}
          </Stack>
        </Group>

        {auction.contractAddress && (
          <Anchor
            href={explorerAddressUrl(auction.chain, auction.contractAddress)}
            target="_blank"
            size="xs"
          >
            <Group gap={4} wrap="nowrap">
              <IconExternalLink size={12} />
              Contract {shortAddress(auction.contractAddress)}
            </Group>
          </Anchor>
        )}

        {auction.deploymentStatus === 'deployed' && auction.contractAddress && (
          <BidPanel auction={auction} isOwner={isOwner} />
        )}

        {onDelete && (
          <Group justify="flex-end">
            <Button
              size="xs"
              variant="subtle"
              color="red"
              onClick={onDelete}
              loading={deleting}
            >
              Delete
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
