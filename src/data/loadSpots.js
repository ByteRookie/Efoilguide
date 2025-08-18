export function parseCSV(text) {
  const rows = [];
  let cur = '', row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') { cur += c; }
    }
  }
  if (cur.length || row.length) { row.push(cur); }
  if (row.length) rows.push(row);
  const headers = rows.shift().map(h => h.trim());
  return rows.filter(r => r.some(cell => cell.trim() !== ''))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
      return obj;
    });
}

export async function loadSpots(retryCount = 0) {
  try {
    const resp = await fetch('data/locations.csv');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const parsed = parseCSV(text);
    return parsed.map(row => {
      const obj = { ...row };
      obj.lat = parseFloat(obj.lat);
      obj.lng = parseFloat(obj.lng);
      obj.skill = obj.skill ? obj.skill.split('|') : [];
      return obj;
    });
  } catch (err) {
    console.error('Error loading locations:', err);
    if (retryCount < 1) {
      return await loadSpots(retryCount + 1);
    }
    return [];
  }
}
