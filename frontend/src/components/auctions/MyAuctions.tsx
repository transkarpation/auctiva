import { useState } from 'react';
import {
  Alert,
  Card,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { formatEther } from 'viem';
import { useAuctions } from '../../hooks/useAuctions';
import type { Auction } from '../../api/auctions';
import { AuctionCard } from './AuctionCard';
import { AuctionForm } from './AuctionForm';

// Converts an ISO timestamp into the value a datetime-local input expects
// (local "YYYY-MM-DDTHH:mm").
function toLocalDatetime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function MyAuctions() {
  const { auctions, loading, error, busy, create, update, publish, remove } = useAuctions();

  // Bumped after a successful create to reset the form (remount).
  const [formKey, setFormKey] = useState(0);
  // The draft currently open in the edit modal, if any.
  const [editing, setEditing] = useState<Auction | null>(null);

  return (
    <Stack>
      <Title order={2}>My auctions</Title>

      {error && (
        <Alert color="red" title="Error">
          {error}
        </Alert>
      )}

      <Card withBorder radius="md" padding="lg">
        <Stack>
          <Title order={4}>Create auction draft</Title>
          <Text size="sm" c="dimmed">
            Saved as a draft you can edit. Publish it when you're ready to deploy on chain.
          </Text>
          <AuctionForm
            key={formKey}
            submitLabel="Save draft"
            busy={busy}
            onSubmit={(data, images) =>
              void create(data, images).then((created) => {
                if (created) setFormKey((k) => k + 1);
              })
            }
          />
        </Stack>
      </Card>

      {loading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : auctions.length === 0 ? (
        <Text c="dimmed" ta="center" py="md">
          You have no auctions yet — create your first draft above.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {auctions.map((auction) => (
            <AuctionCard
              key={auction._id}
              auction={auction}
              isOwner
              onEdit={() => setEditing(auction)}
              onPublish={() => void publish(auction._id)}
              onDelete={() => void remove(auction._id)}
              busy={busy}
            />
          ))}
        </SimpleGrid>
      )}

      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit draft"
        size="lg"
      >
        {editing && (
          <AuctionForm
            submitLabel="Save changes"
            busy={busy}
            imageHint="Optional — selecting images replaces the current ones"
            initial={{
              title: editing.title,
              description: editing.description,
              startingPriceEth: formatEther(BigInt(editing.startingPrice)),
              minIncrementEth: formatEther(BigInt(editing.minBidIncrement)),
              endsAt: toLocalDatetime(editing.endsAt),
              isPublic: editing.isPublic,
            }}
            onSubmit={(data, images) =>
              void update(editing._id, data, images).then((updated) => {
                if (updated) setEditing(null);
              })
            }
          />
        )}
      </Modal>
    </Stack>
  );
}
