const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { parseCitations } = require('../js/parseCitations.js');

test('rowHTML neutralizes script tags and event handlers', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  const origAdd = dom.window.document.addEventListener;
  dom.window.document.addEventListener = function(ev, cb, opts){
    if(ev === 'DOMContentLoaded') return;
    return origAdd.call(this, ev, cb, opts);
  };
  global.parseCitations = parseCitations;
  const { rowHTML } = require('../js/main.1.0.0.js');
  const s = {
    id: '1',
    name: '<script>alert(1)</script>',
    water: 'salt',
    season: 'year',
    skill: ['B'],
    city: '<img src=x onerror=alert(1)>',
    addr: 'addr',
    lat: 0,
    lng: 0,
    launch: '<img src=x onerror=1>',
    parking: '',
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
  const tbody = dom.window.document.createElement('tbody');
  tbody.innerHTML = rowHTML(s);
  assert.equal(tbody.querySelector('script'), null);
  assert.equal(tbody.querySelector('[onerror]'), null);
  assert.ok(tbody.querySelector('.spot').textContent.includes('<script>alert(1)</script>'));
});
