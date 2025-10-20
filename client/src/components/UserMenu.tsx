import { FormEvent, useState } from 'react';
import { User } from '../state/types';
import '../styles/base.css';

interface UserMenuProps {
  users: User[];
  currentUserId: string | null;
  onSelectUser: (id: string) => void;
  onCreateUser: (user: User) => Promise<void>;
  onRenameUser: (id: string, name: string) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
}

export default function UserMenu({ users, currentUserId, onSelectUser, onCreateUser, onRenameUser, onDeleteUser }: UserMenuProps) {
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [rename, setRename] = useState('');

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!newUserId || !newUserName) return;
    await onCreateUser({ id: newUserId, name: newUserName });
    setNewUserId('');
    setNewUserName('');
  };

  const handleRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!rename || !currentUserId) return;
    await onRenameUser(currentUserId, rename);
    setRename('');
  };

  return (
    <div className="user-menu">
      <label>
        User
        <select value={currentUserId ?? ''} onChange={(event) => onSelectUser(event.target.value)}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </label>
      <form onSubmit={handleAdd} className="user-form">
        <input placeholder="User ID" value={newUserId} onChange={(event) => setNewUserId(event.target.value)} />
        <input placeholder="Display name" value={newUserName} onChange={(event) => setNewUserName(event.target.value)} />
        <button type="submit">Add</button>
      </form>
      <form onSubmit={handleRename} className="user-form">
        <input placeholder="Rename current" value={rename} onChange={(event) => setRename(event.target.value)} />
        <button type="submit">Rename</button>
      </form>
      {currentUserId && (
        <button
          className="danger"
          onClick={async () => {
            await onDeleteUser(currentUserId);
          }}
        >
          Delete user
        </button>
      )}
    </div>
  );
}
