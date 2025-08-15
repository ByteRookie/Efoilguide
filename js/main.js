/* ---------- Minimal ZIP -> lat/lng centroids (Bay Area focused) ---------- */
const ZIP_CENTROIDS = {
  /* SF */
  "94102":[37.7793,-122.4193],"94103":[37.7739,-122.4114],"94105":[37.7890,-122.3942],
  "94107":[37.7609,-122.4017],"94109":[37.7960,-122.4220],"94110":[37.7486,-122.4158],
  "94114":[37.7583,-122.4358],"94121":[37.7771,-122.4941],"94122":[37.7609,-122.4842],
  "94123":[37.8019,-122.4380],"94124":[37.7277,-122.3828],
  /* Peninsula */
  "94080":[37.6536,-122.4194],"94404":[37.5585,-122.2689],"94401":[37.5779,-122.3202],
  "94402":[37.5256,-122.3370],"94403":[37.5387,-122.3023],"94010":[37.5779,-122.3481],
  "94025":[37.4510,-122.1826],"94063":[37.4836,-122.2050],"94065":[37.5200,-122.2520],
  "94019":[37.4636,-122.4286],
  /* East Bay */
  "94501":[37.7719,-122.2666],"94607":[37.8044,-122.2711],"94608":[37.8347,-122.2833],
  "94710":[37.8715,-122.2989],"94804":[37.9255,-122.3408],"94606":[37.7936,-122.2490],
  "94566":[37.6619,-121.8758],"94550":[37.6819,-121.7680],
  /* North Bay */
  "94965":[37.8591,-122.4853],"94920":[37.8880,-122.4555],"94952":[38.2324,-122.6367],
  "94954":[38.2437,-122.6060],"94923":[38.3332,-123.0418],
  /* South Bay */
  "95030":[37.2266,-121.9747],
  /* Napa */
  "94558":[38.5101,-122.3329]
};

let SPOTS = [];// loaded from CSV

function parseCSV(text){
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).filter(l=>l.trim()).map(line=>{
    const values = line.match(/("(?:[^"]|"")*"|[^,]+)/g) || [];
    const obj = {};
    headers.forEach((h,i)=>{
      let v = values[i] || '';
      v = v.trim();
      if(v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1).replace(/""/g,'"');
      obj[h]=v;
    });
    obj.lat = parseFloat(obj.lat);
    obj.lng = parseFloat(obj.lng);
    obj.skill = obj.skill ? obj.skill.split('|') : [];
    return obj;
  });
}

async function loadSpots(){
  const resp = await fetch('data/locations.csv');
  const text = await resp.text();
  return parseCSV(text);
}

function parseCitations(str=''){
  return str.replace(/\{\{Citation:\s*"(.*?)"\s*SourceName:\s*"([^]*?)"\s*SourceURL:\s*"([^]*?)"\s*\}\}/g,
    (_, txt, names, urls)=>{
      const nArr = names.split(/"\s*,\s*"/).map(s=>s.trim());
      const uArr = urls.split(/"\s*,\s*"/).map(s=>s.trim());
      const links = nArr.map((n,i)=>`<a href="${uArr[i]||'#'}" target="_blank">${n}</a>`).join('');
      return `${txt}<span class="cite-group">${links}</span>`;
    });
}

function detail(label,value,spanClass='',pClass=''){
  const text = parseCitations(value||'');
  const span = spanClass?`<span class="${spanClass}">${text}</span>`:text;
  return `<p class="${pClass}"><strong>${label}:</strong> ${span}</p>`;
}
/* ---------- Distance & ETA ---------- */
let ORIGIN = null; // [lat,lng]
let sortCol = 'dist';
let sortAsc = true;
let originInfo, spotsBody, q, mins, minsVal,
    waterChips, seasonChips, skillChips,  // chip sets
    zip, useGeo, filterToggle, filtersEl, headerEl, toTop, sortArrow,
    viewToggle, viewSlider, mapEl, map;

function haversine(a,b){
  const toRad = d=>d*Math.PI/180;
  const R=3958.761; // miles
  const dLat=toRad(b[0]-a[0]); const dLng=toRad(b[1]-a[1]);
  const lat1=toRad(a[0]), lat2=toRad(b[0]);
  const h=Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
// Simple road time model: first 10 mi @ 28 mph (urban), next 30 @ 45 mph, remaining @ 60 mph
function etaMinutes(mi){
  if(mi<=0) return 0;
  let left=mi, mins=0;
  const segs=[[10,28],[30,45],[Infinity,60]];
  for(const [miles,speed] of segs){
    if(left<=0) break;
    const use=Math.min(left,miles);
    mins += (use/speed)*60;
    left -= use;
  }
  // add a signal/parking fudge (5 min) for short trips, 10 min for >30mi
  mins += mi>30?10:5;
  return Math.round(mins);
}

function badgeWater(w){
  const cls={salt:'b-salt',fresh:'b-fresh',brackish:'b-brack'}[w]||'b-salt';
  const label={salt:'Salt',fresh:'Fresh',brackish:'Brackish'}[w]||w;
  return `<span class="badge ${cls}">${label}</span>`;
}
function badgeSeason(s){
  const cls={year:'b-yr','spring-fall':'b-sprfall','late-spring-fall':'b-sprfall','summer':'b-sum','winter':'b-win'}[s]||'b-yr';
  const label={year:'Year‑round','spring-fall':'Spring–Fall','late-spring-fall':'Late Spring–Fall','summer':'Summer','winter':'Winter'}[s]||s;
  return `<span class="badge ${cls}">${label}</span>`;
}
function chipsSkill(arr){
  const dot={'B':'lvle','I':'lvlm','A':'lvlh'};
  return `<span class="lvl">${arr.map(k=>`<span class="dot ${dot[k]}"></span>`).join('')}</span>`;
}

function rowHTML(s){
  const distMi = ORIGIN ? haversine(ORIGIN,[s.lat,s.lng]) : null;
  const eta = distMi!=null ? etaMinutes(distMi) : null;
  const distTxt = distMi!=null ? `${Math.round(distMi)} mi / ~${eta} min` : '—';
  return `<tr class="parent" data-id="${s.id}" data-mi="${distMi||9999}" data-eta="${eta||9999}">
    <td class="spot" data-label="Spot">${s.name}</td>
    <td data-label="Dist / Time">${distTxt}</td>
    <td data-label="Water">${badgeWater(s.water)}</td>
    <td data-label="Season">${badgeSeason(s.season)}</td>
    <td data-label="Skill">${chipsSkill(s.skill)}</td>
  </tr>
  <tr class="detail-row hide">
    <td colspan="5" class="detail">
      <div class="detail-grid">
        <img data-src="https://staticmap.openstreetmap.org/staticmap.php?center=${s.lat},${s.lng}&zoom=14&size=400x200&markers=${s.lat},${s.lng},red-pushpin" alt="${s.name} map" loading="lazy" onerror="this.remove()">
        <div class="info">
${detail('Address', s.addr)}
          ${detail('Coordinates', `<a href="https://www.google.com/maps?q=${s.lat},${s.lng}" target="_blank" class="mono">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</a>`)}
          ${detail('Launch', s.launch)}
          ${detail('Parking', s.parking)}
          ${detail('Amenities', s.amenities, 'amen')}
          ${detail('Pros', s.pros, 'ok')}
          ${detail('Cons', s.cons, 'warn')}
          ${detail('Best For', s.best)}
          ${detail('Gear Fit', s.gear)}
          ${detail('Hazards & Tips', s.tips)}
          ${detail('Laws / Regs', s.law, '', 'law')}
        </div>
      </div>
    </td>
  </tr>`;
}

function render(){
  const rows = SPOTS.slice().sort((a,b)=>{
    if(sortCol==='dist'){
      if(!ORIGIN) return a.name.localeCompare(b.name);
      const da = haversine(ORIGIN,[a.lat,a.lng]);
      const db = haversine(ORIGIN,[b.lat,b.lng]);
      return sortAsc ? da-db : db-da;
    }
    if(sortCol==='name'){
      return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    if(sortCol==='water'){
      return sortAsc ? a.water.localeCompare(b.water) : b.water.localeCompare(a.water);
    }
    if(sortCol==='season'){
      return sortAsc ? a.season.localeCompare(b.season) : b.season.localeCompare(a.season);
    }
    if(sortCol==='skill'){
      const av = a.skill.join('');
      const bv = b.skill.join('');
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return 0;
  });
  spotsBody.innerHTML = rows.map(rowHTML).join('');
  attachRowHandlers();
  if(sortArrow){
    sortArrow.textContent = sortAsc ? '▲' : '▼';
    const th = document.querySelector(`th[data-sort='${sortCol}']`);
    if(th) th.appendChild(sortArrow);
    sortArrow.style.display = sortCol==='dist' && !ORIGIN ? 'none' : '';
  }
  applyFilters(); // in case filters active
}

function attachRowHandlers(){
  document.querySelectorAll('#tbl tbody tr.parent').forEach(tr=>{
    tr.addEventListener('click',()=>{
      const wasOpen = tr.classList.contains('open');
      document.querySelectorAll('#tbl tbody tr.parent.open').forEach(o=>{
        if(o!==tr){
          o.classList.remove('open');
          const d=o.nextElementSibling;
          if(d && d.classList.contains('detail-row')) d.classList.add('hide');
        }
      });
      tr.classList.toggle('open', !wasOpen);
      const detail = tr.nextElementSibling;
      if(detail && detail.classList.contains('detail-row')){
        detail.classList.toggle('hide', wasOpen);
        if(!wasOpen){
          const img = detail.querySelector('img[data-src]');
          if(img && !img.src) img.src = img.dataset.src;
        }
      }
    });
  });
}

function initMap(){
  if(map) return;
  map = L.map('map').setView([37.7749,-122.4194],10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:18,
    attribution:'&copy; OpenStreetMap contributors'
  }).addTo(map);
  SPOTS.forEach(s=>{
    L.marker([s.lat,s.lng]).addTo(map).bindPopup(`<strong>${s.name}</strong><br>${s.city}`);
  });
}

/* ---------- Filters ---------- */
function applyFilters(){
  const qv = q.value.toLowerCase().trim();
  const useFilters = !qv;
  const allowedWater = new Set(waterChips.filter(c=>c.classList.contains('active')).map(c=>c.dataset.value));
  const allowedSeason = new Set(seasonChips.filter(c=>c.classList.contains('active')).map(c=>c.dataset.value));
  const allowedSkill = new Set(skillChips.filter(c=>c.classList.contains('active')).map(c=>c.dataset.value));
  const tmax = +mins.value;
  document.querySelectorAll('#tbl tbody tr.parent').forEach(tr=>{
    const id = tr.getAttribute('data-id');
    const s = SPOTS.find(x=>x.id===id);
    let ok = true;
    if(useFilters){
      if(!allowedWater.has(s.water)) ok=false;
      const seasonVal = s.season==='late-spring-fall' ? 'spring-fall' : s.season;
      if(!allowedSeason.has(seasonVal)) ok=false;
      if(!s.skill.some(k=>allowedSkill.has(k))) ok=false;
      if(ORIGIN){
        const eta = +tr.getAttribute('data-eta');
        if(eta > tmax) ok=false;
      }
    }
    if(qv){
      const hay = (s.name+' '+s.city+' '+s.addr+' '+s.launch+' '+s.parking+' '+s.amenities+' '+s.pros+' '+s.cons+' '+s.best+' '+s.gear+' '+s.tips+' '+s.law+' '+s.water+' '+s.season+' '+s.skill.join(' ')+' '+(s.pop||'')).toLowerCase();
      if(!hay.includes(qv)) ok=false;
    }
    tr.classList.toggle('hide', !ok);
    const detail = tr.nextElementSibling;
    if(detail && detail.classList.contains('detail-row')){
      detail.classList.toggle('hide', !ok || !tr.classList.contains('open'));
    }
  });
  minsVal.textContent = `≤ ${mins.value} min`;
}

function setupDrag(chips){
  let dragging=false, dragVal=false;
  chips.forEach(chip=>{
    chip.addEventListener('mousedown',e=>{
      dragging=true;
      dragVal=!chip.classList.contains('active');
      chip.classList.toggle('active', dragVal);
      applyFilters();
      e.preventDefault();
    });
    chip.addEventListener('mouseenter',e=>{
      if(dragging){
        chip.classList.toggle('active', dragVal);
        applyFilters();
      }
    });
  });
  document.addEventListener('mouseup',()=>dragging=false);
}

/* ---------- Origin controls ---------- */
function setOrigin(lat,lng,label){
  ORIGIN = [lat,lng];
  originInfo.textContent = `Origin set to ${label}. Table sorted by nearest distance & ETA.`;
  render();
}
  document.addEventListener('DOMContentLoaded', async () => {
    originInfo = document.getElementById('originInfo');
    spotsBody = document.getElementById('spotsBody');
    q = document.getElementById('q');
    mins = document.getElementById('mins');
    minsVal = document.getElementById('minsVal');
    waterChips = [...document.querySelectorAll('.f-water')];
    seasonChips = [...document.querySelectorAll('.f-season')];
    skillChips = [...document.querySelectorAll('.f-skill')];
    zip = document.getElementById('zip');
    useGeo = document.getElementById('useGeo');
    filterToggle = document.getElementById('filterToggle');
    filtersEl = document.getElementById('filters');
    headerEl = document.querySelector('header');
    toTop = document.getElementById('toTop');
    viewToggle = document.getElementById('viewToggle');
    viewSlider = document.getElementById('viewSlider');
    mapEl = document.getElementById('map');

    document.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if(sortCol === col){
          sortAsc = !sortAsc;
        } else {
          sortCol = col;
          sortAsc = true;
        }
        render();
      });
      th.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          th.click();
        }
      });
    });

    sortArrow = document.getElementById('sortArrow');

    let showingMap = false;
    viewToggle.addEventListener('click', () => {
      showingMap = !showingMap;
      viewSlider.style.transform = showingMap ? 'translateX(-100%)' : 'translateX(0)';
      viewToggle.textContent = showingMap ? 'Table' : 'Map';
      if(showingMap){ initMap(); setTimeout(()=>map.invalidateSize(),0); }
    });

    filterToggle.addEventListener('click', () => {
      const open = filtersEl.style.display === 'none';
      filtersEl.style.display = open ? '' : 'none';
      updateHeaderOffset();
    });

    const zipCache = JSON.parse(localStorage.getItem('zipCache') || '{}');



  function updateHeaderOffset(){
    document.documentElement.style.setProperty('--header-h', headerEl.offsetHeight + 'px');
  }
    window.addEventListener('resize', updateHeaderOffset);
    updateHeaderOffset();

    [q, mins].forEach(el => {
      el.addEventListener('input', () => {
        applyFilters();
      });
    });

setupDrag([...waterChips, ...seasonChips, ...skillChips]);

zip.addEventListener('input', async () => {
  const z = (zip.value || '').trim();
  if (z.length !== 5) return;

  if (ZIP_CENTROIDS[z]) {
    setOrigin(ZIP_CENTROIDS[z][0], ZIP_CENTROIDS[z][1], `ZIP ${z}`);
    return;
  }
  if (zipCache[z]) {
    setOrigin(zipCache[z][0], zipCache[z][1], `ZIP ${z}`);
    return;
  }

  originInfo.textContent = `Looking up ZIP ${z}…`;
  try {
    const resp = await fetch(`https://api.zippopotam.us/us/${z}`);
    if (resp.status === 404) {
      originInfo.textContent = `ZIP ${z} not found.`;
      return;
    }
    if (!resp.ok) throw new Error('Network error');
    const data = await resp.json();
    const place = data && data.places && data.places[0];
    if (place) {
      const lat = parseFloat(place.latitude);
      const lng = parseFloat(place.longitude);
      zipCache[z] = [lat, lng];
      localStorage.setItem('zipCache', JSON.stringify(zipCache));
      setOrigin(lat, lng, `ZIP ${z}`);
    } else {
      originInfo.textContent = `ZIP ${z} not found.`;
    }
  } catch {
    originInfo.textContent = `Network error while looking up ZIP ${z}.`;
  }
});

  useGeo.addEventListener('click', () => {
    if (!navigator.geolocation) {
      originInfo.textContent = 'Geolocation not supported by this browser.';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setOrigin(pos.coords.latitude, pos.coords.longitude, 'your current location'),
      () => { originInfo.textContent = 'Location permission denied or unavailable.'; }
    );
  });
  SPOTS = await loadSpots();
  render();

  window.addEventListener('scroll', () => {
    toTop.classList.toggle('show', window.scrollY > 200);
  });
  toTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
});
