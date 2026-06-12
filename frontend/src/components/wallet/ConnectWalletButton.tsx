import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Badge, Button, Group, Image, Modal, Stack, Text } from '@mantine/core';
import { IconWallet } from '@tabler/icons-react';

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [opened, setOpened] = useState(false);

  if (isConnected && address) {
    return (
      <Group justify="space-between">
        <Badge
          size="lg"
          variant="light"
          color="teal"
          leftSection={<IconWallet size={14} />}
        >
          {shortAddress(address)}
        </Badge>
        <Button size="xs" variant="subtle" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </Group>
    );
  }

  // De-duplicate by name (EIP-6963 discovery + a declared injected connector
  // can otherwise list the same wallet twice).
  const wallets = Array.from(
    new Map(connectors.map((c) => [c.name, c])).values(),
  );

  return (
    <>
      <Button
        variant="default"
        leftSection={<IconWallet size={16} />}
        onClick={() => setOpened(true)}
      >
        Connect wallet
      </Button>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Connect a wallet"
        centered
      >
        <Stack>
          {wallets.length === 0 ? (
            <Text c="dimmed" size="sm">
              No wallets detected. Install a browser wallet (e.g. MetaMask) or
              configure WalletConnect to connect a mobile wallet.
            </Text>
          ) : (
            wallets.map((connector) => (
              <Button
                key={connector.uid}
                variant="default"
                justify="flex-start"
                loading={isPending}
                leftSection={
                  connector.icon ? (
                    <Image src={connector.icon} w={20} h={20} alt="" />
                  ) : (
                    <IconWallet size={18} />
                  )
                }
                onClick={() => {
                  connect({ connector });
                  setOpened(false);
                }}
              >
                {connector.name}
              </Button>
            ))
          )}

          {error && (
            <Text c="red" size="sm">
              {error.message}
            </Text>
          )}
        </Stack>
      </Modal>
    </>
  );
}
