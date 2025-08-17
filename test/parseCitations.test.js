const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { parseCitations } = require('../js/parseCitations.js');

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  return dom;
}

test('parses citation into link groups', () => {
  const dom = setupDom();
  const html = parseCitations('Intro {{Citation: "text" SourceName: "One", "Two" SourceURL: "u1", "u2"}} end');
  dom.window.document.body.innerHTML = html;
  const groups = dom.window.document.querySelectorAll('.cite-group');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].querySelector('a').textContent, 'One');
  assert.equal(groups[0].querySelector('a').getAttribute('href'), 'u1');
});

test('malformed citation remains unchanged', () => {
  const dom = setupDom();
  const input = 'Bad {{Citation: "oops" SourceName: "Only"}} end';
  const html = parseCitations(input);
  dom.window.document.body.innerHTML = html;
  assert.equal(dom.window.document.body.textContent, input);
});

test('nested citation treated as text', () => {
  const dom = setupDom();
  const input = 'Nested {{Citation: "text {{Citation: \"inner\" SourceName: \"N\" SourceURL: \"U\" }} more" SourceName: "Outer" SourceURL: "Out"}} tail';
  const html = parseCitations(input);
  dom.window.document.body.innerHTML = html;
  const groups = dom.window.document.querySelectorAll('.cite-group');
  assert.equal(groups.length, 1);
  assert.ok(dom.window.document.body.textContent.includes('{{Citation: "inner" SourceName: "N" SourceURL: "U" }}'));
});

test('script tags are removed', () => {
  const dom = setupDom();
  const input = 'Bad <script>alert(1)</script> end';
  const html = parseCitations(input);
  dom.window.document.body.innerHTML = html;
  assert.equal(dom.window.document.querySelector('script'), null);
  assert.ok(!dom.window.document.body.textContent.includes('alert(1)'));
});
