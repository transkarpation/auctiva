import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useAuth } from '@clerk/react';
import { todosApi, type Todo } from '../api/todos';

export function Todos({ groupId }: { groupId: string }) {
  const { getToken } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Drag-and-drop reordering state.
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Stable token getter matching the api's TokenGetter signature.
  const token = useCallback(() => getToken(), [getToken]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTodos(await todosApi.list(token, groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load todos');
    } finally {
      setLoading(false);
    }
  }, [token, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addTodo = () => {
    const title = newTitle.trim();
    if (!title) return;
    void run(async () => {
      const created = await todosApi.create(token, groupId, title);
      setTodos((prev) => [...prev, created]);
      setNewTitle('');
    });
  };

  // Move the dragged task to the drop position, then persist the new order.
  const handleDrop = (dropIndex: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from === null || from === dropIndex) return;

    const next = [...todos];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    setTodos(next); // optimistic

    void run(async () => {
      const saved = await todosApi.reorder(
        token,
        groupId,
        next.map((t) => t._id),
      );
      setTodos(saved);
    });
  };

  const toggle = (todo: Todo) =>
    void run(async () => {
      const updated = await todosApi.update(token, todo._id, {
        completed: !todo.completed,
      });
      setTodos((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    });

  const saveEdit = (id: string) => {
    const title = editingTitle.trim();
    if (!title) return;
    void run(async () => {
      const updated = await todosApi.update(token, id, { title });
      setTodos((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
      setEditingId(null);
      setEditingTitle('');
    });
  };

  const remove = (id: string) =>
    void run(async () => {
      await todosApi.remove(token, id);
      setTodos((prev) => prev.filter((t) => t._id !== id));
    });

  return (
    <Stack>
      <Group align="flex-end">
        <TextInput
          label="New task"
          placeholder="What needs doing?"
          style={{ flex: 1 }}
          value={newTitle}
          onChange={(e) => setNewTitle(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          disabled={busy}
        />
        <Button onClick={addTodo} loading={busy} disabled={!newTitle.trim()}>
          Add
        </Button>
      </Group>

      {error && (
        <Alert color="red" title="Error" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : todos.length === 0 ? (
        <Text c="dimmed" ta="center" py="md">
          No tasks yet — add your first one above.
        </Text>
      ) : (
        <Stack gap="xs">
          {todos.map((todo, index) => (
            <Paper
              key={todo._id}
              withBorder
              p="sm"
              radius="md"
              onDragOver={(e) => {
                if (dragIndex.current === null) return;
                e.preventDefault();
                if (overIndex !== index) setOverIndex(index);
              }}
              onDrop={() => handleDrop(index)}
              style={{
                borderTop:
                  overIndex === index && dragIndex.current !== null
                    ? '2px solid var(--mantine-color-blue-5)'
                    : undefined,
              }}
            >
              {editingId === todo._id ? (
                <Group>
                  <TextInput
                    style={{ flex: 1 }}
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(todo._id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                  />
                  <Button
                    size="xs"
                    onClick={() => saveEdit(todo._id)}
                    loading={busy}
                    disabled={!editingTitle.trim()}
                  >
                    Save
                  </Button>
                  <Button size="xs" variant="default" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </Group>
              ) : (
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Text
                      component="span"
                      c="dimmed"
                      draggable
                      onDragStart={() => {
                        dragIndex.current = index;
                      }}
                      onDragEnd={() => {
                        dragIndex.current = null;
                        setOverIndex(null);
                      }}
                      title="Drag to reorder"
                      style={{ cursor: 'grab', userSelect: 'none', flexShrink: 0 }}
                    >
                      ⠿
                    </Text>
                    <Text c="dimmed" size="sm" fw={500} w={24} ta="right" style={{ flexShrink: 0 }}>
                      {index + 1}.
                    </Text>
                    <Checkbox
                      checked={todo.completed}
                      onChange={() => toggle(todo)}
                      disabled={busy}
                      label={
                        <Text td={todo.completed ? 'line-through' : undefined} c={todo.completed ? 'dimmed' : undefined}>
                          {todo.title}
                        </Text>
                      }
                    />
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      onClick={() => {
                        setEditingId(todo._id);
                        setEditingTitle(todo.title);
                      }}
                      aria-label="Edit"
                    >
                      ✎
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => remove(todo._id)}
                      aria-label="Delete"
                    >
                      ✕
                    </ActionIcon>
                  </Group>
                </Group>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
