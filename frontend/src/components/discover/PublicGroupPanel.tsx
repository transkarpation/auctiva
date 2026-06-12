import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Group,
  Loader,
  Progress,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { UsePublicGroups } from '../../hooks/usePublicGroups';

// Page body for the Discover view: the selected public group's progress + tasks.
// The active group comes from the URL (/discover/:groupId).
export function PublicGroupPanel({ p }: { p: UsePublicGroups }) {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const g = p.groups.find((x) => x._id === groupId) ?? null;

  useEffect(() => {
    if (p.loading) return;
    if (p.groups.length === 0) {
      if (groupId) navigate('/discover', { replace: true });
      return;
    }
    if (!g) navigate(`/discover/${p.groups[0]._id}`, { replace: true });
  }, [p.loading, p.groups, g, groupId, navigate]);

  if (p.loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  if (p.error) {
    return (
      <Text c="red" ta="center" py="xl">
        {p.error}
      </Text>
    );
  }

  if (p.groups.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No public groups yet. Make one of your groups “Public” to share it here.
      </Text>
    );
  }

  if (!g) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  const pct = g.total ? Math.round((g.completed / g.total) * 100) : 0;

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Avatar radius="xl" name={g.ownerName} color="initials" />
          <div style={{ minWidth: 0 }}>
            <Title order={2}>{g.name}</Title>
            <Text size="sm" c="dimmed">
              {g.ownerName}
            </Text>
          </div>
        </Group>
        <Badge variant="light" color={pct === 100 && g.total > 0 ? 'green' : 'gray'}>
          {g.completed}/{g.total} done
        </Badge>
      </Group>

      <Progress value={pct} aria-label={`${pct}% complete`} />

      {g.todos.length === 0 ? (
        <Text c="dimmed" size="sm">
          This group has no tasks yet.
        </Text>
      ) : (
        <Stack gap="xs">
          {g.todos.map((t, index) => (
            <Group key={t._id} justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <Text c="dimmed" size="sm" w={24} ta="right" style={{ flexShrink: 0 }}>
                  {index + 1}.
                </Text>
                <Text
                  truncate
                  td={t.completed ? 'line-through' : undefined}
                  c={t.completed ? 'dimmed' : undefined}
                >
                  {t.title}
                </Text>
              </Group>
              <Badge size="sm" variant="light" color={t.completed ? 'green' : 'gray'}>
                {t.completed ? 'Done' : 'In progress'}
              </Badge>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
