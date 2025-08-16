const CORE_CACHE = 'core-v1';
const TILE_CACHE = 'tiles-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './data/locations.csv',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

function tileXY(lat,lng,z){
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, z));
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1/Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z));
  return {x,y};
}

const PRECACHE_TILES = (()=>{
  const center = [37.7749,-122.4194];
  const urls = [];
  for(let z=9; z<=12; z++){
    const {x,y} = tileXY(center[0], center[1], z);
    for(let dx=-1; dx<=1; dx++){
      for(let dy=-1; dy<=1; dy++){
        ['a','b','c'].forEach(s=>{
          urls.push(`https://${s}.tile.openstreetmap.org/${z}/${x+dx}/${y+dy}.png`);
        });
      }
    }
  }
  return urls;
})();

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CORE_CACHE).then(cache => cache.addAll(CORE_ASSETS)),
      caches.open(TILE_CACHE).then(cache => cache.addAll(PRECACHE_TILES))
    ])
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (url.includes('tile.openstreetmap.org/')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(event.request).then(resp => {
          const fetchPromise = fetch(event.request).then(networkResp => {
            cache.put(event.request, networkResp.clone());
            return networkResp;
          });
          return resp || fetchPromise.catch(() => resp);
        })
      )
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
