import { ChangeEvent, useEffect, useId, useMemo, useState } from 'react';
import '../styles/shelf.css';
import { QueryState } from '../state/useQuery';

interface FiltersProps {
  query: QueryState;
  onChange: (patch: Record<string, string>) => void;
  favoritesEnabled?: boolean;
}

const typeOptions: Array<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'PDF', value: 'pdf' },
  { label: 'SGF', value: 'sgf' },
  { label: 'HTML', value: 'html' }
];

export default function Filters({ query, onChange, favoritesEnabled = false }: FiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const searchId = useId();

  useEffect(() => {
    if (!favoritesEnabled && query.favorites === 'true') {
      onChange({ favorites: '' });
    }
  }, [favoritesEnabled, onChange, query.favorites]);

  const handleSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({ [event.target.name]: event.target.value });
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ [event.target.name]: event.target.value });
  };

  const toggleFilters = () => {
    setShowFilters((prev) => !prev);
  };

  const handleTypeSelect = (value: string) => {
    onChange({ type: value });
  };

  const handleFavoritesToggle = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ favorites: event.target.checked ? 'true' : '' });
  };

  const hasActiveFilters = useMemo(() => {
    const hasType = Boolean(query.type);
    const hasFavorites = query.favorites === 'true';
    const hasSearch = Boolean(query.q && query.q.trim().length > 0);
    return hasType || hasFavorites || hasSearch;
  }, [query.favorites, query.q, query.type]);

  return (
    <div className="filters">
      <div className={`filter-tab ${showFilters ? 'open' : ''}`}>
        <button
          type="button"
          className={`filter-tab-toggle ${hasActiveFilters ? 'active' : ''}`}
          onClick={toggleFilters}
          aria-expanded={showFilters}
        >
          Filters
        </button>
        {showFilters && (
          <div className="filter-tab-panel" role="region" aria-label="Filter items">
            <div className="filter-section">
              <span className="filter-section-label">Type</span>
              <div className="filter-pill-group" role="group" aria-label="Filter by type">
                {typeOptions.map((option) => {
                  const isActive = (query.type ?? '') === option.value;
                  return (
                    <button
                      key={option.value || 'all'}
                      type="button"
                      className={`filter-pill ${isActive ? 'active' : ''}`}
                      onClick={() => handleTypeSelect(option.value)}
                      aria-pressed={isActive}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="filter-checkbox">
              <input
                type="checkbox"
                name="favorites"
                checked={query.favorites === 'true'}
                onChange={handleFavoritesToggle}
                disabled={!favoritesEnabled}
              />
              Favorites only
            </label>
            <div className="filter-search">
              <label htmlFor={searchId}>Search</label>
              <input
                id={searchId}
                type="search"
                name="q"
                placeholder="Search title or path"
                value={query.q ?? ''}
                onChange={handleInput}
              />
            </div>
          </div>
        )}
      </div>
      <select name="sort" value={query.sort ?? 'updatedAt'} onChange={handleSelect}>
        <option value="updatedAt">Recently updated</option>
        <option value="title">Title</option>
        <option value="recent">Recently added</option>
        <option value="lastOpened">Last opened</option>
      </select>
    </div>
  );
}
