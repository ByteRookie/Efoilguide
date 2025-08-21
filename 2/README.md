# Public Sessions Web — Unofficial Viewer

This site shows **public** Flite sessions only. Login is **optional** and used solely to improve access if the API requires it for your region. The UI never calls profile or my‑sessions endpoints.

## Run
Just open `index.html` in a browser. If the API blocks you due to CORS, run a local proxy and put its URL in the CORS Proxy box.

### Tiny CORS proxy (Node.js)
```js
const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use((req,res,next)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.all('*', async (req,res) => {
  const target = req.url.slice(1); // /https://app-api.fliteboard.com/...
  try {
    const r = await fetch(target, { method: req.method, headers: req.headers, body: req });
    res.status(r.status);
    r.headers.forEach((v,k)=>res.setHeader(k,v));
    const buf = await r.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch (e) { res.status(500).send(String(e)); }
});
app.listen(8787, ()=>console.log('Proxy on http://localhost:8787'));
```

## Endpoints used
- `/app/sessions/pinmap` (gzipped) — plots clustered pins
- `/app/sessions/public` — lists public sessions
- `/app/sessions/search` — search with optional bbox and date range
- `/app/sessions/coords` — fetches session track/telemetry
- Optional auth: `/auth/token`, `/auth/token/refresh`

**Note**: Respect privacy & terms. This viewer avoids any non-public endpoints.
