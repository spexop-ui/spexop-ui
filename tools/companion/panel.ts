import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { restore, statusView } from './core.js';
/** Loopback, read-only status surface. No task launch endpoint and no source/credential exposure. */
export function panel(stateFile: string, port = 0) {
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Spexop local status</title><style>:root{color-scheme:light dark;font:16px system-ui;--space:1rem}body{margin:var(--space);max-width:52rem}article{padding:var(--space);border:1px solid GrayText;border-radius:.5rem}pre{white-space:pre-wrap}h1{font-size:1.5rem}</style><h1>Spexop · Local task status</h1><p>Read-only desktop status prototype. Refreshes once per second.</p><article aria-live="polite"><h2 id="phase">Loading</h2><p id="message"></p><p id="action"></p><p id="summary"></p><details><summary>Evidence and recent history</summary><pre id="details"></pre></details></article><script src="/status.js"></script></html>`;
    const script = `async function refresh(){try{const r=await fetch('/state');if(!r.ok)throw Error();const s=await r.json();document.getElementById('phase').textContent=s.phase;document.getElementById('message').textContent=s.message;document.getElementById('action').textContent=s.needsUserAction?'Needs user action':'No user action requested';document.getElementById('summary').textContent=s.task+' · '+s.executionKind+' · attempts '+s.attemptCount+'/'+s.attemptLimit+' · '+Object.entries(s.taskExit.criteria).map(([k,v])=>k+': '+v).join(', ');document.getElementById('details').textContent=JSON.stringify(s,null,2)}catch{document.getElementById('phase').textContent='UNKNOWN';document.getElementById('message').textContent='State unavailable; no acceptance inferred';document.getElementById('action').textContent='Needs user action';document.getElementById('details').textContent='';document.getElementById('summary').textContent=''  }}refresh();setInterval(refresh,1000);`;
    const server = http.createServer((req, res) => {
        const expected = server.address();
        if (!expected || typeof expected === 'string' || req.headers.host !== `127.0.0.1:${expected.port}`) {
            res.writeHead(403).end();
            return;
        }
        const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'" };
        if (req.method !== 'GET') {
            res.writeHead(405, headers).end();
            return;
        }
        if (req.url === '/') {
            res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' }).end(html);
            return;
        }
        if (req.url === '/status.js') {
            res.writeHead(200, { ...headers, 'Content-Type': 'application/javascript' }).end(script);
            return;
        }
        if (req.url === '/state') {
            try {
                const json = JSON.stringify(statusView(restore(stateFile)));
                res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }).end(json);
            }
            catch {
                res.writeHead(503, headers).end('{"phase":"UNKNOWN"}');
            }
            return;
        }
        res.writeHead(404, headers).end();
    });
    server.listen(port, '127.0.0.1');
    return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const file = process.argv[2];
    if (!file || !fs.existsSync(file))
        throw new Error('Usage: companion:status <state.json>');
    const s = panel(path.resolve(file));
    s.on('listening', () => console.log(s.address()));
}
