import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function MapView({ spots }) {
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('map').setView([37.7749, -122.4194], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = spots.map(s =>
      L.marker([s.lat, s.lng]).addTo(mapRef.current).bindPopup(s.name)
    );
  }, [spots]);

  return <div id="map" style={{ height: '400px' }} />;
}
