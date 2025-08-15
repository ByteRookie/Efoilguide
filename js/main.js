async function loadLocations() {
  const resp = await fetch('data/locations.csv');
  const text = await resp.text();
  const rows = text.trim().split('\n').slice(1);
  const container = document.getElementById('locations');

  rows.forEach(row => {
    const [id, name, detail, source, sourceUrl] = row.split(',');
    const section = document.createElement('section');
    section.className = 'location';
    section.id = id;
    section.innerHTML = `
      <h2>${name}</h2>
      <p>${detail}<span class="source"><a href="${sourceUrl}" target="_blank" rel="noopener">${source}</a></span></p>
    `;
    container.appendChild(section);
  });
}

loadLocations().catch(err => {
  document.getElementById('locations').textContent = 'Failed to load locations.';
  console.error(err);
});
