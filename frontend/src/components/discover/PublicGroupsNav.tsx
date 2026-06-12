import { useMatch, useNavigate } from 'react-router-dom';
import { Group, Loader, NavLink, Stack, Text } from '@mantine/core';
import type { UsePublicGroups } from '../../hooks/usePublicGroups';

// Wide-column content for the Discover view: the list of public groups.
export function PublicGroupsNav({ p }: { p: UsePublicGroups }) {
  const navigate = useNavigate();
  const match = useMatch('/discover/:groupId');
  const activeId = match?.params.groupId;

  if (p.loading) {
    return (
      <Group justify="center" py="md">
        <Loader size="sm" />
      </Group>
    );
  }

  if (p.groups.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No public groups yet.
      </Text>
    );
  }

  return (
    <Stack gap={4}>
      {p.groups.map((group) => (
        <NavLink
          key={group._id}
          active={group._id === activeId}
          label={group.name}
          description={`${group.ownerName} · ${group.completed}/${group.total}`}
          onClick={() => navigate(`/discover/${group._id}`)}
        />
      ))}
    </Stack>
  );
}
