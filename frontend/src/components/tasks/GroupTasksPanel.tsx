import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { groupPath } from '../../api/groups';
import type { UseGroups } from '../../hooks/useGroups';
import { Todos } from '../Todos';

// Page body for the Tasks view: the selected group's header + its todos.
// The active group comes from the URL (/tasks/:slug).
export function GroupTasksPanel({ g }: { g: UseGroups }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const selected = g.groups.find((x) => groupPath(x) === slug) ?? null;

  // Keep the URL pointing at a real group: redirect to the first one when the
  // slug is missing or stale (e.g. after deleting the selected group).
  useEffect(() => {
    if (g.loading) return;
    if (g.groups.length === 0) {
      if (slug) navigate('/tasks', { replace: true });
      return;
    }
    if (!selected) navigate(`/tasks/${groupPath(g.groups[0])}`, { replace: true });
  }, [g.loading, g.groups, selected, slug, navigate]);

  if (g.loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  if (g.groups.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        Create a group from the sidebar to start adding tasks.
      </Text>
    );
  }

  if (!selected) {
    // About to redirect to the first group.
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  const saveRename = () => {
    const name = renameValue.trim();
    if (!name) return;
    void g.renameGroup(selected._id, name).then((updated) => {
      setRenaming(false);
      // The slug follows the name, so move to the new URL.
      if (updated) navigate(`/tasks/${groupPath(updated)}`, { replace: true });
    });
  };

  return (
    <Stack>
      {g.error && (
        <Alert color="red" title="Error">
          {g.error}
        </Alert>
      )}

      {renaming ? (
        <Group>
          <TextInput
            style={{ flex: 1 }}
            value={renameValue}
            onChange={(e) => setRenameValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            autoFocus
          />
          <Button size="xs" onClick={saveRename} loading={g.busy}>
            Save
          </Button>
          <Button size="xs" variant="default" onClick={() => setRenaming(false)}>
            Cancel
          </Button>
        </Group>
      ) : (
        <Group justify="space-between">
          <Title order={2}>{selected.name}</Title>
          <Group gap="xs">
            <Tooltip
              label={
                selected.isPublic
                  ? 'Everyone can see this group and its tasks — click to make private'
                  : 'Only you can see this group — click to make it public'
              }
            >
              <Badge
                variant={selected.isPublic ? 'filled' : 'light'}
                color={selected.isPublic ? 'teal' : 'gray'}
                style={{ cursor: 'pointer' }}
                onClick={() => void g.toggleGroupPublic(selected)}
              >
                {selected.isPublic ? 'Public' : 'Private'}
              </Badge>
            </Tooltip>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => {
                setRenameValue(selected.name);
                setRenaming(true);
              }}
            >
              Rename
            </Button>
          </Group>
        </Group>
      )}

      <Todos groupId={selected._id} />
    </Stack>
  );
}
