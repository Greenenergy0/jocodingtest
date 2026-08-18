/**
 * helpers.js — 검증 스크립트들이 함께 쓰는 도구
 *
 * 정적 서버와 브라우저 실행을 한군데로 모아, 각 스크립트가 포트나
 * 크로미움 경로를 알 필요 없게 한다.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

/** 리포지토리 루트를 임의의 빈 포트로 서빙한다. */
function startStaticServer(root) {
  const base = root || REPO_ROOT;
  const server = http.createServer((req, res) => {
    let filePath = path.join(base, decodeURIComponent(req.url.split('?')[0]));
    if (!filePath.startsWith(base)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: 'http://127.0.0.1:' + server.address().port,
        close: () => new Promise(done => server.close(done))
      });
    });
  });
}

/**
 * 크로미움을 띄운다.
 * CHROMIUM_PATH 가 있으면 그것을, 없으면 playwright 기본값을 쓰고,
 * 기본값이 없는 환경(브라우저가 미리 설치된 컨테이너 등)에서는
 * PLAYWRIGHT_BROWSERS_PATH 아래에서 찾아본다.
 */
async function launchBrowser() {
  const { chromium } = require('playwright');
  const explicit = process.env.CHROMIUM_PATH;
  if (explicit) return chromium.launch({ executablePath: explicit });

  try {
    return await chromium.launch();
  } catch (err) {
    const found = findPreinstalledChromium();
    if (!found) throw err;
    return chromium.launch({ executablePath: found });
  }
}

function findPreinstalledChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !fs.existsSync(root)) return null;
  for (const dir of fs.readdirSync(root)) {
    if (!dir.startsWith('chromium-')) continue;
    const candidate = path.join(root, dir, 'chrome-linux', 'chrome');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** 결과를 사람이 읽기 좋게 찍는다. */
function reporter(title) {
  const lines = [];
  console.log('\n' + title);
  return {
    ok: message => { lines.push(message); console.log('  ✓ ' + message); },
    done: () => console.log(`  ${lines.length}개 항목 통과\n`)
  };
}

module.exports = { REPO_ROOT, startStaticServer, launchBrowser, reporter };
