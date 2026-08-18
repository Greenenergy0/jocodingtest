/**
 * verify-qr.js — 직접 구현한 QR 생성기를 레퍼런스 구현과 대조한다.
 *
 * 무작위 입력을 byte 모드로 인코딩해 npm `qrcode` 패키지의 출력과 비트 단위로
 * 비교한다. 마스크 선택 규칙(페널티 4번)은 구현마다 조금씩 다르므로, 결과가
 * 다를 때는 "그 마스크를 강제한 레퍼런스 출력과 일치하는지"까지 확인한다.
 * 거기서도 어긋나면 인코딩 자체가 틀린 것이다.
 *
 *   node class/tools/verify-qr.js [반복횟수]
 */
const QR = require('../qr.js');
const ref = require('qrcode');
const { reporter } = require('./helpers');

const LEVELS = ['L', 'M', 'Q', 'H'];
const CHARS = 'abcXYZ019 -_/:?#가나다힣😀';
const rounds = parseInt(process.argv[2], 10) || 400;

function randomText(n) {
  let out = '';
  for (let i = 0; i < n; i++) out += CHARS[Math.floor(Math.random() * CHARS.length)];
  return out;
}

function refModules(text, ecl, maskPattern) {
  const options = { errorCorrectionLevel: ecl };
  if (maskPattern !== undefined) options.maskPattern = maskPattern;
  return ref.create([{ data: text, mode: 'byte' }], options);
}

function sameModules(mine, reference) {
  if (mine.size !== reference.modules.size) return false;
  for (let i = 0; i < reference.modules.data.length; i++) {
    if ((mine.modules[i] & 1) !== (reference.modules.data[i] & 1)) return false;
  }
  return true;
}

const log = reporter(`QR 생성기 검증 (무작위 ${rounds}건 + 경계값)`);

const cases = [];
for (let i = 0; i < rounds; i++) cases.push(randomText(1 + Math.floor(Math.random() * 900)));
for (const len of [1, 2, 3, 100, 1000, 2000, 2500]) cases.push('A'.repeat(len));
cases.push('https://greenenergy0.github.io/jocodingtest/class/#/join/AB12CD');

let checked = 0;
let exact = 0;
let maskVariant = 0;
const versions = new Set();
const failures = [];

for (const text of cases) {
  for (const ecl of LEVELS) {
    let reference;
    try { reference = refModules(text, ecl); } catch (err) { continue; } // 용량 초과는 건너뜀

    const mine = QR.encode(text, { ecl });
    checked++;
    versions.add(mine.version);

    if (mine.version !== reference.version) {
      failures.push(`버전 불일치 ${ecl}: ${mine.version} vs ${reference.version}`);
      continue;
    }
    if (sameModules(mine, reference)) { exact++; continue; }

    // 마스크만 다른 경우인지 확인
    let matched = false;
    for (let mask = 0; mask < 8 && !matched; mask++) {
      if (sameModules(mine, refModules(text, ecl, mask))) matched = true;
    }
    if (matched) maskVariant++;
    else failures.push(`구조 불일치 ${ecl} v${mine.version}: ${JSON.stringify(text.slice(0, 24))}`);
  }
}

log.ok(`검사 ${checked}건, 버전 ${Math.min(...versions)}~${Math.max(...versions)} 사용`);
log.ok(`레퍼런스와 완전 일치 ${exact}건`);
log.ok(`마스크만 다름 ${maskVariant}건 (해당 마스크의 레퍼런스와는 일치 — 둘 다 유효한 QR)`);

if (failures.length) {
  console.error('\n실패:\n  ' + failures.slice(0, 10).join('\n  '));
  process.exit(1);
}
log.done();
