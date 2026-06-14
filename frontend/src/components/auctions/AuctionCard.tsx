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
import type { MouseEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconExternalLink, IconWallet } from '@tabler/icons-react';
import { formatEther } from 'viem';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import type { Auction } from '../../api/auctions';
import { BidPanel } from './BidPanel';
import classes from './AuctionCard.module.css';

// Wraps interactive children (links, bid panel, delete) so clicking them does
// not bubble up to the card-level navigation handler.
function StopClick({ children }: { children: ReactNode }) {
  return <div onClick={(e: MouseEvent) => e.stopPropagation()}>{children}</div>;
}

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
  onEdit?: () => void;
  onPublish?: () => void;
  onDelete?: () => void;
  // Shared loading flag for the card's owner actions.
  busy?: boolean;
};

export function AuctionCard({
  auction,
  ownerName,
  isOwner,
  onEdit,
  onPublish,
  onDelete,
  busy,
}: Props) {
  const isDraft = auction.status === 'draft';
  const navigate = useNavigate();
  const ends = formatEndsAt(auction.endsAt);
  const images = auction.images ?? [];
  const openDetail = () => navigate(`/auctions/${auction._id}`);

  return (
    <Card
      withBorder
      radius="md"
      padding="lg"
      w={380}
      maw="100%"
      className={classes.card}
      onClick={openDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail();
        }
      }}
    >
      {images.length > 0 && (
        <Card.Section>
          {images.length === 1 ? (
            <Image
              src={images[0].url}
              height={180}
              fit="cover"
              alt={auction.title}
              fallbackSrc="https://placehold.co/600x400?text=Image+unavailable"
            />
          ) : (
              <Swiper
                modules={[Navigation, Pagination]}
                navigation
                pagination={{ clickable: true }}
                slidesPerView={1}
              >
                {images.map((img) => (
                  <SwiperSlide key={img.fileId}>
                    <Image
                      src={img.url}
                      height={180}
                      fit="cover"
                      alt={auction.title}
                      fallbackSrc="https://placehold.co/600x400?text=Image+unavailable"
                    />
                  </SwiperSlide>
                ))}
              </Swiper>
          )}
        </Card.Section>
      )}

      <Stack gap="xs" mt={images.length > 0 ? 'md' : undefined}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} truncate>
            {auction.title}
          </Text>
          <Group gap="xs" wrap="nowrap">
            {isDraft ? (
              <Badge color="gray" variant="outline">
                Draft
              </Badge>
            ) : (
              <DeploymentBadge status={auction.deploymentStatus} />
            )}
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
          <StopClick>
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
          </StopClick>
        )}

        {auction.deploymentStatus === 'deployed' && auction.contractAddress && (
          <StopClick>
            <BidPanel auction={auction} isOwner={isOwner} />
          </StopClick>
        )}

        {(onEdit || onPublish || onDelete) && (
          <StopClick>
            <Group justify="flex-end" gap="xs">
              {isDraft && onEdit && (
                <Button size="xs" variant="default" onClick={onEdit} disabled={busy}>
                  Edit
                </Button>
              )}
              {isDraft && onPublish && (
                <Button size="xs" onClick={onPublish} loading={busy}>
                  Publish
                </Button>
              )}
              {onDelete && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={onDelete}
                  loading={busy}
                >
                  Delete
                </Button>
              )}
            </Group>
          </StopClick>
        )}
      </Stack>
    </Card>
  );
}
