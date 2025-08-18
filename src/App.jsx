import { useState, useEffect } from 'react';
import MapView from './components/MapView.jsx';
import TablePanel from './components/TablePanel.jsx';
import SearchBar from './components/SearchBar.jsx';
import { loadSpots } from './data/loadSpots.js';
import { loadZipData } from './data/loadZipData.js';

export default function App() {
  const [spots, setSpots] = useState([]);
  const [zipData, setZipData] = useState({ lookup: {}, list: [] });
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadSpots().then(setSpots);
    loadZipData().then(setZipData);
  }, []);

  const filtered = query
    ? spots.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    : spots;

  return (
    <>
      <header>
        <div className="wrap">
          <h1>eFoil Guide</h1>
          <SearchBar spots={spots} onSearch={setQuery} />
        </div>
      </header>
      <main id="main">
        <MapView spots={filtered} />
        <TablePanel spots={filtered} />
      </main>
      <footer id="siteFooter">© eFoil Guide</footer>
    </>
  );
}
