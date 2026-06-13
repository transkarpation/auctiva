import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useConnection } from 'wagmi';
import { parseEther } from 'viem';
import { useAuctions } from '../../hooks/useAuctions';
import { ConnectWalletButton } from '../wallet/ConnectWalletButton';
import { AuctionCard } from './AuctionCard';

// Parses an ETH input into a wei value, or null if it isn't a valid amount.
function ethToWei(input: number | string): bigint | null {
  const s = typeof input === 'number' ? String(input) : input.trim();
  if (s === '') return null;
  try {
    return parseEther(s);
  } catch {
    return null;
  }
}

export function MyAuctions() {
  const { auctions, loading, error, busy, create, remove } = useAuctions();
  const { address, isConnected } = useConnection();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startingPrice, setStartingPrice] = useState<number | string>('');
  const [minIncrement, setMinIncrement] = useState<number | string>('');
  const [endsAt, setEndsAt] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const priceWei = ethToWei(startingPrice);
  const incrementWei = ethToWei(minIncrement);
  const canSubmit =
    title.trim() !== '' &&
    priceWei !== null &&
    incrementWei !== null &&
    incrementWei > 0n &&
    isConnected &&
    Boolean(address);

  const submit = () => {
    if (!canSubmit || !address || priceWei === null || incrementWei === null) return;
    void create({
      title: title.trim(),
      description: description.trim() || undefined,
      startingPrice: priceWei.toString(),
      minBidIncrement: incrementWei.toString(),
      walletAddress: address,
      isPublic,
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
    }).then((created) => {
      if (created) {
        setTitle('');
        setDescription('');
        setStartingPrice('');
        setMinIncrement('');
        setEndsAt('');
        setIsPublic(false);
        // Keep the wallet connected for subsequent auctions.
      }
    });
  };

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
          <Title order={4}>Create auction</Title>
          <TextInput
            label="Title"
            placeholder="What are you auctioning?"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Description"
            placeholder="Optional details"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group grow>
            <NumberInput
              label="Starting price (ETH)"
              description={
                priceWei !== null ? `= ${priceWei.toString()} wei` : 'Minimum first bid'
              }
              placeholder="0.0"
              value={startingPrice}
              onChange={setStartingPrice}
              min={0}
              allowNegative={false}
              decimalScale={18}
              suffix=" ETH"
              required
            />
            <NumberInput
              label="Min bid increment (ETH)"
              description={
                incrementWei !== null
                  ? `= ${incrementWei.toString()} wei`
                  : 'Minimum raise per bid'
              }
              placeholder="0.0"
              value={minIncrement}
              onChange={setMinIncrement}
              min={0}
              allowNegative={false}
              decimalScale={18}
              suffix=" ETH"
              required
            />
          </Group>
          <TextInput
            label="Ends at"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.currentTarget.value)}
          />
          <Switch
            label="Public — visible to everyone"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.currentTarget.checked)}
          />

          {/* Wallet connection — the address is required to create an auction. */}
          <ConnectWalletButton />
          {!isConnected && (
            <Text size="xs" c="dimmed">
              Connect a wallet to create an auction.
            </Text>
          )}

          <Group justify="flex-end">
            <Button onClick={submit} loading={busy} disabled={!canSubmit}>
              Create auction
            </Button>
          </Group>
        </Stack>
      </Card>

      {loading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : auctions.length === 0 ? (
        <Text c="dimmed" ta="center" py="md">
          You have no auctions yet — create your first one above.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {auctions.map((auction) => (
            <AuctionCard
              key={auction._id}
              auction={auction}
              isOwner
              onDelete={() => void remove(auction._id)}
              deleting={busy}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
