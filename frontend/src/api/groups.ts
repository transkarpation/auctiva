import { request, type TokenGetter } from './client';

export type Group = {
  _id: string;
  name: string;
  slug?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

// URL segment for a group: its slug, falling back to the id for legacy groups
// created before slugs existed.
export function groupPath(group: Pick<Group, '_id' | 'slug'>): string {
  return group.slug ?? group._id;
}

// A public group from any user, with its tasks and progress (discovery view).
export type PublicGroup = {
  _id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  total: number;
  completed: number;
  todos: { _id: string; title: string; completed: boolean }[];
};

export const groupsApi = {
  list: (getToken: TokenGetter) => request<Group[]>(getToken, '/groups'),

  // Discovery feed: all public groups across every user.
  listPublic: (getToken: TokenGetter) =>
    request<PublicGroup[]>(getToken, '/groups/public'),

  create: (getToken: TokenGetter, name: string) =>
    request<Group>(getToken, '/groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  update: (
    getToken: TokenGetter,
    id: string,
    patch: { name?: string; isPublic?: boolean },
  ) =>
    request<Group>(getToken, `/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  remove: (getToken: TokenGetter, id: string) =>
    request<void>(getToken, `/groups/${id}`, { method: 'DELETE' }),
};
