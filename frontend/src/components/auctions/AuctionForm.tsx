import { useState } from 'react';
import {
  Button,
  FileInput,
  Group,
  NumberInput,
  Pill,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';
import { useConnection } from 'wagmi';
import { parseEther } from 'viem';
import { ConnectWalletButton } from '../wallet/ConnectWalletButton';
import type { NewAuction } from '../../api/auctions';

// Parses an ETH input into wei, or null if it isn't a valid amount.
function ethToWei(input: number | string): bigint | null {
  const s = typeof input === 'number' ? String(input) : input.trim();
  if (s === '') return null;
  try {
    return parseEther(s);
  } catch {
    return null;
  }
}

export type AuctionFormInitial = {
  title?: string;
  description?: string;
  startingPriceEth?: string;
  minIncrementEth?: string;
  endsAt?: string; // datetime-local value
  isPublic?: boolean;
};

type Props = {
  initial?: AuctionFormInitial;
  submitLabel: string;
  busy?: boolean;
  // Optional images to upload; for edit they replace existing images.
  imageHint?: string;
  onSubmit: (data: NewAuction, images: File[]) => void;
};

// Shared create/edit form for an auction's editable fields. Holds its own field
// state and emits a NewAuction plus selected image files on submit.
export function AuctionForm({ initial, submitLabel, busy, imageHint, onSubmit }: Props) {
  const { address, isConnected } = useConnection();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [startingPrice, setStartingPrice] = useState<number | string>(
    initial?.startingPriceEth ?? '',
  );
  const [minIncrement, setMinIncrement] = useState<number | string>(
    initial?.minIncrementEth ?? '',
  );
  const [endsAt, setEndsAt] = useState(initial?.endsAt ?? '');
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [images, setImages] = useState<File[]>([]);

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
    onSubmit(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        startingPrice: priceWei.toString(),
        minBidIncrement: incrementWei.toString(),
        walletAddress: address,
        isPublic,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      },
      images,
    );
  };

  return (
    <Stack>
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
      <FileInput
        label="Images"
        description={imageHint ?? 'Optional — up to 8 images, uploaded on submit'}
        placeholder="Select images"
        leftSection={<IconPhoto size={16} />}
        accept="image/*"
        multiple
        clearable
        value={images}
        onChange={(files) => setImages(files.slice(0, 8))}
      />
      {images.length > 0 && (
        <Pill.Group>
          {images.map((f, i) => (
            <Pill
              key={`${f.name}-${i}`}
              withRemoveButton
              onRemove={() => setImages((prev) => prev.filter((_, j) => j !== i))}
            >
              {f.name}
            </Pill>
          ))}
        </Pill.Group>
      )}
      <Group grow>
        <NumberInput
          label="Starting price (ETH)"
          description={priceWei !== null ? `= ${priceWei.toString()} wei` : 'Minimum first bid'}
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
            incrementWei !== null ? `= ${incrementWei.toString()} wei` : 'Minimum raise per bid'
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

      {/* Wallet connection — the address is required (auction beneficiary). */}
      <ConnectWalletButton />
      {!isConnected && (
        <Text size="xs" c="dimmed">
          Connect a wallet to save this auction.
        </Text>
      )}

      <Group justify="flex-end">
        <Button onClick={submit} loading={busy} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  );
}
