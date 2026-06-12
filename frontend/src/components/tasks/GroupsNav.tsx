import { useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Button,
  Group,
  Loader,
  NavLink,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { groupPath } from '../../api/groups';
import type { UseGroups } from '../../hooks/useGroups';

// Wide-column content for the Tasks view: add a group + the group list.
export function GroupsNav({ g }: { g: UseGroups }) {
  const navigate = useNavigate();
  const match = useMatch('/tasks/:slug');
  const activeSlug = match?.params.slug;
  const [newName, setNewName] = useState('');

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    void g.addGroup(name).then((created) => {
      if (created) {
        setNewName('');
        navigate(`/tasks/${groupPath(created)}`);
      }
    });
  };

  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="nowrap">
        <TextInput
          placeholder="New group"
          style={{ flex: 1 }}
          value={newName}
          onChange={(e) => setNewName(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          disabled={g.busy}
        />
        <Button onClick={add} loading={g.busy} disabled={!newName.trim()}>
          Add
        </Button>
      </Group>

      {g.loading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : g.groups.length === 0 ? (
        <Text c="dimmed" size="sm">
          No groups yet — create one to start adding tasks.
        </Text>
      ) : (
        <Stack gap={4}>
          {g.groups.map((group) => (
            <NavLink
              key={group._id}
              active={groupPath(group) === activeSlug}
              label={group.name}
              description={group.isPublic ? 'Public' : undefined}
              onClick={() => navigate(`/tasks/${groupPath(group)}`)}
              rightSection={
                <ActionIcon
                  component="div"
                  variant="subtle"
                  color="red"
                  size="sm"
                  aria-label="Delete group"
                  onClick={(e) => {
                    e.stopPropagation();
                    void g.deleteGroup(group._id);
                  }}
                >
                  ✕
                </ActionIcon>
              }
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
