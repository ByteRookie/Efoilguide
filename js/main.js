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
let IMG_CREDITS = {};// loaded from JSON mapping filenames to credit info

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


async function loadImageCredits(){
  try{
    const resp = await fetch('data/img/sources.json');
    if(resp.ok){
      IMG_CREDITS = await resp.json();
    }
  }catch(e){
    IMG_CREDITS = {};
  }
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
let sortCol = 'name';
let originMsg, spotsBody, q, mins, minsVal,
    waterChips, seasonChips, skillChips,  // chip sets
    zip, useGeo, filterToggle, filtersEl, headerEl, toTop, sortArrow,
    viewToggle, viewWindow, viewSlider, mapView, mapEl, selectedWrap, selectedBody, map,
    editLocation, locationBox, closeLocation, searchRow;
let showingMap = false;
let selectedId = null;
let markers = {};
const MAP_START = [37.7749,-122.4194];
const MAP_ZOOM = 10;

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
        <div class="img-box">
          <img data-img-id="${s.id}" alt="${s.name} image" loading="lazy">
        </div>
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

async function findImage(id){
  const exts=['jpg','jpeg','png','gif','webp'];
  let latest=0, chosen=null;
  await Promise.all(exts.map(async ext=>{
    const url=`data/img/${id}.${ext}`;
    try{
      const resp=await fetch(url,{method:'HEAD'});
      if(resp.ok){
        const lm=resp.headers.get('last-modified');
        const t=lm?new Date(lm).getTime():0;
        if(t>=latest){latest=t; chosen=url;}
      }
    }catch(e){}
  }));
  return chosen;
}

async function loadImages(){
  const defaultSrc = await findImage('default');
  const imgs=document.querySelectorAll('img[data-img-id]');
  for(const img of imgs){
    const id=img.getAttribute('data-img-id');
    let src=await findImage(id);
    if(!src && defaultSrc) src=defaultSrc;
    if(src){
      img.src=src;
      img.onerror=()=>img.remove();
      const file=src.split('/').pop();
      const credit=IMG_CREDITS[file];
      if(credit && (credit.sourceName || credit.sourceURL)){
        const name=credit.sourceName||credit.sourceURL||'';
        const url=credit.sourceURL;
        const html=url?`<a href="${url}" target="_blank">${name}</a>`:name;
        const wrap=img.parentElement;
        wrap.insertAdjacentHTML('beforeend', `<div class="img-credit">Source: ${html}</div>`);
      }
    }else{
      img.remove();
    }
  }
}

function showSelected(s){
  selectedBody.innerHTML = rowHTML(s);
  const tr = selectedBody.querySelector('tr.parent');
  if(tr){
    // prepend column labels so the summary row is self‑describing
    for(const td of tr.querySelectorAll('td[data-label]')){
      const label = td.getAttribute('data-label');
      td.innerHTML = `<strong>${label}:</strong> ${td.innerHTML}`;
    }
    tr.classList.add('open');
    const detail = tr.nextElementSibling;
    if(detail) detail.classList.remove('hide');
  }
  selectedWrap.style.display='';
  loadImages();
  updateMapHeights();
}

function clearSelected(){
  selectedBody.innerHTML='';
  selectedWrap.style.display='none';
  updateMapHeights();
}

function setMarkerSelected(marker, sel){
  const el = marker && marker.getElement ? marker.getElement() : null;
  if(el) el.classList.toggle('selected', sel);
}

function updateMapHeights(){
  if(!showingMap) return;
  const top = viewWindow.getBoundingClientRect().top;
  const avail = window.innerHeight - top;
  viewWindow.style.height = avail + 'px';
  if(map) map.invalidateSize();
}

function render(){
  // sort by distance if origin set; otherwise by name
  const rows = SPOTS.slice().sort((a,b)=>{
    if(!ORIGIN){
      sortCol = 'name';
      return a.name.localeCompare(b.name);
    }
    sortCol = 'dist';
    const da = haversine(ORIGIN,[a.lat,a.lng]);
    const db = haversine(ORIGIN,[b.lat,b.lng]);
    return da-db;
  });
  spotsBody.innerHTML = rows.map(rowHTML).join('');
  attachRowHandlers();
  if(sortArrow) sortArrow.style.display = ORIGIN ? '' : 'none';
  applyFilters(); // in case filters active
  loadImages();
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
      }
    });
  });
}

function initMap(){
  if(map) return;
  map = L.map('map').setView(MAP_START, MAP_ZOOM);

  const light = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:18,
    attribution:'&copy; OpenStreetMap contributors'
  });
  const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom:18,
    attribution:'&copy; OpenStreetMap contributors &copy; CARTO'
  });
  let baseLayer;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function applyScheme(){
    const next = mq.matches ? dark : light;
    if(baseLayer) map.removeLayer(baseLayer);
    baseLayer = next.addTo(map);
  }
  mq.addEventListener('change', applyScheme);
  applyScheme();

  SPOTS.forEach(s=>{
    const marker = L.marker([s.lat, s.lng]).addTo(map);
    markers[s.id] = marker;
    marker.on('click', () => {
      map.flyTo([s.lat, s.lng], 13);
      if(selectedId === s.id){
        setMarkerSelected(marker,false);
        selectedId = null;
        clearSelected();
      }else{
        if(selectedId && markers[selectedId]) setMarkerSelected(markers[selectedId], false);
        selectedId = s.id;
        setMarkerSelected(marker,true);
        showSelected(s);
      }
    });
  });
  map.on('click', () => {
    if(selectedId && markers[selectedId]) setMarkerSelected(markers[selectedId], false);
    selectedId = null;
    clearSelected();
  });

  const reset = L.control({position:'topleft'});
  reset.onAdd = function(){
    const div = L.DomUtil.create('div','leaflet-bar');
    const a = L.DomUtil.create('a','',div);
    a.href = '#';
    a.innerHTML = '↺';
    a.title = 'Reset view';
    L.DomEvent.on(a,'click',e=>{
      L.DomEvent.preventDefault(e);
      map.setView(MAP_START, MAP_ZOOM);
    });
    return div;
  };
  reset.addTo(map);

  applyFilters();
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
    if(map && markers[id]){
      if(ok){
        if(!map.hasLayer(markers[id])) markers[id].addTo(map);
      }else{
        if(map.hasLayer(markers[id])) markers[id].remove();
        if(selectedId === id){
          setMarkerSelected(markers[id], false);
          selectedId = null;
          clearSelected();
        }
      }
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
  originMsg.textContent = `Origin set to ${label}. Table sorted by nearest distance & ETA.`;
  render();
}
  document.addEventListener('DOMContentLoaded', async () => {
    originMsg = document.getElementById('originMsg');
    editLocation = document.getElementById('editLocation');
    locationBox = document.getElementById('locationBox');
    closeLocation = document.getElementById('closeLocation');
    spotsBody = document.getElementById('spotsBody');
    q = document.getElementById('q');
    mins = document.getElementById('mins');
    minsVal = document.getElementById('minsVal');
    searchRow = document.getElementById('searchRow');
    waterChips = [...document.querySelectorAll('.f-water')];
    seasonChips = [...document.querySelectorAll('.f-season')];
    skillChips = [...document.querySelectorAll('.f-skill')];
    zip = document.getElementById('zip');
    useGeo = document.getElementById('useGeo');
    filterToggle = document.getElementById('filterToggle');
    filtersEl = document.getElementById('filters');
    // ensure toggle text matches initial state
    const filtersHidden = filtersEl.style.display === 'none';
    filterToggle.textContent = filtersHidden ? 'Show filters' : 'Hide filters';
    filterToggle.setAttribute('aria-expanded', filtersHidden ? 'false' : 'true');
    headerEl = document.querySelector('header');
    toTop = document.getElementById('toTop');
    viewToggle = document.getElementById('viewToggle');
    viewWindow = document.getElementById('viewWindow');
    viewSlider = document.getElementById('viewSlider');
    mapView = document.getElementById('mapView');
    mapEl = document.getElementById('map');
    selectedWrap = document.getElementById('selectedWrap');
    selectedBody = document.getElementById('selectedBody');

    document.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          th.click();
        }
      });
    });

    sortArrow = document.getElementById('sortArrow');

    viewToggle.addEventListener('click', () => {
      showingMap = !showingMap;
      viewSlider.style.transform = showingMap ? 'translateX(-100%)' : 'translateX(0)';
      viewToggle.textContent = showingMap ? 'Table' : 'Map';
      if(showingMap){
        // size the container before Leaflet initializes to avoid a zero-height map
        updateMapHeights();
        initMap();
        applyFilters();
        // run again once visible so Leaflet recalculates dimensions
        requestAnimationFrame(updateMapHeights);
      }else{
        viewWindow.style.height = '';
        clearSelected();
      }
    });

      // toggle filters visibility and button label
      filterToggle.addEventListener('click', () => {
        const willOpen = filtersEl.style.display === 'none';
        filtersEl.style.display = willOpen ? '' : 'none';
        filterToggle.textContent = willOpen ? 'Hide filters' : 'Show filters';
        filterToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        handleResize();
      });

    editLocation.addEventListener('click', e => {
      e.preventDefault();
      editLocation.style.display = 'none';
      locationBox.style.display = '';
      searchRow.style.marginTop = '8px';
      zip.focus();
      handleResize();
    });

    closeLocation.addEventListener('click', () => {
      locationBox.style.display = 'none';
      editLocation.style.display = '';
      searchRow.style.marginTop = '';
      handleResize();
    });

    const zipCache = JSON.parse(localStorage.getItem('zipCache') || '{}');



  function updateHeaderOffset(){
    document.documentElement.style.setProperty('--header-h', headerEl.offsetHeight + 'px');
  }
  function handleResize(){
    updateHeaderOffset();
    updateMapHeights();
  }
  window.addEventListener('resize', handleResize);
  handleResize();

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

  originMsg.textContent = `Looking up ZIP ${z}…`;
  try {
    const resp = await fetch(`https://api.zippopotam.us/us/${z}`);
    if (resp.status === 404) {
      originMsg.textContent = `ZIP ${z} not found.`;
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
      originMsg.textContent = `ZIP ${z} not found.`;
    }
  } catch {
    originMsg.textContent = `Network error while looking up ZIP ${z}.`;
  }
});

  useGeo.addEventListener('click', () => {
    if (!navigator.geolocation) {
      originMsg.textContent = 'Geolocation not supported by this browser.';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setOrigin(pos.coords.latitude, pos.coords.longitude, 'your current location'),
      () => { originMsg.textContent = 'Location permission denied or unavailable.'; }
    );
  });
  SPOTS = await loadSpots();
  await loadImageCredits();
  render();

  window.addEventListener('scroll', () => {
    toTop.classList.toggle('show', window.scrollY > 200);
  });
  toTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
});
