// Public Sessions Web (Unofficial). Only public endpoints used.
// Optional login: /auth/token, /auth/token/refresh
// Public data: /app/sessions/public, /app/sessions/search, /app/sessions/pinmap (gz), /app/sessions/coords

const els = {
  baseUrl: document.getElementById('baseUrl'),
  proxyUrl: document.getElementById('proxyUrl'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  btnLogin: document.getElementById('btnLogin'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnLogout: document.getElementById('btnLogout'),
  tokenPreview: document.getElementById('tokenPreview'),
  btnLoadPinmap: document.getElementById('btnLoadPinmap'),
  btnListPublic: document.getElementById('btnListPublic'),
  q: document.getElementById('q'),
  btnSearch: document.getElementById('btnSearch'),
  from: document.getElementById('from'),
  to: document.getElementById('to'),
  bbox: document.getElementById('bbox'),
  stats: document.getElementById('stats'),
  list: document.getElementById('list'),
  detail: document.getElementById('detail'),
};

let accessToken = localStorage.getItem('access_token') || '';
let refreshToken = localStorage.getItem('refresh_token') || '';

function showToken() {
  els.tokenPreview.textContent = accessToken ? (accessToken.slice(0,8) + '…' + accessToken.slice(-8)) : '(none)';
}

function apiUrl(path, query={}) {
  const base = els.baseUrl.value.replace(/\/+$/,'');
  const url = new URL(base + path);
  Object.entries(query).forEach(([k,v]) => { if (v !== undefined && v !== '') url.searchParams.set(k, v); });
  return url.toString();
}

function withProxy(fullUrl) {
  const proxy = (els.proxyUrl.value || '').trim();
  if (!proxy) return fullUrl;
  return proxy.replace(/\/+$/,'') + '/' + fullUrl.replace(/^https?:\/\//,'');
}

function showDiag(title, obj){
  try{
    const el = document.getElementById('detail');
    const pre = document.createElement('pre');
    pre.textContent = `${title}\n` + JSON.stringify(obj, null, 2);
    const card = document.createElement('div');
    card.className = 'card';
    card.appendChild(pre);
    el.prepend(card);
  }catch(e){}
}
async function apiFetch(path, {method='GET', headers={}, body, rawUrl, expectGzip=false, query} = {}) {
  const full = rawUrl || apiUrl(path, query);
  const target = withProxy(full);
  const hdrs = Object.assign({}, headers);
  if (accessToken) hdrs['Authorization'] = 'Bearer ' + accessToken;
  // Accept gzip body (not just content-encoding)
  hdrs['Accept'] = expectGzip ? 'application/gzip' : 'application/json, application/gzip;q=0.9, */*;q=0.8';

  hdrs['App-Version'] = hdrs['App-Version'] || '2.16.2';
  hdrs['App-Platform'] = hdrs['App-Platform'] || 'droid';
  hdrs['User-Agent'] = hdrs['User-Agent'] || 'Fliteboard/2.16.2 (Android)';
  hdrs['Accept-Language'] = hdrs['Accept-Language'] || (navigator.language || 'en-US');
  const res = await fetch(target, { method, headers: hdrs, body }).catch(err => { throw new Error(`NETWORK: ${err.message}`); });
  if (!res.ok) {
    const bodyTxt = await res.text().catch(()=>'');
    showDiag('DIAG: HTTP error', { url: target, status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), bodySnippet: bodyTxt.slice(0, 500) });
    const txt = await res.text().catch(()=>'');
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt.slice(0,300)}`);
  }
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (ctype.includes('application/gzip')) {
    showDiag('DIAG: GZIP response', { url: target, contentType: ctype });
    const ab = await res.arrayBuffer();
    const ungz = window.pako.ungzip(new Uint8Array(ab), { to: 'string' });
    return JSON.parse(ungz);
  }
  if (ctype.includes('application/json') || ctype.includes('text/json')) {
    showDiag('DIAG: JSON response', { url: target, contentType: ctype });
    return res.json();
  }
  // Try JSON anyway
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

function initMap() {
  const map = L.map('map').setView([-28.8677, 153.5794], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  const cluster = L.markerClusterGroup();
  map.addLayer(cluster);
  return { map, cluster };
}

const { map, cluster } = initMap();

function setStats(text) { els.stats.textContent = text || ''; }

function clearList() { els.list.innerHTML=''; }
function pushCard(html) {
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = html;
  els.list.appendChild(div);
}

function pinPopup(pin) {
  const when = pin.started_at ? new Date(pin.started_at).toLocaleString() : '';
  const speed = pin.top_speed_kph ? `${Number(pin.top_speed_kph).toFixed(1)} km/h` : '';
  return `<div><strong>${pin.nickname||'Rider'}</strong> ${pin.sharing_type?`<span class="badge">${pin.sharing_type}</span>`:''}</div>
          ${when?`<div>${when}</div>`:''}
          ${speed?`<div>Top speed: ${speed}</div>`:''}
          ${pin.id?`<div>ID: <code>${pin.id}</code></div>`:''}`;
}

function renderPins(pins) {
  cluster.clearLayers();
  const markers = pins.map(p => {
    const m = L.marker([p.lat || p.latitude, p.lng || p.longitude || p.lon]);
    m.bindPopup(pinPopup(p));
    m.on('click', () => {
      // try fetch detail by id if present
      if (p.id) fetchSessionCoords(p.id).catch(console.error);
    });
    return m;
  }).filter(Boolean);
  cluster.addLayers(markers);
  if (markers.length) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.2));
  }
}

async function fetchPinmap() {
  setStats('Loading pinmap…');
  try {
    const data = await apiFetch('/app/sessions/pinmap', { expectGzip: true });
    // normalize
    let pins = Array.isArray(data) ? data : (data.pins || data.items || []);
    if (!Array.isArray(pins)) throw new Error('Unexpected pinmap shape');
    renderPins(pins);
    setStats(`Pins: ${pins.length}`);
    clearList();
    pushCard(`<div><strong>Pinmap loaded.</strong> Showing ${pins.length} pins.</div>`);
  } catch (e) {
    setStats('');
    clearList();
    pushCard(`<div><strong>Error:</strong> ${e.message}</div>`);
  }
}

async function listPublic() {
  setStats('Loading public sessions…');
  clearList();
  try {
    const params = {
      limit: 50,
      offset: 0,
      from: els.from.value ? new Date(els.from.value).toISOString() : '',
      to: els.to.value ? new Date(els.to.value).toISOString() : '',
      bbox: els.bbox.value || ''
    };
    const data = await apiFetch('/app/sessions/public', { query: params });
    const items = (data && data.items) || (Array.isArray(data) ? data : []);
    setStats(`Public sessions: ${items.length}`);
    if (!items.length) pushCard('No sessions.');
    items.forEach(s => {
      pushCard(sessionCard(s));
    });
  } catch (e) {
    setStats('');
    pushCard(`<div><strong>Error:</strong> ${e.message}</div>`);
  }
}

function sessionCard(s) {
  const start = s.started_at ? new Date(s.started_at).toLocaleString() : '';
  const speed = s.top_speed_kph ? `${Number(s.top_speed_kph).toFixed(1)} km/h` : '';
  const who = s.profile?.nickname || 'Rider';
  const id = s.id || '(no id)';
  return `<div><strong>${who}</strong> ${s.sharing_type?`<span class="badge">${s.sharing_type}</span>`:''}</div>
          <div class="meta">${start} • ${speed} • id: <code>${id}</code></div>
          <div class="row">
            <button data-action="coords" data-id="${id}">Show on map</button>
          </div>`;
}

els.list.addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  if (action === 'coords') {
    const id = btn.getAttribute('data-id');
    fetchSessionCoords(id).catch(console.error);
  }
});

async function fetchSessionCoords(sessionId) {
  if (!sessionId) return;
  setStats(`Loading session ${sessionId}…`);
  els.detail.innerHTML = '';
  try {
    const data = await apiFetch('/app/sessions/coords', { query: { session_id: sessionId } });
    drawSession(data);
    els.detail.innerHTML = `<pre>${escapeHtml(JSON.stringify(slimDetail(data), null, 2))}</pre>`;
    setStats(`Loaded session ${sessionId}`);
  } catch (e) {
    els.detail.innerHTML = `<div class="card"><strong>Error:</strong> ${e.message}</div>`;
    setStats('');
  }
}

function slimDetail(d) {
  const copy = Object.assign({}, d);
  if (copy.playback_frames) {
    // truncate arrays for readability
    const pf = copy.playback_frames;
    for (const k of Object.keys(pf)) {
      if (Array.isArray(pf[k]) && pf[k].length > 12) pf[k] = pf[k].slice(0,12).concat(['…']);
    }
  }
  if (copy.coords && copy.coords.length > 2000) copy.coords = copy.coords.slice(0,100).concat(['…']);
  return copy;
}

function drawSession(data) {
  // Try shapes
  let coords = null;
  if (Array.isArray(data)) coords = data;
  else if (Array.isArray(data.coords)) coords = data.coords;
  else if (Array.isArray(data.track)) coords = data.track;
  else if (data.type === 'FeatureCollection') {
    const first = data.features?.[0];
    if (first?.geometry?.type === 'LineString') {
      coords = first.geometry.coordinates.map(([lng,lat]) => ({ lat, lng }));
    }
  }
  if (!coords || !coords.length) {
    // Drop marker at start if available
    const lat = data.start_latitude ?? data.latitude;
    const lng = data.start_longitude ?? data.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      const m = L.marker([lat,lng]).bindPopup('<strong>Session start</strong>');
      cluster.addLayer(m);
      map.setView([lat,lng], 12);
    }
    return;
  }
  const poly = L.polyline(coords.map(c => [c.lat ?? c.latitude ?? c[1], c.lng ?? c.lon ?? c.longitude ?? c[0]]), { weight: 3 });
  poly.addTo(map);
  map.fitBounds(poly.getBounds().pad(0.2));
}

function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

// Auth (optional)
els.btnLogin.addEventListener('click', async ()=>{
  try{
    const body = JSON.stringify({ email: els.email.value, password: els.password.value });
    const url = apiUrl('/auth/token');
    const res = await fetch(withProxy(url), { method:'POST', headers:{'Content-Type':'application/json'}, body });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    accessToken = data.access_token || data.token || '';
    refreshToken = data.refresh_token || '';
    localStorage.setItem('access_token', accessToken || '');
    localStorage.setItem('refresh_token', refreshToken || '');
    showToken();
    alert('Logged in (optional).');
  }catch(e){ alert('Login failed: ' + e.message) }
});

els.btnRefresh.addEventListener('click', async ()=>{
  if (!refreshToken) return alert('No refresh_token saved.');
  try{
    const body = JSON.stringify({ refresh_token: refreshToken });
    const url = apiUrl('/auth/token/refresh');
    const res = await fetch(withProxy(url), { method:'POST', headers:{'Content-Type':'application/json'}, body });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    accessToken = data.access_token || accessToken;
    localStorage.setItem('access_token', accessToken || '');
    showToken();
    alert('Token refreshed.');
  }catch(e){ alert('Refresh failed: ' + e.message) }
});

els.btnLogout.addEventListener('click', ()=>{
  accessToken=''; refreshToken='';
  localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token');
  showToken();
  alert('Logged out (optional).');
});

// Controls
els.btnLoadPinmap.addEventListener('click', fetchPinmap);
els.btnListPublic.addEventListener('click', listPublic);
els.btnSearch.addEventListener('click', async ()=>{
  setStats('Searching…'); clearList();
  try{
    const params = {
      q: els.q.value || '',
      from: els.from.value ? new Date(els.from.value).toISOString() : '',
      to: els.to.value ? new Date(els.to.value).toISOString() : '',
      bbox: els.bbox.value || '',
      limit: 50,
      offset: 0
    };
    const data = await apiFetch('/app/sessions/search', { query: params });
    const items = (data && data.items) || (Array.isArray(data) ? data : []);
    setStats(`Found: ${items.length}`);
    if (!items.length) pushCard('No results.');
    items.forEach(s => pushCard(sessionCard(s)));
  }catch(e){
    setStats(''); pushCard(`<div><strong>Error:</strong> ${e.message}</div>`);
  }
});

// Init
showToken();


document.getElementById('btnPingPublic').addEventListener('click', async ()=>{
  try{
    const data = await apiFetch('/app/sessions/public', { query: { limit: 1 } });
    showDiag('DIAG: /app/sessions/public OK', data);
    alert('Public OK (see diagnostics panel).');
  }catch(e){
    showDiag('DIAG: /app/sessions/public ERROR', { message: e.message });
    alert('Public error (see diagnostics panel).');
  }
});
document.getElementById('btnPingPinmap').addEventListener('click', async ()=>{
  try{
    const data = await apiFetch('/app/sessions/pinmap', { expectGzip: true });
    showDiag('DIAG: /app/sessions/pinmap OK', Array.isArray(data) ? { count: data.length } : data);
    alert('Pinmap OK (see diagnostics panel).');
  }catch(e){
    showDiag('DIAG: /app/sessions/pinmap ERROR', { message: e.message });
    alert('Pinmap error (see diagnostics panel).');
  }
});
document.getElementById('btnClearDiag').addEventListener('click', ()=>{ els.detail.innerHTML=''; });
