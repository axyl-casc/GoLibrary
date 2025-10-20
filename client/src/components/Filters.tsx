import { ChangeEvent } from 'react';
import '../styles/shelf.css';

interface FiltersProps {
  query: Record<string, string | undefined>;
  onChange: (patch: Record<string, string>) => void;
}

export default function Filters({ query, onChange }: FiltersProps) {
  const handleSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({ [event.target.name]: event.target.value });
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ [event.target.name]: event.target.value });
  };

  return (
    <div className="filters">
      <select name="type" value={query.type ?? ''} onChange={handleSelect}>
        <option value="">All types</option>
        <option value="pdf">PDF</option>
        <option value="sgf">SGF</option>
        <option value="html">HTML</option>
      </select>
      <select name="sort" value={query.sort ?? 'updatedAt'} onChange={handleSelect}>
        <option value="updatedAt">Recently updated</option>
        <option value="title">Title</option>
        <option value="recent">Recently added</option>
        <option value="lastOpened">Last opened</option>
      </select>
      <input
        type="search"
        name="q"
        placeholder="Search title or path"
        value={query.q ?? ''}
        onChange={handleInput}
      />
    </div>
  );
}
