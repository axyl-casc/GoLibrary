import { User } from '../state/types';
import '../styles/base.css';

interface UserMenuProps {
  users: User[];
  currentUserId: string | null;
  onSelectUser: (id: string) => void;
}

export default function UserMenu({ users, currentUserId, onSelectUser }: UserMenuProps) {
  const hasUsers = users.length > 0;
  const value = hasUsers ? currentUserId ?? users[0].id : '';

  return (
    <div className="user-menu">
      <label>
        User
        <select
          value={value}
          onChange={(event) => onSelectUser(event.target.value)}
          disabled={!hasUsers}
        >
          {hasUsers ? (
            users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))
          ) : (
            <option value="">No users available</option>
          )}
        </select>
      </label>
    </div>
  );
}
