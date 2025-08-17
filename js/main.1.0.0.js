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
    const values=[];
    let cur='', inQuotes=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(inQuotes){
        if(ch=='"'){
          if(line[i+1]=='"'){cur+='"'; i++;}
          else inQuotes=false;
        }else{cur+=ch;}
      }else{
        if(ch=='"'){inQuotes=true;}
        else if(ch==','){values.push(cur); cur='';}
        else{cur+=ch;}
      }
    }
    values.push(cur);
    const obj={};
    headers.forEach((h,i)=>{
      const v=(values[i]||'').trim();
      obj[h]=v;
    });
    obj.lat=parseFloat(obj.lat);
    obj.lng=parseFloat(obj.lng);
    obj.skill=obj.skill?obj.skill.split('|'):[];
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
  }catch{
    IMG_CREDITS = {};
  }
}


function parseCitations(str=''){
  return str.replace(/\{\{Citation:\s*"(.*?)"\s*SourceName:\s*"([^]*?)"\s*SourceURL:\s*"([^]*?)"\s*\}\}/g,
    (_, txt, names, urls)=>{
      const nArr = names.split(/"\s*,\s*"/).map(s=>s.trim());
      const uArr = urls.split(/"\s*,\s*"/).map(s=>s.trim());
      const groups = nArr.map((n,i)=>{
        const url = uArr[i] || '#';
        return `<span class="cite-group"><a href="${url}" target="_blank">${n}</a></span>`;
      }).join('');
      return `${txt}${groups}`;
    });
}

function detail(label, value, spanClass = '', pClass = '') {
  if (value == null || String(value).trim() === '') return '';
  const text = parseCitations(String(value));
  const span = spanClass ? `<span class="${spanClass}">${text}</span>` : text;
  return `<p class="${pClass}"><strong>${label}:</strong> ${span}</p>`;
}

/* ---------- Distance & ETA ---------- */
let ORIGIN = null; // [lat,lng]
let sortCol = 'dist';
let originMsg, spotsBody, q, mins, minsVal,
    waterChips, seasonChips, skillChips,
    zip, useGeo, filtersEl, headerEl, toTop, sortArrow, tableWrap,
    tablePanel, closePanelBtn, selectedWrap, selectedTopBody, selectedBody, selectedDetail, closeSelected, map,
    editLocation, locationBox, closeLocation, searchRow;
let selectedId = null;
let markers = {};
let panelOpen = false;
let hideOthers = false;
let shrinkTable = false;
let touchStartY = 0;
let pageLocked = false;
let reopenPanel = false;
let otherCtrlDiv = null;
const MAP_START = [37.7749,-122.4194];
const MAP_ZOOM = 10;

function updateHeaderOffset(){
  const hTop = headerEl ? headerEl.offsetHeight : 0;
  document.documentElement.style.setProperty('--header-top', hTop + 'px');
  document.documentElement.style.setProperty('--header-h', hTop + 'px');
}
function handleResize(){
  updateHeaderOffset();
  checkShrink();
}

function openPanel(){
  if(tablePanel){
    tablePanel.classList.add('open');
    document.body.classList.add('panel-open');
    panelOpen = true;
    lockPageScroll(true);
  }
}
function closePanel(){
  if(tablePanel){
    tablePanel.classList.remove('open');
    document.body.classList.remove('panel-open');
    panelOpen = false;
    lockPageScroll(false);
  }
}
function togglePanel(){
  panelOpen ? closePanel() : openPanel();
}

function toggleFilters(){
  if(!filtersEl) return;
  filtersEl.classList.toggle('hidden');
  handleResize();
}

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

function milesFromMinutes(min){
  let lo=0, hi=500;
  for(let i=0;i<20;i++){
    const mid=(lo+hi)/2;
    if(etaMinutes(mid)>min) hi=mid; else lo=mid;
  }
  return lo;
}

function updateMapView(){
  if(!map) return;
  if(ORIGIN){
    const radius = milesFromMinutes(+mins.value);
    const circle = L.circle(ORIGIN,{radius:radius*1609.34});
    const bounds = circle.getBounds();
    const zoom = map.getBoundsZoom(bounds);
    map.flyTo(ORIGIN, zoom);
  }else{
    map.flyTo(MAP_START, MAP_ZOOM);
  }
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
        <div class="img-box" data-img-id="${s.id}" data-name="${s.name}" data-lat="${s.lat}" data-lng="${s.lng}"></div>
        <div class="info">
          ${detail('City', s.city)}
          ${detail('Address', s.addr)}
          ${detail('Coordinates', `<a href="https://www.google.com/maps?q=${s.lat},${s.lng}" target="_blank" class="mono">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</a>`)}
          ${detail('Launch', s.launch)}
          ${detail('Parking', s.parking)}
          ${detail('Amenities', s.amenities, 'amen')}
          ${detail('Pros', s.pros, 'ok')}
          ${detail('Cons', s.cons, 'warn')}
          ${detail('Crowd Level', s.pop)}
          ${detail('Best For', s.best)}
          ${detail('Gear Fit', s.gear)}
          ${detail('Hazards & Tips', s.tips)}
          ${detail('Laws / Regs', s.law, '', 'law')}
          ${s.parking_cost ? detail('Parking Cost', s.parking_cost) : ''}
          ${s.parking_distance_m ? detail('Parking Distance (m)', s.parking_distance_m) : ''}
          ${s.bathrooms ? detail('Bathrooms', s.bathrooms) : ''}
          ${s.showers ? detail('Showers', s.showers) : ''}
          ${s.rinse ? detail('Rinse', s.rinse) : ''}
          ${s.fees ? detail('Fees', s.fees) : ''}
          ${s.routes_beginner ? detail('Routes (Beginner)', s.routes_beginner) : ''}
          ${s.routes_pro ? detail('Routes (Pro)', s.routes_pro) : ''}
          ${s.avoid ? detail('Avoid', s.avoid) : ''}
          ${s.best_conditions ? detail('Best Conditions', s.best_conditions) : ''}
          ${s.setup_fit ? detail('Setup Fit', s.setup_fit) : ''}
          ${s.popularity ? detail('Popularity', s.popularity) : ''}
        </div>
      </div>
    </td>
  </tr>`;
}

function findImages(id){
  const files = Object.keys(IMG_CREDITS)
    .filter(k => k.startsWith(`${id}.`) || k.startsWith(`${id}_`))
    .sort((a,b)=>{
      const aNum = parseInt(a.match(/_(\d+)\./)?.[1] || '0',10);
      const bNum = parseInt(b.match(/_(\d+)\./)?.[1] || '0',10);
      return aNum - bNum;
    });
  return files.map(f => `data/img/${f}`);
}

async function loadImages(){
  const boxes=document.querySelectorAll('.img-box[data-img-id]');
  for(const box of boxes){
    const id=box.getAttribute('data-img-id');
    const name=box.getAttribute('data-name')||'';
    const lat=parseFloat(box.getAttribute('data-lat'));
    const lng=parseFloat(box.getAttribute('data-lng'));
    const srcs=findImages(id);

    box.innerHTML='';

    if(srcs.length===0){
      const mapDiv=document.createElement('div');
      mapDiv.className='mini-map';
      box.appendChild(mapDiv);
      createMiniMap(mapDiv, lat, lng);
      box.insertAdjacentHTML('beforeend', `<div class="img-credit">Map data &copy; <a href="https://www.openstreetmap.org/" target="_blank">OpenStreetMap contributors</a></div>`);
      continue;
    }

    const toggle=document.createElement('div');
    toggle.className='media-toggle';
    const imgBtn=document.createElement('button');
    imgBtn.textContent='Images';
    imgBtn.className='active';
    const mapBtn=document.createElement('button');
    mapBtn.textContent='Map';
    toggle.appendChild(imgBtn);
    toggle.appendChild(mapBtn);
    box.appendChild(toggle);

    const carousel=document.createElement('div');
    carousel.className='img-carousel';
    srcs.forEach((src,idx)=>{
      const slide=document.createElement('div');
      slide.className='slide'+(idx===0?' active':'');
      const img=document.createElement('img');
      img.src=src;
      img.alt=`${name} image`;
      img.loading='lazy';
      img.onerror=()=>slide.remove();
      slide.appendChild(img);
      const file=src.split('/').pop();
      const credit=IMG_CREDITS[file];
      if(credit && (credit.sourceName || credit.sourceURL)){
        const creditName=credit.sourceName||credit.sourceURL||'';
        const url=credit.sourceURL;
        const html=url?`<a href="${url}" target="_blank">${creditName}</a>`:creditName;
        slide.insertAdjacentHTML('beforeend', `<div class="img-credit">Source: ${html}</div>`);
      }
      carousel.appendChild(slide);
    });
    if(srcs.length>1){
      const prev=document.createElement('button');
      prev.className='prev';
      prev.textContent='‹';
      const next=document.createElement('button');
      next.className='next';
      next.textContent='›';
      carousel.appendChild(prev);
      carousel.appendChild(next);
      const slidesEls=carousel.querySelectorAll('.slide');
      let idx=0;
      function show(n){
        idx=(n+slidesEls.length)%slidesEls.length;
        slidesEls.forEach((sl,i)=>sl.classList.toggle('active', i===idx));
      }
      prev.addEventListener('click',()=>show(idx-1));
      next.addEventListener('click',()=>show(idx+1));
    }
    box.appendChild(carousel);

    const mapHolder=document.createElement('div');
    mapHolder.className='map-holder';
    const mapDiv=document.createElement('div');
    mapDiv.className='mini-map';
    mapHolder.appendChild(mapDiv);
    mapHolder.insertAdjacentHTML('beforeend', `<div class="img-credit">Map data &copy; <a href="https://www.openstreetmap.org/" target="_blank">OpenStreetMap contributors</a></div>`);
    mapHolder.style.display='none';
    box.appendChild(mapHolder);

    let mapInit=false;
    imgBtn.addEventListener('click',()=>{
      imgBtn.classList.add('active');
      mapBtn.classList.remove('active');
      carousel.style.display='';
      mapHolder.style.display='none';
    });
    mapBtn.addEventListener('click',()=>{
      mapBtn.classList.add('active');
      imgBtn.classList.remove('active');
      carousel.style.display='none';
      mapHolder.style.display='';
      if(!mapInit){ createMiniMap(mapDiv, lat, lng); mapInit=true; }
    });
  }
}

function showSelected(s, fromList=false){
  if(fromList && panelOpen){
    closePanel();
    reopenPanel = true;
  }else{
    reopenPanel = false;
  }
  const temp = document.createElement('tbody');
  temp.innerHTML = rowHTML(s);
  const topRow = temp.querySelector('tr.parent');
  const detail = temp.querySelector('tr.detail-row');
  if(topRow){
    topRow.classList.remove('parent');
    topRow.removeAttribute('data-id');
    topRow.querySelectorAll('td').forEach(td=>{
      const lbl = td.getAttribute('data-label');
      if(lbl) td.innerHTML = `<span class="cell-label">${lbl}:</span> ` + td.innerHTML;
    });
  }
  if(detail) detail.classList.remove('hide');
  selectedTopBody.innerHTML = '';
  if(topRow) selectedTopBody.appendChild(topRow);
  selectedBody.innerHTML = '';
  if(detail) selectedBody.appendChild(detail);
  selectedDetail.scrollTop = 0;
  const info = selectedBody.querySelector('.info');
  if(info) info.scrollTop = 0;
  selectedWrap.classList.remove('hidden');
  selectedWrap.classList.add('show');
  loadImages();
}

function clearSelected(){
  if(selectedId && markers[selectedId]) setMarkerSelected(markers[selectedId], false);
  selectedTopBody.innerHTML='';
  selectedBody.innerHTML='';
  selectedWrap.classList.remove('show');
  selectedWrap.classList.add('hidden');
  document.querySelectorAll('#tbl tbody tr.parent.open').forEach(o=>{
    o.classList.remove('open');
    const d=o.nextElementSibling;
    if(d && d.classList.contains('detail-row')) d.classList.add('hide');
  });
  if(reopenPanel){
    openPanel();
    reopenPanel = false;
  }
  updateOtherMarkers();
  hideOthers = false;
}

function setMarkerSelected(marker, sel){
  const el = marker && marker.getElement ? marker.getElement() : null;
  if(el) el.classList.toggle('selected', sel);
}

function flyToSpot(latlng){
  if(!map) return;
  map.flyTo(latlng,16);
  map.once('moveend',()=>{
    if(selectedWrap && selectedWrap.classList.contains('show')){
      const offset = selectedWrap.offsetHeight/2;
      map.panBy([0, offset]);
    }
  });
}

function updateOtherMarkers(){
  if(otherCtrlDiv) otherCtrlDiv.classList.toggle('hidden', !selectedId);
  if(!selectedId) hideOthers = false;
  Object.entries(markers).forEach(([id, marker])=>{
    if(id === selectedId){
      if(!map.hasLayer(marker)) marker.addTo(map);
    }else{
      if(hideOthers && selectedId){
        if(map.hasLayer(marker)) map.removeLayer(marker);
      }else{
        if(!map.hasLayer(marker)) marker.addTo(map);
      }
    }
  });
}


function moveSortArrow(th){
  if(sortArrow) th.appendChild(sortArrow);
  document.querySelectorAll('#tbl thead th').forEach(cell=>cell.removeAttribute('aria-sort'));
  th.setAttribute('aria-sort','ascending');
}

function updateTableScroll(){
  if(!tableWrap || !spotsBody) return;
  const rows = [...spotsBody.querySelectorAll('tr.parent:not(.hide)')];
  if(rows.length===0){
    tableWrap.classList.remove('scroll');
    spotsBody.style.maxHeight='';
    return;
  }
  const h = rows[0].getBoundingClientRect().height;
  const top = tableWrap.getBoundingClientRect().top;
  const avail = window.innerHeight - top;
  const maxVisible = Math.floor(avail / h);
  const target = shrinkTable ? 5 : 10;
  const maxRows = Math.min(target, maxVisible);
  if(rows.length>maxRows){
    tableWrap.classList.add('scroll');
    spotsBody.style.maxHeight = h*maxRows + 'px';
  }else{
    tableWrap.classList.remove('scroll');
    spotsBody.style.maxHeight='';
  }
}

function tableInView(){
  if(!tableWrap) return false;
  const rect = tableWrap.getBoundingClientRect();
  const headerH = headerEl ? headerEl.offsetHeight : 0;
  return rect.top <= headerH + 5 && rect.bottom > headerH;
}

function consumeTableScroll(dy){
  if(!tableWrap || !tableWrap.classList.contains('scroll')) return false;
  if(!tableInView()) return false;
  const atTop = spotsBody.scrollTop === 0;
  const atBottom = spotsBody.scrollTop + spotsBody.clientHeight >= spotsBody.scrollHeight;
  if((dy < 0 && !atTop) || (dy > 0 && !atBottom)){
    spotsBody.scrollTop += dy;
    lockPageScroll(true);
    return true;
  }
  lockPageScroll(false);
  return false;
}

function consumeDetailScroll(dy){
  if(!selectedDetail || selectedDetail.scrollHeight <= selectedDetail.clientHeight) return false;
  const atTop = selectedDetail.scrollTop === 0;
  const atBottom = selectedDetail.scrollTop + selectedDetail.clientHeight >= selectedDetail.scrollHeight;
  if((dy < 0 && !atTop) || (dy > 0 && !atBottom)){
    selectedDetail.scrollTop += dy;
    lockPageScroll(true);
    return true;
  }
  lockPageScroll(false);
  return false;
}

function lockPageScroll(lock){
  if(lock && !pageLocked){
    document.documentElement.style.overflow = 'hidden';
    pageLocked = true;
  }else if(!lock && pageLocked){
    document.documentElement.style.overflow = '';
    pageLocked = false;
  }
}

function handleWheel(e){
  if(consumeTableScroll(e.deltaY) || consumeDetailScroll(e.deltaY)) e.preventDefault();
}

function handleTouchStart(e){
  touchStartY = e.touches[0].clientY;
}

function handleTouchMove(e){
  const dy = touchStartY - e.touches[0].clientY;
  if(consumeTableScroll(dy) || consumeDetailScroll(dy)){
    touchStartY = e.touches[0].clientY;
    e.preventDefault();
  }
}

function checkShrink(){
  const shouldShrink = window.scrollY>0 || window.innerHeight<700;
  if(shouldShrink !== shrinkTable){
    shrinkTable = shouldShrink;
    if(shrinkTable && spotsBody){
      spotsBody.scrollTop = 0;
      lockPageScroll(true);
    }
    updateTableScroll();
  }
}

function render(){
  const rows = SPOTS.slice().sort((a,b)=>{
    switch(sortCol){
      case 'dist':{
        if(!ORIGIN) return a.name.localeCompare(b.name);
        const da = haversine(ORIGIN,[a.lat,a.lng]);
        const db = haversine(ORIGIN,[b.lat,b.lng]);
        return da-db;
      }
      case 'water':
        return a.water.localeCompare(b.water);
      case 'season':
        return a.season.localeCompare(b.season);
      case 'skill':
        return (a.skill[0]||'').localeCompare(b.skill[0]||'');
      default:
        return a.name.localeCompare(b.name);
    }
  });
  spotsBody.innerHTML = rows.map(rowHTML).join('');
  attachRowHandlers();
  applyFilters(); // in case filters active
  loadImages();
}

function attachRowHandlers(){
  document.querySelectorAll('#tbl tbody tr.parent').forEach(tr=>{
    tr.addEventListener('click',()=>{
      const id = tr.getAttribute('data-id');
      if(selectedId && selectedId!==id && markers[selectedId]) setMarkerSelected(markers[selectedId], false);
      selectedId = id;
      if(markers[id]){
        setMarkerSelected(markers[id], true);
        flyToSpot(markers[id].getLatLng());
        const spot = SPOTS.find(s=>s.id===id);
        if(spot) showSelected(spot, true);
        updateOtherMarkers();
      }
    });
  });
}


function applyTileScheme(m){
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
  function apply(){
    const next = mq.matches ? dark : light;
    if(baseLayer) m.removeLayer(baseLayer);
    baseLayer = next.addTo(m);
  }
  mq.addEventListener('change', apply);
  apply();
}

function initMap(){
  if(map) return;
  map = L.map('map').setView(MAP_START, MAP_ZOOM);

  applyTileScheme(map);

  SPOTS.forEach(s=>{
    const marker = L.marker([s.lat, s.lng]).addTo(map);
    markers[s.id] = marker;
    marker.on('click', () => {
      flyToSpot([s.lat, s.lng]);
      if(selectedId === s.id){
        setMarkerSelected(marker,false);
        selectedId = null;
        clearSelected();
        updateOtherMarkers();
      }else{
        if(selectedId && markers[selectedId]) setMarkerSelected(markers[selectedId], false);
        selectedId = s.id;
        setMarkerSelected(marker,true);
        showSelected(s);
        updateOtherMarkers();
      }
    });
  });
  map.on('click', () => {
    if(selectedId && markers[selectedId]) setMarkerSelected(markers[selectedId], false);
    selectedId = null;
    clearSelected();
    updateOtherMarkers();
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
      L.DomEvent.stopPropagation(e);
      map.setView(MAP_START, MAP_ZOOM);
    });
    return div;
  };
  reset.addTo(map);

  const listCtrl = L.control({position:'topleft'});
  listCtrl.onAdd = function(){
    const div = L.DomUtil.create('div','leaflet-bar');
    const a = L.DomUtil.create('a','',div);
    a.href='#';
    a.innerHTML='≡';
    a.title='Show list';
    L.DomEvent.on(a,'click',e=>{L.DomEvent.preventDefault(e);L.DomEvent.stopPropagation(e);togglePanel();});
    return div;
  };
  listCtrl.addTo(map);

  const filterCtrl = L.control({position:'topright'});
  filterCtrl.onAdd = function(){
    const div = L.DomUtil.create('div','leaflet-bar');
    const a = L.DomUtil.create('a','',div);
    a.href='#';
    a.innerHTML='⚙';
    a.title='Filters';
    L.DomEvent.on(a,'click',e=>{L.DomEvent.preventDefault(e);L.DomEvent.stopPropagation(e);toggleFilters();});
    return div;
  };
  filterCtrl.addTo(map);

  const otherCtrl = L.control({position:'topright'});
  otherCtrl.onAdd = function(){
    const div = L.DomUtil.create('div','leaflet-bar hidden');
    const a = L.DomUtil.create('a','',div);
    a.href='#';
    a.innerHTML='👁';
    a.title='Show other spots';
    L.DomEvent.on(a,'click',e=>{L.DomEvent.preventDefault(e);L.DomEvent.stopPropagation(e);hideOthers=!hideOthers;updateOtherMarkers();});
    otherCtrlDiv = div;
    return div;
  };
  otherCtrl.addTo(map);

  applyFilters();
  updateOtherMarkers();
}

function createMiniMap(el, lat, lng){
  const m = L.map(el, { attributionControl:false }).setView([lat, lng], 17);
  applyTileScheme(m);
  L.marker([lat, lng]).addTo(m);
  window.setTimeout(()=>m.invalidateSize(),0);
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
  updateMapView();
  updateTableScroll();
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
  updateMapView();
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
    filtersEl = document.getElementById('filters');
    headerEl = document.querySelector('header');
    toTop = document.getElementById('toTop');
    tablePanel = document.getElementById('tablePanel');
    closePanelBtn = document.getElementById('closePanel');
    selectedWrap = document.getElementById('selectedWrap');
    selectedTopBody = document.getElementById('selectedTopBody');
    selectedBody = document.getElementById('selectedBody');
    selectedDetail = document.getElementById('selectedDetail');
    closeSelected = document.getElementById('closeSelected');
    tableWrap = document.querySelector('.table-wrap');

    if(closeSelected){
      closeSelected.addEventListener('click', ()=>{
        clearSelected();
        selectedId = null;
      });
    }
    if(closePanelBtn){
      closePanelBtn.addEventListener('click', ()=>closePanel());
    }

    window.addEventListener('wheel', handleWheel, {passive:false});
    window.addEventListener('touchstart', handleTouchStart, {passive:false});
    window.addEventListener('touchmove', handleTouchMove, {passive:false});

    document.querySelectorAll('#tbl thead th.sortable').forEach(th => {
      th.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          th.click();
        }
      });
      th.addEventListener('click', () => {
        sortCol = th.dataset.sort;
        moveSortArrow(th);
        render();
      });
    });

    sortArrow = document.getElementById('sortArrow');

    editLocation.addEventListener('click', e => {
      e.preventDefault();
      editLocation.classList.add('hidden');
      locationBox.classList.remove('hidden');
      searchRow.style.marginTop = '8px';
      zip.focus();
      handleResize();
    });

    closeLocation.addEventListener('click', () => {
      locationBox.classList.add('hidden');
      editLocation.classList.remove('hidden');
      searchRow.style.marginTop = '';
      handleResize();
    });

    const zipCache = JSON.parse(localStorage.getItem('zipCache') || '{}');



  window.addEventListener('resize', handleResize);
  handleResize();

    q.addEventListener('input', () => {
      applyFilters();
    });
    mins.addEventListener('input', () => {
      applyFilters();
    });
    mins.addEventListener('change', () => {
      applyFilters();
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
  initMap();
  applyFilters();

  window.addEventListener('scroll', () => {
    toTop.classList.toggle('show', window.scrollY > 200);
    checkShrink();
  });
  toTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
});
