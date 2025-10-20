import { useCallback, useEffect, useMemo, useState } from 'react';
import { createUser, deleteUser, getUsers, updateUser } from '../api/api';
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
    if (!currentUserId) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && list.find((user) => user.id === stored)) {
        setCurrentUserId(stored);
      } else if (list.length > 0) {
        setCurrentUserId(list[0].id);
        localStorage.setItem(STORAGE_KEY, list[0].id);
      }
    }
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(STORAGE_KEY, currentUserId);
    }
  }, [currentUserId]);

  const currentUser = useMemo(() => users.find((user) => user.id === currentUserId) ?? null, [users, currentUserId]);

  const selectUser = useCallback((id: string) => {
    setCurrentUserId(id);
  }, []);

  const createNewUser = useCallback(
    async (user: User) => {
      await createUser(user);
      await loadUsers();
      setCurrentUserId(user.id);
    },
    [loadUsers]
  );

  const updateCurrentUser = useCallback(
    async (id: string, patch: Partial<User>) => {
      await updateUser(id, patch);
      await loadUsers();
    },
    [loadUsers]
  );

  const deleteUserById = useCallback(
    async (id: string) => {
      if (currentUserId === id) {
        setCurrentUserId(null);
      }
      await deleteUser(id);
      await loadUsers();
    },
    [currentUserId, loadUsers]
  );

  return {
    users,
    currentUser,
    currentUserId,
    loading,
    selectUser,
    createNewUser,
    updateCurrentUser,
    deleteUserById,
    refresh: loadUsers
  };
}
