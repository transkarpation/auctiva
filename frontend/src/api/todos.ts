import { request, type TokenGetter } from './client';

export type Todo = {
  _id: string;
  groupId: string;
  title: string;
  completed: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export const todosApi = {
  // List todos in a single group.
  list: (getToken: TokenGetter, groupId: string) =>
    request<Todo[]>(getToken, `/todos?groupId=${encodeURIComponent(groupId)}`),

  create: (getToken: TokenGetter, groupId: string, title: string) =>
    request<Todo>(getToken, '/todos', {
      method: 'POST',
      body: JSON.stringify({ groupId, title }),
    }),

  update: (
    getToken: TokenGetter,
    id: string,
    patch: { title?: string; completed?: boolean },
  ) =>
    request<Todo>(getToken, `/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  remove: (getToken: TokenGetter, id: string) =>
    request<void>(getToken, `/todos/${id}`, { method: 'DELETE' }),

  // Persist a new ordering for a group's todos.
  reorder: (getToken: TokenGetter, groupId: string, orderedIds: string[]) =>
    request<Todo[]>(getToken, '/todos/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ groupId, orderedIds }),
    }),
};
