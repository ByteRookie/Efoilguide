const ETA_TOOLTIP = 'ETAs use a simple urban/highway model; check your nav app for exact routing.';
let ORIGIN = null;

function haversine(a, b){
  const toRad = d => d * Math.PI / 180;
  const R = 3958.761; // miles
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]), lat2 = toRad(b[0]);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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
  mins += mi>30?10:5;
  return Math.round(mins);
}

function badgeWater(w){
  const cls={salt:'b-salt',fresh:'b-fresh',brackish:'b-brack'}[w]||'b-salt';
  const label={salt:'Salt',fresh:'Fresh',brackish:'Brackish'}[w]||w;
  const span=document.createElement('span');
  span.className=`badge ${cls}`;
  span.textContent=label;
  return span;
}
function badgeSeason(s){
  const cls={year:'b-yr','spring-fall':'b-sprfall','late-spring-fall':'b-sprfall','summer':'b-sum','winter':'b-win'}[s]||'b-yr';
  const label={year:'Year‑round','spring-fall':'Spring–Fall','late-spring-fall':'Late Spring–Fall','summer':'Summer','winter':'Winter'}[s]||s;
  const span=document.createElement('span');
  span.className=`badge ${cls}`;
  span.textContent=label;
  return span;
}
function chipsSkill(arr){
  const mapCls={B:['Beginner','b-lvle'],I:['Intermediate','b-lvlm'],A:['Advanced','b-lvlh']};
  const wrap=document.createElement('span');
  wrap.className='lvl';
  arr.forEach(k=>{
    const m=mapCls[k];
    if(m){
      const b=document.createElement('span');
      b.className=`badge ${m[1]}`;
      b.textContent=m[0];
      wrap.appendChild(b);
    }
  });
  return wrap;
}

function detail(label, value, spanClass = '', wrapClass = '', icon = '', tooltip = '') {
  if (value == null || (typeof value === 'string' && String(value).trim() === '')) return '';
  const wrap = document.createElement('div');
  wrap.className = `detail-item ${wrapClass}`.trim();
  const labelDiv = document.createElement('div');
  labelDiv.className = 'detail-label';
  if (icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = icon;
    labelDiv.appendChild(iconSpan);
  }
  labelDiv.appendChild(document.createTextNode(label));
  if (tooltip) {
    const infoWrap = document.createElement('span');
    infoWrap.className = 'tip-wrap';
    const infoBtn = document.createElement('button');
    infoBtn.className = 'info-btn';
    infoBtn.setAttribute('type', 'button');
    infoBtn.setAttribute('aria-label', 'Info');
    infoBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    const tipBox = document.createElement('span');
    tipBox.className = 'tooltip-text hidden';
    tipBox.textContent = tooltip;
    infoWrap.appendChild(infoBtn);
    infoWrap.appendChild(tipBox);
    labelDiv.appendChild(infoWrap);
  }
  const valueDiv = document.createElement('div');
  valueDiv.className = 'detail-value';
  const target = spanClass ? document.createElement('span') : valueDiv;
  if (spanClass) target.className = spanClass;
  if (typeof window !== 'undefined' && value instanceof window.Node) {
    target.appendChild(value);
  } else {
    target.innerHTML = parseCitations(String(value));
  }
  if (target !== valueDiv) valueDiv.appendChild(target);
  wrap.appendChild(labelDiv);
  wrap.appendChild(valueDiv);
  return wrap.outerHTML;
}

function detailSection(title, items, icon = '') {
  const content = items.filter(Boolean).join('');
  if (!content) return '';
  const wrap = document.createElement('div');
  wrap.className = 'detail-section';
  const h4 = document.createElement('h4');
  if (icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = icon;
    h4.appendChild(iconSpan);
  }
  h4.appendChild(document.createTextNode(title));
  const grid = document.createElement('div');
  grid.className = 'detail-section-grid';
  grid.innerHTML = content;
  wrap.appendChild(h4);
  wrap.appendChild(grid);
  return wrap.outerHTML;
}

function rowHTML(s){
  const distMi = ORIGIN ? haversine(ORIGIN,[s.lat,s.lng]) : null;
  const eta = distMi!=null ? etaMinutes(distMi) : null;
  const distTxt = distMi!=null ? `${Math.round(distMi)} mi / ~${eta} min` : '—';
  const infoDetails = [
    detail('Distance / Time', distTxt, '', '', '📏', ETA_TOOLTIP),
    detail('Water', badgeWater(s.water), '', '', '💧'),
    detail('Season', badgeSeason(s.season), '', '', '📅'),
    detail('Skill', chipsSkill(s.skill), '', '', '🎯')
  ];
  const cityLink=document.createElement('a');
  cityLink.href=`https://maps.google.com/?q=${encodeURIComponent(s.city)}`;
  cityLink.target='_blank';
  cityLink.textContent=s.city;
  const addrLink=document.createElement('a');
  addrLink.href=`https://maps.google.com/?q=${encodeURIComponent(s.addr)}`;
  addrLink.target='_blank';
  addrLink.textContent=s.addr;
  const coordLink=document.createElement('a');
  coordLink.href=`https://www.google.com/maps?q=${s.lat},${s.lng}`;
  coordLink.target='_blank';
  coordLink.className='mono';
  coordLink.textContent=`${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`;
  const locationDetails = [
    detail('City', cityLink, '', '', '🏙️'),
    detail('Address', addrLink, '', '', '📍'),
    detail('Coordinates', coordLink, '', '', '🧭')
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

  const temp=document.createElement('tbody');
  const parent=document.createElement('tr');
  parent.className='parent';
  parent.dataset.id=s.id;
  parent.dataset.mi=distMi||9999;
  parent.dataset.eta=eta||9999;

  const spotTd=document.createElement('td');
  spotTd.className='spot';
  spotTd.setAttribute('data-label','Spot');
  spotTd.textContent=s.name;
  parent.appendChild(spotTd);

  const distTd=document.createElement('td');
  distTd.setAttribute('data-label','Dist / Time');
  distTd.textContent=distTxt;
  parent.appendChild(distTd);

  const waterTd=document.createElement('td');
  waterTd.setAttribute('data-label','Water');
  waterTd.appendChild(badgeWater(s.water));
  parent.appendChild(waterTd);

  const seasonTd=document.createElement('td');
  seasonTd.setAttribute('data-label','Season');
  seasonTd.appendChild(badgeSeason(s.season));
  parent.appendChild(seasonTd);

  const skillTd=document.createElement('td');
  skillTd.setAttribute('data-label','Skill');
  skillTd.appendChild(chipsSkill(s.skill));
  parent.appendChild(skillTd);

  temp.appendChild(parent);

  const detailTr=document.createElement('tr');
  detailTr.className='child hidden';
  const detailTd=document.createElement('td');
  detailTd.colSpan=5;
  detailTd.innerHTML=sections;
  detailTr.appendChild(detailTd);
  temp.appendChild(detailTr);

  return temp.innerHTML;
}

module.exports = { detail, rowHTML };
