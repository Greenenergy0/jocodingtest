/**
 * bundle.js — class/ 전체를 한 개의 HTML 파일로 묶는다.
 *
 * 강사가 USB에 담아 다니거나, 파일 하나만 올릴 수 있는 곳에 배포할 때 쓴다.
 * 어떤 charset 헤더로 서빙되어도 한글이 깨지지 않도록 순수 ASCII로 출력한다.
 * (비ASCII 문자를 JS는 \uXXXX, 마크업은 숫자 엔티티로 바꾼다.)
 *
 *   node class/tools/bundle.js [출력경로]
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(SRC, file), 'utf8');

const escapeJs = s => s.replace(/[^\x00-\x7F]/g, c =>
  '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

const escapeHtml = s => s.replace(/[^\x00-\x7F]/g, c =>
  '&#x' + c.codePointAt(0).toString(16).toUpperCase() + ';');

// CSS는 엔티티가 통하지 않으므로, 한글이 들어있는 주석만 걷어낸다
const css = read('style.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n').trim();
if (/[^\x00-\x7F]/.test(css)) {
  throw new Error('CSS에 주석 밖 비ASCII 문자가 있습니다. bundle.js를 손봐야 합니다.');
}

const SCRIPTS = ['config.js', 'sample.js', 'qr.js', 'payload.js', 'store.js', 'app.js'];

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0b1020">
<title>${escapeHtml('실시간 강의실')}</title>
<style>
${css}
</style>
</head>
<body>
<div id="app" class="app"></div>

${SCRIPTS.map(f => `<script>\n/* ===== ${f} ===== */\n${escapeJs(read(f))}\n</script>`).join('\n\n')}
</body>
</html>
`;

if (/[^\x00-\x7F]/.test(html)) throw new Error('출력에 비ASCII 문자가 남았습니다.');

const dest = process.argv[2] || path.join(SRC, 'lecture-room.single.html');
fs.writeFileSync(dest, html, 'ascii');
console.log(`${dest} (${(html.length / 1024).toFixed(1)}KB, 순수 ASCII)`);
