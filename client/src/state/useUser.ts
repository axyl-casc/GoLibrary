import { useCallback, useEffect, useMemo, useState } from 'react';
import { getUsers } from '../api/api';
import { User } from './types';

const STORAGE_KEY = 'go-library-user';

export function useUser() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const list = await getUsers();
    setUsers(list);
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedUser = stored ? list.find((user) => user.id === stored) : undefined;

    let nextId: string | null = null;
    if (list.length === 0) {
      nextId = null;
    } else if (currentUserId && list.some((user) => user.id === currentUserId)) {
      nextId = currentUserId;
    } else if (storedUser) {
      nextId = storedUser.id;
    } else {
      nextId = list[0].id;
    }

    setCurrentUserId(nextId);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(STORAGE_KEY, currentUserId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [currentUserId]);

  const currentUser = useMemo(() => users.find((user) => user.id === currentUserId) ?? null, [users, currentUserId]);

  const selectUser = useCallback((id: string) => {
    setCurrentUserId(id);
  }, []);

  return {
    users,
    currentUser,
    currentUserId,
    loading,
    selectUser,
    refresh: loadUsers
  };
}
