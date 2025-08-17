const assert = require('node:assert/strict');
const test = require('node:test');
const {JSDOM} = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadDOM(){
  const dom = new JSDOM('<!DOCTYPE html><input id="q"><ul id="qs"></ul>', {runScripts: "outside-only"});
  const origAdd = dom.window.document.addEventListener.bind(dom.window.document);
  dom.window.document.addEventListener = (type, listener, opts) => {
    if(type === 'DOMContentLoaded') return; // prevent init
    return origAdd(type, listener, opts);
  };
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.1.0.0.js'), 'utf8');
  const script = new vm.Script(code);
  script.runInContext(dom.getInternalVMContext());
  return dom;
}

test('detail sanitizes script tags', () => {
  const dom = loadDOM();
  const html = dom.window.detail('Launch', '<img src=x onerror=alert(1)><script>alert(1)</script>');
  const parsed = new JSDOM(html).window.document;
  assert.strictEqual(parsed.querySelector('script'), null);
  assert.strictEqual(parsed.querySelector('[onerror]'), null);
});

test('rowHTML neutralizes scripts in spot fields', () => {
  const dom = loadDOM();
  const s = {
    id: '1',
    lat: 0,
    lng: 0,
    name: '<img src=x onerror=alert(1)>',
    water: 'salt',
    season: 'year',
    skill: ['B'],
    city: '<img onerror=1>',
    addr: '<script>',
    launch: '<script>alert(1)</script>',
    parking: '<img src=x onload=alert(1)>',
    amenities: '',
    pros: '',
    cons: '',
    pop: '',
    best: '',
    tips: '',
    avoid: '',
    best_conditions: '',
    law: '',
    routes_beginner: '',
    routes_pro: '',
    gear: '',
    setup_fit: '',
    parking_cost: '',
    parking_distance_m: '',
    bathrooms: '',
    showers: '',
    rinse: '',
    fees: '',
    popularity: ''
  };
  const html = dom.window.rowHTML(s);
  const parsed = new JSDOM(html).window.document;
  assert.strictEqual(parsed.querySelector('script'), null);
  assert.strictEqual(parsed.querySelector('[onerror]'), null);
  assert.strictEqual(parsed.querySelector('[onload]'), null);
});

test('updateSuggestions escapes spot names', () => {
  const dom = loadDOM();
  dom.window.q = dom.window.document.getElementById('q');
  dom.window.qSuggest = dom.window.document.getElementById('qs');
  dom.window.SPOTS = [{id: '1', name: '<img src=x onerror=alert(1)>'}];
  dom.window.q.value = '<img';
  dom.window.updateSuggestions();
  const inner = dom.window.qSuggest.innerHTML;
  assert(!/onerror/i.test(inner));
  assert(!/<img/.test(inner));
});
