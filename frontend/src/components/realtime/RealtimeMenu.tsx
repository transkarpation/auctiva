import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import {
  ActionIcon,
  Badge,
  Group,
  Indicator,
  Menu,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconBell, IconSend } from '@tabler/icons-react';
import { useRealtime, type PersonalMessage } from '../../realtime/RealtimeProvider';
import { realtimeApi } from '../../api/realtime';

// Human-readable summary of a personal-channel message.
function describe(m: PersonalMessage): string {
  if (m.type === 'auction.updated') {
    const title = typeof m.title === 'string' ? `"${m.title}"` : 'Auction';
    return `${title} is now ${String(m.deploymentStatus)}`;
  }
  return m.message ?? JSON.stringify(m);
}

// Header widget for the user's realtime personal channel: shows connection
// state, lists messages received on "personal:#<userId>", and (as a demo) can
// publish a test message to that same channel via the backend.
export function RealtimeMenu() {
  const { getToken } = useAuth();
  const { connected, onMessage } = useRealtime();
  const [messages, setMessages] = useState<PersonalMessage[]>([]);
  const [sending, setSending] = useState(false);

  // Accumulate everything arriving on the personal channel (newest first).
  useEffect(
    () => onMessage((m) => setMessages((prev) => [m, ...prev])),
    [onMessage],
  );

  const sendTest = useCallback(async () => {
    setSending(true);
    try {
      await realtimeApi.notifySelf(
        () => getToken(),
        `Hello at ${new Date().toLocaleTimeString()}`,
      );
    } finally {
      setSending(false);
    }
  }, [getToken]);

  return (
    <Group gap="xs">
      <Tooltip label={connected ? 'Realtime connected' : 'Realtime offline'}>
        <Badge
          size="sm"
          variant="dot"
          color={connected ? 'teal' : 'gray'}
          styles={{ root: { textTransform: 'none' } }}
        >
          Live
        </Badge>
      </Tooltip>

      <Menu shadow="md" width={300} position="bottom-end" withArrow>
        <Menu.Target>
          <Indicator
            disabled={messages.length === 0}
            label={messages.length}
            size={16}
            offset={4}
          >
            <ActionIcon variant="default" size="lg" aria-label="Notifications">
              <IconBell size={18} />
            </ActionIcon>
          </Indicator>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Personal channel</Menu.Label>
          <Menu.Item
            leftSection={<IconSend size={14} />}
            onClick={sendTest}
            disabled={sending || !connected}
            closeMenuOnClick={false}
          >
            Send test message to myself
          </Menu.Item>
          <Menu.Divider />

          {messages.length === 0 ? (
            <Text c="dimmed" size="sm" p="sm">
              No messages yet.
            </Text>
          ) : (
            <Stack gap={4} p="xs" mah={280} style={{ overflowY: 'auto' }}>
              {messages.map((m, i) => (
                <div key={i}>
                  <Text size="sm">{describe(m)}</Text>
                  {m.at && (
                    <Text size="xs" c="dimmed">
                      {new Date(m.at).toLocaleTimeString()}
                    </Text>
                  )}
                </div>
              ))}
            </Stack>
          )}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
