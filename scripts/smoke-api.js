#!/usr/bin/env node
/*
 Simple API smoke test for the gateway.
 Usage: node scripts/smoke-api.js [--base http://localhost:4000]
*/
const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

const args = process.argv.slice(2);
let base = 'http://localhost:4000';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base' && args[i+1]) base = args[++i];
}

function reqJSON(u, method = 'GET') {
  const url = new URL(u);
  const lib = url.protocol === 'https:' ? https : http;
  const opts = { method, headers: { 'Accept': 'application/json' } };
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const req = lib.request(url, opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        const ms = Date.now() - started;
        const ct = (res.headers['content-type'] || '').toLowerCase();
        let parsed = null;
        try { if (ct.includes('application/json')) parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json: parsed, ms });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const endpoints = [
    '/healthz',
    '/api/restaurants',
    '/api/offers',
  ];

  console.log(`Smoke testing base: ${base}`);
  for (const p of endpoints) {
    const url = base.replace(/\/$/, '') + p;
    try {
      const res = await reqJSON(url);
      const svc = res.headers['x-service'] || 'n/a';
      const inst = res.headers['x-instance'] || 'n/a';
      const extra = res.json ? `, json: ${Array.isArray(res.json) ? res.json.length + ' items' : 'ok'}` : '';
      console.log(`- ${p} -> ${res.status} (${res.ms}ms), svc=${svc}, inst=${inst}${extra}`);
    } catch (e) {
      console.log(`- ${p} -> ERROR: ${e.message}`);
    }
  }

  // Try a sample offer detail if available
  try {
    const list = await reqJSON(base.replace(/\/$/, '') + '/api/offers');
    const first = Array.isArray(list.json) && list.json[0];
    if (first && first.id) {
      const res = await reqJSON(base.replace(/\/$/, '') + '/api/offers/' + first.id);
      const svc = res.headers['x-service'] || 'n/a';
      const inst = res.headers['x-instance'] || 'n/a';
      console.log(`- /api/offers/${first.id} -> ${res.status} (${res.ms}ms), svc=${svc}, inst=${inst}`);
    }
  } catch {}
}

main().catch((e) => { console.error(e); process.exit(1); });

