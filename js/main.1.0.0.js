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

async function loadSpots(){
  const resp = await fetch('data/locations.csv');
  const text = await resp.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return parsed.data.map(row => {
    const obj = { ...row };
    obj.lat = parseFloat(obj.lat);
    obj.lng = parseFloat(obj.lng);
    obj.skill = obj.skill ? obj.skill.split('|') : [];
    return obj;
  });
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

function detail(label, value, spanClass = '', wrapClass = '', icon = '') {
  if (value == null || String(value).trim() === '') return '';
  const text = parseCitations(String(value));
  const span = spanClass ? `<span class="${spanClass}">${text}</span>` : text;
  const iconSpan = icon ? `<span class="icon" aria-hidden="true">${icon}</span>` : '';
  return `<div class="detail-item ${wrapClass}"><div class="detail-label">${iconSpan}${label}</div><div class="detail-value">${span}</div></div>`;
}

function detailSection(title, items, icon = '') {
  const content = items.filter(Boolean).join('');
  if (!content) return '';
  const iconSpan = icon ? `<span class="icon" aria-hidden="true">${icon}</span>` : '';
  return `<div class="detail-section"><h4>${iconSpan}${title}</h4><div class="detail-section-grid">${content}</div></div>`;
}

/* ---------- Distance & ETA ---------- */
let ORIGIN = null; // [lat,lng]
let sortCol = 'dist';
let originMsg, spotsBody, q, qSuggest, qClear, searchWrap, searchToggle, mins, minsVal,
    waterChips, seasonChips, skillChips,
    zip, useGeo, filtersEl, headerEl, sortArrow,
    tablePanel, closePanelBtn, selectedWrap, selectedTop, selectedTopBody, selectedBody, selectedDetail, closeSelected, map,
    editLocation, locationBox, filterBtn, infoBtn, infoPopup, closeInfo, panelGrip, siteTitle;
let selectedId = null;
let markers = {};
let panelOpen = false;
let hideOthers = false;
let pageLocked = false;
let reopenPanel = false;
let otherCtrlDiv = null;
let listCtrlLink = null;
let otherCtrlLink = null;
let sheetOffset = 0;
let sheetDragStartY = 0;
let sheetDragStartOffset = 0;
let resumeId = null;
let suggestIndex = -1;
const MAP_START = [37.7749,-122.4194];
const MAP_ZOOM = 10;
const SEARCH_COLLAPSE_W = 150; // px width to collapse search

function updateHeaderOffset(){
  const hTop = headerEl ? headerEl.offsetHeight : 0;
  document.documentElement.style.setProperty('--header-h', hTop + 'px');
}
function handleResize(){
  updateHeaderOffset();
  checkShrink();
  if(selectedWrap && selectedWrap.classList.contains('show')){
    updateSheetTransform();
    updateSheetHeight();
  }
}

function openPanel(){
  if(selectedWrap && selectedWrap.classList.contains('show')){
    resumeId = selectedId;
    clearSelected();
    selectedId = null;
  }else{
    resumeId = null;
  }
  if(tablePanel){
    tablePanel.classList.add('open');
    tablePanel.setAttribute('aria-hidden','false');
    document.body.classList.add('panel-open');
    panelOpen = true;
    document.documentElement.style.setProperty('--panel-w', tablePanel.offsetWidth + 'px');
    lockPageScroll(true);
    if(listCtrlLink){
      listCtrlLink.classList.add('active');
      listCtrlLink.innerHTML = '✕';
      listCtrlLink.title = 'Hide list';
    }
  }
}
function closePanel(){
  if(tablePanel){
    tablePanel.classList.remove('open');
    tablePanel.setAttribute('aria-hidden','true');
    document.body.classList.remove('panel-open');
    panelOpen = false;
    lockPageScroll(false);
    if(listCtrlLink){
      listCtrlLink.classList.remove('active');
      listCtrlLink.innerHTML = '≡';
      listCtrlLink.title = 'Show list';
    }
    if(resumeId){
      const id = resumeId;
      const spot = SPOTS.find(s=>s.id===id);
      resumeId = null;
      if(spot){
        selectedId = id;
        showSelected(spot);
      }
    }
  }
}
function togglePanel(){
  panelOpen ? closePanel() : openPanel();
}

function toggleFilters(){
  if(!filtersEl || !filterBtn) return;
  filtersEl.classList.toggle('hidden');
  const open = !filtersEl.classList.contains('hidden');
  filterBtn.classList.toggle('open', open);
  filterBtn.classList.toggle('active', open);
  if(open && locationBox){
    locationBox.classList.add('hidden');
    locationBox.setAttribute('aria-hidden','true');
    if(editLocation) editLocation.classList.remove('active');
  }
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
  const infoDetails = [
    detail('Water', badgeWater(s.water), '', '', '💧'),
    detail('Season', badgeSeason(s.season), '', '', '📅'),
    detail('Skill', chipsSkill(s.skill), '', '', '🎯')
  ];
  const locationDetails = [
    detail('City', `<a href="https://maps.google.com/?q=${encodeURIComponent(s.city)}" target="_blank">${s.city}</a>`, '', '', '🏙️'),
    detail('Address', `<a href="https://maps.google.com/?q=${encodeURIComponent(s.addr)}" target="_blank">${s.addr}</a>`, '', '', '📍'),
    detail('Coordinates', `<a href="https://www.google.com/maps?q=${s.lat},${s.lng}" target="_blank" class="mono">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</a>`, '', '', '🧭')
  ];
  const launchDetails = [
    detail('Launch', s.launch, '', '', '⚓️'),
    detail('Parking', s.parking, '', '', '🅿️'),
    detail('Amenities', s.amenities, 'amen', '', '🏖️')
  ];
  const safetyDetails = [
    detail('Pros', s.pros, 'ok', '', '✅'),
    detail('Cons', s.cons, 'warn', '', '⚠️'),
    detail('Crowd Level', s.pop, '', '', '👥'),
    detail('Best For', s.best, '', '', '🏆'),
    detail('Hazards & Tips', s.tips, '', 'span-2', '🚧'),
    detail('Avoid', s.avoid, '', 'span-2', '⛔'),
    detail('Best Conditions', s.best_conditions, '', 'span-2', '🌤️')
  ];
  const lawsDetails = [
    detail('Laws / Regs', s.law, '', 'law span-2', '📜')
  ];
  const routesDetails = [
    s.routes_beginner ? detail('Routes (Beginner)', s.routes_beginner, '', 'span-2', '🧭') : '',
    s.routes_pro ? detail('Routes (Pro)', s.routes_pro, '', 'span-2', '🚀') : ''
  ];
  const gearDetails = [
    detail('Gear Fit', s.gear, '', 'span-2', '🛠️'),
    s.setup_fit ? detail('Setup Fit', s.setup_fit, '', 'span-2', '⚙️') : ''
  ];
  const miscDetails = [
    s.parking_cost ? detail('Parking Cost', s.parking_cost, '', '', '💲') : '',
    s.parking_distance_m ? detail('Parking Distance (m)', s.parking_distance_m, '', '', '📏') : '',
    s.bathrooms ? detail('Bathrooms', s.bathrooms, '', '', '🚻') : '',
    s.showers ? detail('Showers', s.showers, '', '', '🚿') : '',
    s.rinse ? detail('Rinse', s.rinse, '', '', '💧') : '',
    s.fees ? detail('Fees', s.fees, '', '', '💵') : '',
    s.popularity ? detail('Popularity', s.popularity, '', '', '📈') : ''
  ];
  const sections = [
    detailSection('Spot Info', infoDetails, 'ℹ️'),
    detailSection('Location', locationDetails, '📍'),
    detailSection('Launch, Parking & Amenities', launchDetails, '⚓️'),
    detailSection('Safety & Conditions', safetyDetails, '⚠️'),
    detailSection('Laws & Regulations', lawsDetails, '📘'),
    detailSection('Routes', routesDetails, '🧭'),
    detailSection('Setup & Gear', gearDetails, '🛠️'),
    detailSection('Other', miscDetails, '➕')
  ].join('');
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
        <div class="img-box" data-img-id="${s.id}" data-name="${s.name}"></div>
        <div class="detail-grip"></div>
        <div class="info">${sections}</div>
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
    const srcs=findImages(id);
    if(srcs.length===0){
      const grip=box.nextElementSibling;
      if(grip && grip.classList.contains('detail-grip')) grip.remove();
      box.remove();
      continue;
    }
    box.innerHTML='';
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
      let startX=null;
      carousel.addEventListener('touchstart',e=>{startX=e.touches[0].clientX;},{passive:true});
      carousel.addEventListener('touchend',e=>{
        if(startX===null) return;
        const dx=e.changedTouches[0].clientX-startX;
        if(Math.abs(dx)>30){
          if(dx<0) show(idx+1); else show(idx-1);
        }
        startX=null;
      },{passive:true});
    }
    box.appendChild(carousel);
  }
}

function showSelected(s, fromList=false){
  resumeId = null;
  if(panelOpen){
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
    const cells = Array.from(topRow.querySelectorAll('td'));
    cells.forEach((td, idx)=>{
      const lbl = td.getAttribute('data-label');
      if(lbl) td.innerHTML = `<span class="cell-label">${lbl}:</span> ` + td.innerHTML;
      if(idx > 1) td.remove();
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
  selectedWrap.setAttribute('aria-hidden','false');
  sheetOffset = window.innerWidth >= 768 ? window.innerHeight / 2 : 0;
  updateSheetTransform();
  updateSheetHeight();
  selectedWrap.classList.add('show');
  loadImages();
  setupDetailDrag();
  if(s && s.lat && s.lng) flyToSpot([s.lat, s.lng]);
}

function clearSelected(){
  if(selectedId && markers[selectedId]) setMarkerSelected(markers[selectedId], false);
  selectedTopBody.innerHTML='';
  selectedBody.innerHTML='';
  selectedWrap.classList.remove('show');
  selectedWrap.classList.add('hidden');
  selectedWrap.setAttribute('aria-hidden','true');
  selectedWrap.style.transform='';
  selectedWrap.style.height='';
  if(selectedDetail) selectedDetail.style.maxHeight='';
  sheetOffset = 0;
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
      const visible = selectedWrap.offsetHeight - sheetOffset;
      const offset = Math.max(0, visible/2 - 80);
      map.panBy([0, offset]);
    }
  });
}

function updateOtherMarkers(){
  if(otherCtrlDiv) otherCtrlDiv.classList.toggle('hidden', !selectedId);
  if(!selectedId) hideOthers = false;
  if(otherCtrlLink){
    otherCtrlLink.classList.toggle('active', hideOthers);
    otherCtrlLink.innerHTML = hideOthers ? '🙈' : '👁';
    otherCtrlLink.title = hideOthers ? 'Show other spots' : 'Hide other spots';
  }
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

function lockPageScroll(lock){
  if(lock && !pageLocked){
    document.documentElement.style.overflow = 'hidden';
    pageLocked = true;
  }else if(!lock && pageLocked){
    document.documentElement.style.overflow = '';
    pageLocked = false;
  }
}

function startSheetDrag(e){
  if(!selectedWrap || !selectedWrap.classList.contains('show')) return;
  sheetDragStartY = e.touches ? e.touches[0].clientY : e.clientY;
  sheetDragStartOffset = sheetOffset;
  selectedWrap.style.transition = 'none';
  document.addEventListener('touchmove', sheetDragMove, {passive:false});
  document.addEventListener('touchend', endSheetDrag);
  document.addEventListener('mousemove', sheetDragMove);
  document.addEventListener('mouseup', endSheetDrag);
}

function sheetDragMove(e){
  const y = e.touches ? e.touches[0].clientY : e.clientY;
  let dy = y - sheetDragStartY;
  let newOffset = sheetDragStartOffset + dy;
  const max = window.innerHeight - 80;
  if(newOffset < 0) newOffset = 0;
  if(newOffset > max) newOffset = max;
  sheetOffset = newOffset;
  updateSheetTransform();
  updateSheetHeight();
  e.preventDefault();
}

function endSheetDrag(){
  selectedWrap.style.transition = '';
  document.removeEventListener('touchmove', sheetDragMove);
  document.removeEventListener('touchend', endSheetDrag);
  document.removeEventListener('mousemove', sheetDragMove);
  document.removeEventListener('mouseup', endSheetDrag);
}

function updateSheetTransform(){
  if(!selectedWrap) return;
  selectedWrap.style.transform = `translate(-50%, ${sheetOffset}px)`;
}

function updateSheetHeight(){
  if(!selectedWrap) return;
  const h = window.innerHeight - sheetOffset;
  selectedWrap.style.height = h + 'px';
  if(selectedDetail && selectedTop){
    const topH = selectedTop.offsetHeight;
    selectedDetail.style.maxHeight = (h - topH) + 'px';
  }
}

function setupDetailDrag(){
  const grip = selectedBody ? selectedBody.querySelector('.detail-grip') : null;
  const img = selectedBody ? selectedBody.querySelector('.img-box') : null;
  if(!grip || !img) return;
  let startX = 0;
  let startW = 0;
  grip.addEventListener('mousedown', e=>{
    startX = e.clientX;
    startW = img.offsetWidth;
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
  });
  grip.addEventListener('touchstart', e=>{
    startX = e.touches[0].clientX;
    startW = img.offsetWidth;
    document.addEventListener('touchmove', move, {passive:false});
    document.addEventListener('touchend', up);
    e.preventDefault();
  }, {passive:false});
  function move(e){
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const w = startW + (x - startX);
    if(w>100) img.style.flex = `0 0 ${w}px`;
  }
  function up(){
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', up);
  }
}

function checkShrink(){
  if(!searchWrap) return;
  if(searchWrap.classList.contains('full')) return;
  if(searchWrap.offsetWidth < SEARCH_COLLAPSE_W){
    document.body.classList.add('search-collapsed');
  }else{
    document.body.classList.remove('search-collapsed');
    if(headerEl) headerEl.classList.remove('searching');
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
    const el = marker.getElement();
    if(el){
      el.setAttribute('tabindex','0');
      el.setAttribute('role','button');
      el.setAttribute('aria-label', s.name);
      el.addEventListener('keydown', ev=>{
        if(ev.key === 'Enter' || ev.key === ' '){
          ev.preventDefault();
          marker.fire('click');
        }
      });
    }
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
    a.setAttribute('aria-label','Reset view');
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
    a.setAttribute('aria-label','Show list');
    listCtrlLink = a;
    L.DomEvent.on(a,'click',e=>{L.DomEvent.preventDefault(e);L.DomEvent.stopPropagation(e);togglePanel();});
    return div;
  };
  listCtrl.addTo(map);

  const otherCtrl = L.control({position:'topright'});
  otherCtrl.onAdd = function(){
    const div = L.DomUtil.create('div','leaflet-bar hidden');
    const a = L.DomUtil.create('a','',div);
    a.href='#';
    a.innerHTML='👁';
    a.title='Show other spots';
    a.setAttribute('aria-label','Show other spots');
    otherCtrlLink = a;
    L.DomEvent.on(a,'click',e=>{L.DomEvent.preventDefault(e);L.DomEvent.stopPropagation(e);hideOthers=!hideOthers;updateOtherMarkers();});
    otherCtrlDiv = div;
    return div;
  };
  otherCtrl.addTo(map);

  applyFilters();
  updateOtherMarkers();
  updateHeaderOffset();
}

/* ---------- Filters ---------- */
function applyFilters(){
  const qv = q.value.toLowerCase().trim();
  const useFilters = !qv;
  const allowedWater = new Set(waterChips.filter(c=>c.classList.contains('active')).map(c=>c.dataset.value));
  const allowedSeason = new Set(seasonChips.filter(c=>c.classList.contains('active')).map(c=>c.dataset.value));
  const allowedSkill = new Set(skillChips.filter(c=>c.classList.contains('active')).map(c=>c.dataset.value));
  const tmax = +mins.value;
  let anyVisible = false;
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
    if(ok) anyVisible = true;
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
  const noRow = document.getElementById('noResultsRow');
  if(!anyVisible){
    if(!noRow){
      const tr = document.createElement('tr');
      tr.id = 'noResultsRow';
      tr.className = 'no-results';
      tr.innerHTML = '<td colspan="5">No results</td>';
      spotsBody.appendChild(tr);
    }
  }else if(noRow){
    noRow.remove();
  }
  minsVal.textContent = `≤ ${mins.value} min`;
  if(!selectedId) updateMapView();
}

function hideSuggestions(){
  if(!qSuggest) return;
  qSuggest.innerHTML='';
  qSuggest.classList.add('hidden');
  qSuggest.setAttribute('aria-hidden','true');
  suggestIndex = -1;
}

function updateSuggestions(){
  if(!qSuggest) return;
  const qv = q.value.trim().toLowerCase();
  if(!qv){
    hideSuggestions();
    return;
  }
  const matches = SPOTS.filter(s=>s.name.toLowerCase().includes(qv)).slice(0,5);
  if(matches.length===0){
    hideSuggestions();
    return;
  }
  qSuggest.innerHTML = matches.map(m=>`<li data-id="${m.id}" role="option">${m.name}</li>`).join('');
  qSuggest.classList.remove('hidden');
  qSuggest.setAttribute('aria-hidden','false');
  suggestIndex = -1;
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
  if(locationBox){
    locationBox.classList.add('hidden');
    if(editLocation) editLocation.classList.remove('active');
    handleResize();
  }
}
  document.addEventListener('DOMContentLoaded', async () => {
    originMsg = document.getElementById('originMsg');
    editLocation = document.getElementById('editLocation');
    locationBox = document.getElementById('locationBox');
    spotsBody = document.getElementById('spotsBody');
    q = document.getElementById('q');
    qSuggest = document.getElementById('qSuggest');
    qClear = document.getElementById('qClear');
    searchWrap = document.querySelector('.search-wrap');
    searchToggle = document.getElementById('searchToggle');
    mins = document.getElementById('mins');
    minsVal = document.getElementById('minsVal');
    waterChips = [...document.querySelectorAll('.f-water')];
    seasonChips = [...document.querySelectorAll('.f-season')];
    skillChips = [...document.querySelectorAll('.f-skill')];
    zip = document.getElementById('zip');
    useGeo = document.getElementById('useGeo');
    filtersEl = document.getElementById('filters');
    headerEl = document.querySelector('header');
    tablePanel = document.getElementById('tablePanel');
    closePanelBtn = document.getElementById('closePanel');
    selectedWrap = document.getElementById('selectedWrap');
    selectedTop = document.getElementById('selectedTop');
    selectedTopBody = document.getElementById('selectedTopBody');
    selectedBody = document.getElementById('selectedBody');
    selectedDetail = document.getElementById('selectedDetail');
    closeSelected = document.getElementById('closeSelected');
    filterBtn = document.getElementById('filterBtn');
    infoBtn = document.getElementById('infoBtn');
    infoPopup = document.getElementById('infoPopup');
    closeInfo = document.getElementById('closeInfo');
    siteTitle = document.querySelector('header h1');
    const yearEl = document.getElementById('year');
    if(yearEl) yearEl.textContent = new Date().getFullYear();

    if(closeSelected){
      closeSelected.addEventListener('click', ()=>{
        clearSelected();
        selectedId = null;
      });
    }
    if(closePanelBtn){
      closePanelBtn.addEventListener('click', ()=>closePanel());
    }
    panelGrip = document.getElementById('panelGrip');
    if(panelGrip && tablePanel){
      let startX = 0, startW = 0;
      const move = e => {
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        let w = startW + (x - startX);
        const min = 260;
        const max = window.innerWidth * 0.9;
        if(w < min) w = min;
        if(w > max) w = max;
        document.documentElement.style.setProperty('--panel-w', w + 'px');
        tablePanel.style.width = w + 'px';
        handleResize();
      };
      const stop = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', stop);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', stop);
      };
      panelGrip.addEventListener('mousedown', e => {
        startX = e.clientX;
        startW = tablePanel.offsetWidth;
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
        e.preventDefault();
      });
      panelGrip.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startW = tablePanel.offsetWidth;
        document.addEventListener('touchmove', move, {passive:false});
        document.addEventListener('touchend', stop);
        e.preventDefault();
      }, {passive:false});
    }

    if(selectedTop){
      selectedTop.addEventListener('mousedown', startSheetDrag);
      selectedTop.addEventListener('touchstart', startSheetDrag, {passive:false});
    }
    if(searchToggle && searchWrap && q){
      searchToggle.addEventListener('click', () => {
        searchWrap.classList.add('full');
        if(headerEl) headerEl.classList.add('searching');
        q.focus();
      });
    }
    if(filterBtn){
      filterBtn.addEventListener('click', e=>{e.preventDefault();toggleFilters();});
    }
    if(infoBtn && infoPopup){
      infoBtn.addEventListener('click', e => {
        e.preventDefault();
        const hidden = infoPopup.classList.toggle('hidden');
        infoPopup.setAttribute('aria-hidden', hidden);
        infoBtn.classList.toggle('active', !hidden);
        lockPageScroll(!hidden);
      });
    }
    if(closeInfo && infoPopup && infoBtn){
      closeInfo.addEventListener('click', () => {
        infoPopup.classList.add('hidden');
        infoPopup.setAttribute('aria-hidden','true');
        infoBtn.classList.remove('active');
        lockPageScroll(false);
      });
    }

    if(siteTitle){
      siteTitle.addEventListener('click', () => {
        if(panelOpen) closePanel();
        clearSelected();
        selectedId = null;
        if(filtersEl){
          filtersEl.classList.add('hidden');
          if(filterBtn) filterBtn.classList.remove('active','open');
        }
        if(locationBox){
          locationBox.classList.add('hidden');
          locationBox.setAttribute('aria-hidden','true');
          if(editLocation) editLocation.classList.remove('active');
        }
        if(infoPopup){
          infoPopup.classList.add('hidden');
          infoPopup.setAttribute('aria-hidden','true');
          if(infoBtn) infoBtn.classList.remove('active');
          lockPageScroll(false);
        }
        if(q){
          q.value = '';
          if(qClear) qClear.classList.add('hidden');
          hideSuggestions();
          applyFilters();
        }
        map.setView(MAP_START, MAP_ZOOM);
        updateOtherMarkers();
      });
    }

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
      const open = !locationBox.classList.contains('hidden');
      locationBox.classList.toggle('hidden', open);
      locationBox.setAttribute('aria-hidden', open);
      editLocation.classList.toggle('active', !open);
      if(!open){
        zip.focus();
        if(filtersEl) filtersEl.classList.add('hidden');
        if(filterBtn) filterBtn.classList.remove('active','open');
      }
      handleResize();
    });

    const zipCache = JSON.parse(localStorage.getItem('zipCache') || '{}');



  window.addEventListener('resize', handleResize);
  handleResize();

    q.addEventListener('input', () => {
      updateSuggestions();
      applyFilters();
      if(qClear) qClear.classList.toggle('hidden', q.value==='');
    });
    q.addEventListener('keydown', e=>{
      if(!qSuggest || qSuggest.classList.contains('hidden')) return;
      const items=[...qSuggest.querySelectorAll('li')];
      if(e.key==='ArrowDown'){
        if(items.length){
          suggestIndex=(suggestIndex+1)%items.length;
          items.forEach((li,i)=>{li.classList.toggle('active',i===suggestIndex);li.setAttribute('aria-selected',i===suggestIndex);});
          e.preventDefault();
        }
      }else if(e.key==='ArrowUp'){
        if(items.length){
          suggestIndex=(suggestIndex-1+items.length)%items.length;
          items.forEach((li,i)=>{li.classList.toggle('active',i===suggestIndex);li.setAttribute('aria-selected',i===suggestIndex);});
          e.preventDefault();
        }
      }else if(e.key==='Enter'){
        if(items.length && suggestIndex>=0){
          const li=items[suggestIndex];
          const id=li.dataset.id;
          const spot=SPOTS.find(s=>s.id===id);
          if(spot){
            q.value=spot.name;
            hideSuggestions();
            if(selectedId && selectedId!==id && markers[selectedId]) setMarkerSelected(markers[selectedId], false);
            selectedId=id;
            if(markers[id]) setMarkerSelected(markers[id], true);
            showSelected(spot, true);
            updateOtherMarkers();
            applyFilters();
            if(document.body.classList.contains('search-collapsed') && searchWrap){
              searchWrap.classList.remove('full');
              if(headerEl) headerEl.classList.remove('searching');
              q.blur();
              checkShrink();
            }
          }
          e.preventDefault();
        }
      }else if(e.key==='Escape'){
        hideSuggestions();
      }
    });
    if(qClear){
      qClear.addEventListener('click', e => {
        e.preventDefault();
        q.value='';
        qClear.classList.add('hidden');
        hideSuggestions();
        applyFilters();
        if(document.body.classList.contains('search-collapsed') && searchWrap){
          searchWrap.classList.remove('full');
          if(headerEl) headerEl.classList.remove('searching');
          checkShrink();
        }else{
          q.focus();
        }
      });
    }
    if(qSuggest){
      const choose = e => {
        const li = e.target.closest('li[data-id]');
        if(!li) return;
        e.preventDefault();
        const id = li.dataset.id;
        const spot = SPOTS.find(s=>s.id===id);
        if(!spot) return;
        q.value = spot.name;
        hideSuggestions();
        if(selectedId && selectedId!==id && markers[selectedId]) setMarkerSelected(markers[selectedId], false);
        selectedId = id;
        if(markers[id]) setMarkerSelected(markers[id], true);
        showSelected(spot, true);
        updateOtherMarkers();
        applyFilters();
        if(document.body.classList.contains('search-collapsed') && searchWrap){
          searchWrap.classList.remove('full');
          if(headerEl) headerEl.classList.remove('searching');
          q.blur();
          checkShrink();
        }
      };
      qSuggest.addEventListener('mousedown', choose);
      qSuggest.addEventListener('touchstart', choose, {passive:false});
      q.addEventListener('blur', () => {
        window.setTimeout(() => {
          hideSuggestions();
          if(document.body.classList.contains('search-collapsed') && searchWrap && q.value.trim()===''){
            searchWrap.classList.remove('full');
            if(headerEl) headerEl.classList.remove('searching');
            checkShrink();
          }
        },100);
      });
    }
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

  useGeo.addEventListener('click', (e) => {
    e.preventDefault();
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

  window.addEventListener('scroll', checkShrink);
});
