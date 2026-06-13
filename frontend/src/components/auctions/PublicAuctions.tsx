import { Button, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useAuth } from '@clerk/react';
import { usePublicAuctions } from '../../hooks/usePublicAuctions';
import { AuctionCard } from './AuctionCard';

export function PublicAuctions() {
  const { auctions, loading, error, reload } = usePublicAuctions();
  const { userId } = useAuth();

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Public auctions</Title>
        <Button size="xs" variant="default" onClick={() => void reload()} loading={loading}>
          Refresh
        </Button>
      </Group>

      {error && (
        <Text c="red" size="sm">
          {error}
        </Text>
      )}

      {loading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : auctions.length === 0 ? (
        <Text c="dimmed" ta="center" py="md">
          No public auctions yet.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {auctions.map((auction) => (
            <AuctionCard
              key={auction._id}
              auction={auction}
              ownerName={auction.ownerName}
              isOwner={auction.ownerId === userId}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
