function sourceSpan(key, data) {
  const src = data[`${key}_source`];
  const url = data[`${key}_url`];
  if (src && url) {
    return ` <span class="source"><a href="${url}" target="_blank" rel="noopener">${src}</a></span>`;
  }
  return '';
}

async function loadLocations() {
  const resp = await fetch('data/locations.csv');
  const text = await resp.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  const container = document.getElementById('locations');

  lines.slice(1).forEach(line => {
    const values = line.split(',');
    const data = {};
    headers.forEach((h, i) => { data[h] = values[i]; });

    const section = document.createElement('section');
    section.className = 'location';
    section.id = data.id;

    let html = `<h2>${data.name}</h2>`;
    if (data.image) {
      html += `<img src="${data.image}" alt="${data.name}">`;
    }

    const fields = [
      { key: 'location', label: 'Location' },
      { key: 'address', label: 'Address' },
      { key: 'pros', label: 'Pros', isList: true },
      { key: 'cons', label: 'Cons', isList: true },
      { key: 'rules', label: 'Rules' }
    ];

    fields.forEach(({ key, label, isList }) => {
      if (!data[key]) return;
      if (isList) {
        const items = data[key].split(';').map(v => v.trim()).filter(Boolean);
        const list = items.map(i => `<li>${i}</li>`).join('');
        html += `<div><strong>${label}:</strong><ul>${list}</ul>${sourceSpan(key, data)}</div>`;
      } else {
        html += `<p><strong>${label}:</strong> ${data[key]}${sourceSpan(key, data)}</p>`;
      }
    });

    section.innerHTML = html;
    container.appendChild(section);
  });
}

loadLocations().catch(err => {
  document.getElementById('locations').textContent = 'Failed to load locations.';
  console.error(err);
});
