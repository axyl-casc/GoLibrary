import { ItemSummary, PdfBookmark, RecentItem, User } from '../state/types';

type QueryParams = Record<string, string | number | undefined>;

function buildQuery(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function getUsers(): Promise<User[]> {
  return request<User[]>('/api/users');
}

export async function createUser(user: { id: string; name: string; preferences?: Record<string, any> }): Promise<User> {
  return request<User>('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User> {
  return request<User>(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
}

export async function deleteUser(id: string): Promise<void> {
  await request<void>(`/api/users/${id}`, { method: 'DELETE' });
}

export async function getItems(params: QueryParams): Promise<ItemSummary[]> {
  return request<ItemSummary[]>(`/api/items${buildQuery(params)}`);
}

export async function getItem(id: number): Promise<ItemSummary> {
  return request<ItemSummary>(`/api/items/${id}`);
}

export async function toggleFavorite(userId: string, itemId: number, favored: boolean): Promise<void> {
  const url = `/api/users/${userId}/favorites/${itemId}`;
  if (favored) {
    await request<void>(url, { method: 'PUT' });
  } else {
    await request<void>(url, { method: 'DELETE' });
  }
}

export async function getFavorites(userId: string): Promise<ItemSummary[]> {
  return request<ItemSummary[]>(`/api/users/${userId}/favorites`);
}

export async function getPdfPosition(userId: string, itemId: number): Promise<{ page: number }> {
  return request<{ page: number }>(`/api/users/${userId}/pdf/${itemId}/position`);
}

export async function savePdfPosition(userId: string, itemId: number, page: number): Promise<void> {
  await request<void>(`/api/users/${userId}/pdf/${itemId}/position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page })
  });
}

export async function getPdfBookmarks(userId: string, itemId: number): Promise<PdfBookmark[]> {
  return request<PdfBookmark[]>(`/api/users/${userId}/pdf/${itemId}/bookmarks`);
}

export async function addPdfBookmark(userId: string, itemId: number, page: number, note?: string): Promise<PdfBookmark> {
  return request<PdfBookmark>(`/api/users/${userId}/pdf/${itemId}/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page, note })
  });
}

export async function deletePdfBookmark(userId: string, bookmarkId: number): Promise<void> {
  await request<void>(`/api/users/${userId}/pdf/bookmarks/${bookmarkId}`, { method: 'DELETE' });
}

export async function getSgfPosition(userId: string, itemId: number): Promise<{ nodeIndex: number }> {
  return request<{ nodeIndex: number }>(`/api/users/${userId}/sgf/${itemId}/position`);
}

export async function saveSgfPosition(userId: string, itemId: number, nodeIndex: number): Promise<void> {
  await request<void>(`/api/users/${userId}/sgf/${itemId}/position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeIndex })
  });
}

export async function getSgfNodeFavorites(userId: string, itemId: number): Promise<number[]> {
  return request<number[]>(`/api/users/${userId}/sgf/${itemId}/node-favs`);
}

export async function toggleSgfNodeFavorite(userId: string, itemId: number, nodeIndex: number, favored: boolean): Promise<void> {
  const url = `/api/users/${userId}/sgf/${itemId}/node-favs/${nodeIndex}`;
  if (favored) {
    await request<void>(url, { method: 'PUT' });
  } else {
    await request<void>(url, { method: 'DELETE' });
  }
}

export async function getRecents(userId: string, limit = 50): Promise<RecentItem[]> {
  return request<RecentItem[]>(`/api/users/${userId}/recents${buildQuery({ limit })}`);
}

export async function addRecent(userId: string, itemId: number): Promise<void> {
  await request<void>(`/api/users/${userId}/recents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId })
  });
}
