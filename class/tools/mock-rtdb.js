/**
 * mock-rtdb.js — Firebase Realtime Database REST API 의 최소 흉내 (테스트 전용)
 *
 * 공유 모드를 실제 Firebase 프로젝트 없이 검증하기 위한 것으로, 앱이 쓰는
 * 만큼만 구현했다: 경로별 GET/PUT/DELETE 와 SSE 스트리밍, 그리고 CORS.
 *
 *   node class/tools/mock-rtdb.js [포트]     단독 실행
 *   require('./mock-rtdb').start()           테스트에서 사용
 */
const http = require('http');

function start(port) {
  let db = {};
  const streams = new Set();

  const readPath = p => p.split('/').filter(Boolean)
    .reduce((node, key) => (node == null ? null : node[key]), db);

  function writePath(p, value) {
    const parts = p.split('/').filter(Boolean);
    let node = db;
    for (let i = 0; i < parts.length - 1; i++) node = (node[parts[i]] = node[parts[i]] || {});
    const last = parts[parts.length - 1];
    if (value === null) delete node[last]; else node[last] = value;

    // 영향 받는 구독자에게 알린다
    for (const stream of streams) {
      if (p.startsWith(stream.path) || stream.path.startsWith(p)) {
        stream.res.write('event: put\ndata: ' +
          JSON.stringify({ path: '/', data: readPath(stream.path) }) + '\n\n');
      }
    }
  }

  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  const server = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname.replace(/\.json$/, '');

    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

    if (req.method === 'GET' && (req.headers.accept || '').includes('text/event-stream')) {
      res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const stream = { path, res };
      streams.add(stream);
      res.write('event: put\ndata: ' + JSON.stringify({ path: '/', data: readPath(path) }) + '\n\n');
      req.on('close', () => streams.delete(stream));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const headers = { ...CORS, 'Content-Type': 'application/json' };
      if (req.method === 'GET') {
        res.writeHead(200, headers);
        return res.end(JSON.stringify(readPath(path) ?? null));
      }
      if (req.method === 'PUT') {
        const value = JSON.parse(body);
        writePath(path, value);
        res.writeHead(200, headers);
        return res.end(JSON.stringify(value));
      }
      if (req.method === 'DELETE') {
        writePath(path, null);
        res.writeHead(200, headers);
        return res.end('null');
      }
      res.writeHead(405, headers);
      res.end('null');
    });
  });

  return new Promise(resolve => {
    server.listen(port || 0, '127.0.0.1', () => {
      resolve({
        url: 'http://127.0.0.1:' + server.address().port,
        read: readPath,
        reset: () => { db = {}; },
        close: () => new Promise(done => {
          for (const stream of streams) stream.res.end();
          server.close(done);
        })
      });
    });
  });
}

module.exports = { start };

if (require.main === module) {
  start(parseInt(process.argv[2], 10) || 8124).then(db => {
    console.log('mock Realtime Database: ' + db.url);
  });
}
