import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Indicator,
  Menu,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconBell, IconChecks, IconTrash } from '@tabler/icons-react';
import { useRealtime } from '../../realtime/RealtimeProvider';
import { useNotifications } from '../../hooks/useNotifications';

// Header widget: a live connection badge plus the user's notifications inbox.
// Notifications are loaded from the backend and updated in realtime over the
// personal channel; clicking one marks it read.
export function RealtimeMenu() {
  const { connected } = useRealtime();
  const { notifications, unreadCount, loading, error, markRead, markAllRead, remove } =
    useNotifications();

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

      <Menu shadow="md" width={320} position="bottom-end" withArrow>
        <Menu.Target>
          <Indicator disabled={unreadCount === 0} label={unreadCount} size={16} offset={4}>
            <ActionIcon variant="default" size="lg" aria-label="Notifications">
              <IconBell size={18} />
            </ActionIcon>
          </Indicator>
        </Menu.Target>

        <Menu.Dropdown>
          <Group justify="space-between" px="sm" py={6}>
            <Menu.Label p={0}>Notifications</Menu.Label>
            <Tooltip label="Mark all as read">
              <ActionIcon
                variant="subtle"
                size="sm"
                aria-label="Mark all as read"
                disabled={unreadCount === 0}
                onClick={() => void markAllRead()}
              >
                <IconChecks size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Menu.Divider />

          {error ? (
            <Text c="red" size="sm" p="sm">
              {error}
            </Text>
          ) : loading ? (
            <Text c="dimmed" size="sm" p="sm">
              Loading…
            </Text>
          ) : notifications.length === 0 ? (
            <Text c="dimmed" size="sm" p="sm">
              No notifications yet.
            </Text>
          ) : (
            <Stack gap={2} p="xs" mah={320} style={{ overflowY: 'auto' }}>
              {notifications.map((n) => (
                <Group key={n._id} gap={4} wrap="nowrap" align="flex-start">
                  <UnstyledButton
                    style={{ flex: 1 }}
                    onClick={() => !n.read && void markRead(n._id)}
                  >
                    <Group gap={6} wrap="nowrap" align="center">
                      {!n.read && (
                        <Box
                          w={6}
                          h={6}
                          style={{
                            flexShrink: 0,
                            borderRadius: '50%',
                            backgroundColor: 'var(--mantine-color-blue-6)',
                          }}
                        />
                      )}
                      <Text size="sm" fw={n.read ? 400 : 600} lineClamp={2}>
                        {n.message}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {new Date(n.createdAt).toLocaleString()}
                    </Text>
                  </UnstyledButton>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label="Delete notification"
                    onClick={() => void remove(n._id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          )}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
