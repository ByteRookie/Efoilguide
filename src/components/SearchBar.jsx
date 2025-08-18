import { useState } from 'react';

export default function SearchBar({ spots, onSearch }) {
  const [query, setQuery] = useState('');
  const suggestions = query
    ? spots.filter(s => s.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    onSearch(val);
  }

  function clear() {
    setQuery('');
    onSearch('');
  }

  return (
    <div className="search-wrap">
      <input value={query} onChange={handleChange} placeholder="Search all details" aria-label="Search spots" />
      {query && <button onClick={clear} aria-label="Clear search">✕</button>}
      {suggestions.length > 0 && (
        <ul className="suggestions" role="listbox">
          {suggestions.map(s => (
            <li key={s.id} onClick={() => { setQuery(s.name); onSearch(s.name); }}>{s.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
