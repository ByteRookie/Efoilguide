export function haversine(a, b) {
  const toRad = d => d * Math.PI / 180;
  const R = 3958.761; // miles
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]), lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function loadZipData() {
  try {
    const resp = await fetch('data/Zip/us-zips.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const lookup = await resp.json();
    const list = Object.entries(lookup).map(([z, [lat, lng]]) => ({ z, lat, lng }));
    return { lookup, list };
  } catch (err) {
    console.error('Error loading ZIP data:', err);
    return { lookup: {}, list: [] };
  }
}

export function findNearestZip(lat, lng, list) {
  let nearest = null, best = Infinity;
  for (const item of list) {
    const d = haversine([lat, lng], [item.lat, item.lng]);
    if (d < best) { best = d; nearest = item.z; }
  }
  return nearest;
}
