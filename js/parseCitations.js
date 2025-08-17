function parseCitations(str = '') {
  const tokens = [];
  let i = 0;

  function parseAt(start) {
    let idx = start + 2;

    function skip() { while (idx < str.length && /\s/.test(str[idx])) idx++; }
    function literal(text) {
      if (str.slice(idx, idx + text.length) !== text) return false;
      idx += text.length;
      return true;
    }
    function findEnd(from) {
      let inQuotes = false;
      for (let j = from; j < str.length - 1; j++) {
        const ch = str[j];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (!inQuotes && ch === '}' && str[j + 1] === '}') {
          return j + 2;
        }
      }
      return -1;
    }
    function quoted() {
      if (str[idx] !== '"') return null;
      idx++;
      const begin = idx;
      while (idx < str.length && str[idx] !== '"') idx++;
      if (str[idx] !== '"') return null;
      const out = str.slice(begin, idx);
      idx++;
      return out;
    }
    function list() {
      const arr = [];
      const first = quoted();
      if (first === null) return null;
      arr.push(first.trim());
      skip();
      while (str[idx] === ',') {
        idx++;
        skip();
        const next = quoted();
        if (next === null) return null;
        arr.push(next.trim());
        skip();
      }
      return arr;
    }

    skip();
    if (!literal('Citation:')) return null;
    skip();
    if (str[idx] !== '"') return null;
    idx++;
    const textStart = idx;
    let text;
    while (idx < str.length) {
      if (str.startsWith('{{Citation:', idx)) {
        const endNested = findEnd(idx + 2);
        if (endNested === -1) return null;
        idx = endNested;
        continue;
      }
      if (str[idx] === '"') {
        let look = idx + 1;
        while (look < str.length && /\s/.test(str[look])) look++;
        if (str.slice(look, look + 'SourceName:'.length) === 'SourceName:') {
          text = str.slice(textStart, idx);
          idx = look + 'SourceName:'.length;
          break;
        }
      }
      idx++;
    }
    if (text === undefined) return null;
    skip();
    const names = list();
    if (names === null) return null;
    skip();
    if (!literal('SourceURL:')) return null;
    skip();
    const urls = list();
    if (urls === null) return null;
    skip();
    if (str.slice(idx, idx + 2) !== '}}') return null;
    return { end: idx + 2, text, names, urls };
  }

  while (i < str.length) {
    const start = str.indexOf('{{Citation:', i);
    if (start === -1) {
      tokens.push({ type: 'text', value: str.slice(i) });
      break;
    }
    if (start > i) {
      tokens.push({ type: 'text', value: str.slice(i, start) });
    }
    const parsed = parseAt(start);
    if (parsed) {
      const sources = parsed.names.map((n, idx) => ({ name: n, url: parsed.urls[idx] || '#' }));
      tokens.push({ type: 'citation', text: parsed.text, sources });
      i = parsed.end;
    } else {
      tokens.push({ type: 'text', value: str.slice(start, start + 2) });
      i = start + 2;
    }
  }

  const container = document.createElement('span');
  tokens.forEach(tok => {
    if (tok.type === 'text') {
      container.appendChild(document.createTextNode(tok.value));
    } else {
      container.appendChild(document.createTextNode(tok.text));
      tok.sources.forEach(src => {
        const span = document.createElement('span');
        span.className = 'cite-group';
        const a = document.createElement('a');
        a.href = src.url;
        a.target = '_blank';
        a.textContent = src.name;
        span.appendChild(a);
        container.appendChild(span);
      });
    }
  });
  return container.innerHTML;
}

if (typeof window !== 'undefined') {
  window.parseCitations = parseCitations;
}

if (typeof module !== 'undefined') {
  module.exports = { parseCitations };
}

