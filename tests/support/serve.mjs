// Minimal static server for the built page: `node serve.mjs <dir> <port>`. Localhost only, no caching. It also stands in
// for a trip's Firebase database under /__rtdb (tests/support/fake-rtdb.mjs), for the group-sync tests.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fakeRtdb } from './fake-rtdb.mjs';

const root = path.resolve(process.argv[2] || '.cache/pages');
const port = Number(process.argv[3] || 8124);
const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.webp': 'image/webp',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
};

http
	.createServer((req, res) => {
		const url = new URL(req.url, 'http://localhost');
		if (url.pathname === '/__health') return void res.end('ok');
		if (fakeRtdb(req, res, url)) return;
		const file = path.join(root, path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''));
		if (!file.startsWith(root + path.sep)) return void res.writeHead(403).end();
		fs.readFile(file, (err, body) => {
			if (err) return void res.writeHead(404).end();
			res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
			res.end(body);
		});
	})
	.listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
