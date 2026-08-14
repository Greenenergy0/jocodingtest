/*!
 * qr.js — 의존성 없는 QR 코드 생성기 (byte mode, version 1~40, EC L/M/Q/H)
 * ISO/IEC 18004 규격 기반. 외부 라이브러리 없이 동작한다.
 */
(function (global) {
  'use strict';

  // 버전별 전체 코드워드 수 (v1~v40)
  var TOTAL_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655,
    733, 815, 901, 991, 1085, 1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185, 2323,
    2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706];

  // 버전 x EC레벨(L,M,Q,H) 순서로 나열한 오류정정 코드워드 총수
  var EC_CODEWORDS = [7, 10, 13, 17, 10, 16, 22, 28, 15, 26, 36, 44, 20, 36, 52, 64, 26, 48, 72, 88,
    36, 64, 96, 112, 40, 72, 108, 130, 48, 88, 132, 156, 60, 110, 160, 192, 72, 130, 192, 224, 80,
    150, 224, 264, 96, 176, 260, 308, 104, 198, 288, 352, 120, 216, 320, 384, 132, 240, 360, 432,
    144, 280, 408, 480, 168, 308, 448, 532, 180, 338, 504, 588, 196, 364, 546, 650, 224, 416, 600,
    700, 224, 442, 644, 750, 252, 476, 690, 816, 270, 504, 750, 900, 300, 560, 810, 960, 312, 588,
    870, 1050, 336, 644, 952, 1110, 360, 700, 1020, 1200, 390, 728, 1050, 1260, 420, 784, 1140,
    1350, 450, 812, 1200, 1440, 480, 868, 1290, 1530, 510, 924, 1350, 1620, 540, 980, 1440, 1710,
    570, 1036, 1530, 1800, 570, 1064, 1590, 1890, 600, 1120, 1680, 1980, 630, 1204, 1770, 2100,
    660, 1260, 1860, 2220, 720, 1316, 1950, 2310, 750, 1372, 2040, 2430];

  // 버전 x EC레벨 순서로 나열한 블록 수
  var EC_BLOCKS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 2, 2, 4, 1, 2, 4, 4, 2, 4, 4, 4, 2, 4, 6,
    5, 2, 4, 6, 6, 2, 5, 8, 8, 4, 5, 8, 8, 4, 5, 8, 11, 4, 8, 10, 11, 4, 9, 12, 16, 4, 9, 16, 16, 6,
    10, 12, 18, 6, 10, 17, 16, 6, 11, 16, 19, 6, 13, 18, 21, 7, 14, 21, 25, 8, 16, 20, 25, 8, 17, 23,
    25, 9, 17, 23, 34, 9, 18, 25, 30, 10, 20, 27, 32, 12, 21, 29, 35, 12, 23, 34, 37, 12, 25, 34, 40,
    13, 26, 35, 42, 14, 28, 38, 45, 15, 29, 40, 48, 16, 31, 43, 51, 17, 33, 45, 54, 18, 35, 48, 57,
    19, 37, 51, 60, 19, 38, 53, 63, 20, 40, 56, 66, 21, 43, 59, 70, 22, 45, 62, 74, 24, 47, 65, 77,
    25, 49, 68, 81];

  var EC_LEVELS = { L: 0, M: 1, Q: 2, H: 3 };
  // 포맷 정보에 쓰이는 EC 레벨 비트값 (L=01, M=00, Q=11, H=10)
  var EC_FORMAT_BITS = [1, 0, 3, 2];

  // ---- 갈루아 필드 GF(256), 원시다항식 0x11D ----
  var GF_EXP = new Uint8Array(512);
  var GF_LOG = new Uint8Array(256);
  (function initGF() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) GF_EXP[j] = GF_EXP[j - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  // 차수 degree 의 생성 다항식
  function generatorPoly(degree) {
    var poly = [1];
    for (var d = 0; d < degree; d++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var i = 0; i < poly.length; i++) {
        next[i] ^= poly[i];
        next[i + 1] ^= gfMul(poly[i], GF_EXP[d]);
      }
      poly = next;
    }
    return poly;
  }

  // 데이터 코드워드에 대한 오류정정 코드워드 계산
  function encodeECC(data, ecCount) {
    var gen = generatorPoly(ecCount);
    var remainder = new Array(ecCount).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ remainder[0];
      remainder.shift();
      remainder.push(0);
      if (factor !== 0) {
        for (var j = 0; j < ecCount; j++) {
          remainder[j] ^= gfMul(gen[j + 1], factor);
        }
      }
    }
    return remainder;
  }

  // ---- 문자열 → UTF-8 바이트 ----
  function toUtf8Bytes(str) {
    if (global.TextEncoder) return Array.from(new global.TextEncoder().encode(str));
    var out = [];
    var encoded = unescape(encodeURIComponent(str));
    for (var i = 0; i < encoded.length; i++) out.push(encoded.charCodeAt(i));
    return out;
  }

  function symbolSize(version) {
    return version * 4 + 17;
  }

  function charCountBits(version) {
    return version < 10 ? 8 : 16;
  }

  // 버전별 남는 비트 수(remainder bits)
  function remainderBits(version) {
    if (version === 1 || version >= 35) return 0;
    if (version <= 6) return 7;
    if (version <= 13) return 0;
    if (version <= 20) return 3;
    if (version <= 27) return 4;
    return 3;
  }

  function dataCodewordCount(version, ecIndex) {
    var idx = (version - 1) * 4 + ecIndex;
    return TOTAL_CODEWORDS[version - 1] - EC_CODEWORDS[idx];
  }

  function alignmentCoords(version) {
    if (version === 1) return [];
    var posCount = Math.floor(version / 7) + 2;
    var size = symbolSize(version);
    var intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
    var positions = [size - 7];
    for (var i = 1; i < posCount - 1; i++) positions[i] = positions[i - 1] - intervals;
    positions.push(6);
    return positions.reverse();
  }

  // ---- 매트릭스 헬퍼 ----
  // value: 0/1 모듈값, reserved: 데이터 배치 금지 영역 표시
  function createMatrix(size) {
    var m = { size: size, data: new Uint8Array(size * size), reserved: new Uint8Array(size * size) };
    m.get = function (r, c) { return this.data[r * size + c]; };
    m.set = function (r, c, v, reserve) {
      this.data[r * size + c] = v ? 1 : 0;
      if (reserve) this.reserved[r * size + c] = 1;
    };
    m.isReserved = function (r, c) { return this.reserved[r * size + c] === 1; };
    return m;
  }

  function placeFinder(m, row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || cc < 0 || rr >= m.size || cc >= m.size) continue;
        var inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6));
        var inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        m.set(rr, cc, inRing || inCore ? 1 : 0, true);
      }
    }
  }

  function placeAlignment(m, version) {
    var coords = alignmentCoords(version);
    for (var i = 0; i < coords.length; i++) {
      for (var j = 0; j < coords.length; j++) {
        var row = coords[i], col = coords[j];
        // 파인더 패턴과 겹치는 세 모서리는 건너뛴다
        if (m.isReserved(row, col)) continue;
        for (var r = -2; r <= 2; r++) {
          for (var c = -2; c <= 2; c++) {
            var dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
            m.set(row + r, col + c, dark ? 1 : 0, true);
          }
        }
      }
    }
  }

  function placeTiming(m) {
    for (var i = 8; i < m.size - 8; i++) {
      var v = i % 2 === 0 ? 1 : 0;
      if (!m.isReserved(6, i)) m.set(6, i, v, true);
      if (!m.isReserved(i, 6)) m.set(i, 6, v, true);
    }
  }

  function reserveFormatAreas(m, version) {
    var size = m.size;
    for (var i = 0; i < 9; i++) {
      if (i !== 6) {
        m.set(8, i, 0, true);
        m.set(i, 8, 0, true);
      }
    }
    m.set(8, 8, 0, true);
    for (var j = 0; j < 8; j++) {
      m.set(8, size - 1 - j, 0, true);
      m.set(size - 1 - j, 8, 0, true);
    }
    // 항상 어두운 모듈
    m.set(size - 8, 8, 1, true);

    if (version >= 7) {
      for (var r = 0; r < 6; r++) {
        for (var c = 0; c < 3; c++) {
          m.set(r, size - 11 + c, 0, true);
          m.set(size - 11 + c, r, 0, true);
        }
      }
    }
  }

  function formatInfoBits(ecIndex, mask) {
    var data = (EC_FORMAT_BITS[ecIndex] << 3) | mask;
    var rem = data << 10;
    for (var i = 14; i >= 10; i--) {
      if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  function versionInfoBits(version) {
    var rem = version << 12;
    for (var i = 17; i >= 12; i--) {
      if ((rem >> i) & 1) rem ^= 0x1f25 << (i - 12);
    }
    return (version << 12) | rem;
  }

  function writeFormatInfo(m, ecIndex, mask) {
    var bits = formatInfoBits(ecIndex, mask);
    var size = m.size;
    for (var i = 0; i < 15; i++) {
      var bit = (bits >> i) & 1;
      // 왼쪽 위 세로/가로
      if (i < 6) m.set(i, 8, bit, true);
      else if (i < 8) m.set(i + 1, 8, bit, true);
      else if (i === 8) m.set(8, 7, bit, true);
      else m.set(8, 14 - i, bit, true);
      // 나머지 두 모서리
      if (i < 8) m.set(8, size - 1 - i, bit, true);
      else m.set(size - 15 + i, 8, bit, true);
    }
  }

  function writeVersionInfo(m, version) {
    if (version < 7) return;
    var bits = versionInfoBits(version);
    var size = m.size;
    for (var i = 0; i < 18; i++) {
      var bit = (bits >> i) & 1;
      var row = Math.floor(i / 3);
      var col = size - 11 + (i % 3);
      m.set(row, col, bit, true);
      m.set(col, row, bit, true);
    }
  }

  function maskFn(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return false;
    }
  }

  function placeData(m, codewords) {
    var size = m.size;
    var bitIndex = 0;
    var totalBits = codewords.length * 8;
    var upward = true;
    for (var right = size - 1; right > 0; right -= 2) {
      if (right === 6) right = 5; // 세로 타이밍 패턴 열은 건너뛴다
      for (var vert = 0; vert < size; vert++) {
        var row = upward ? size - 1 - vert : vert;
        for (var k = 0; k < 2; k++) {
          var col = right - k;
          if (m.isReserved(row, col)) continue;
          var bit = 0;
          if (bitIndex < totalBits) {
            bit = (codewords[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
          }
          bitIndex++;
          m.set(row, col, bit, false);
        }
      }
      upward = !upward;
    }
  }

  function applyMask(m, mask) {
    var out = createMatrix(m.size);
    out.data.set(m.data);
    out.reserved.set(m.reserved);
    for (var r = 0; r < m.size; r++) {
      for (var c = 0; c < m.size; c++) {
        if (m.isReserved(r, c)) continue;
        if (maskFn(mask, r, c)) out.data[r * m.size + c] ^= 1;
      }
    }
    return out;
  }

  function penalty(m) {
    var size = m.size, score = 0, r, c, run, prev, i;

    // 규칙 1: 같은 색 5개 이상 연속
    for (r = 0; r < size; r++) {
      run = 1; prev = -1;
      for (c = 0; c < size; c++) {
        var v = m.get(r, c);
        if (v === prev) { run++; } else { if (run >= 5) score += run - 2; run = 1; prev = v; }
      }
      if (run >= 5) score += run - 2;
    }
    for (c = 0; c < size; c++) {
      run = 1; prev = -1;
      for (r = 0; r < size; r++) {
        var v2 = m.get(r, c);
        if (v2 === prev) { run++; } else { if (run >= 5) score += run - 2; run = 1; prev = v2; }
      }
      if (run >= 5) score += run - 2;
    }

    // 규칙 2: 2x2 동일 색 블록
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var a = m.get(r, c);
        if (a === m.get(r, c + 1) && a === m.get(r + 1, c) && a === m.get(r + 1, c + 1)) score += 3;
      }
    }

    // 규칙 3: 1:1:3:1:1 패턴 (파인더 유사 패턴)
    var pattern = [1, 0, 1, 1, 1, 0, 1];
    function matchesAt(getter, start, len) {
      var hits = 0;
      // 패턴 앞뒤로 밝은 모듈 4개가 붙는 경우를 각각 확인
      var before = true, after = true;
      for (var p = 0; p < 7; p++) {
        if (getter(start + p) !== pattern[p]) return 0;
      }
      for (var q = 1; q <= 4; q++) {
        if (start - q < 0 || getter(start - q) !== 0) { before = false; break; }
      }
      for (var s = 0; s < 4; s++) {
        if (start + 7 + s >= len || getter(start + 7 + s) !== 0) { after = false; break; }
      }
      if (before) hits += 40;
      if (after) hits += 40;
      return hits;
    }
    for (r = 0; r < size; r++) {
      for (c = 0; c + 7 <= size; c++) {
        score += matchesAt((function (row) { return function (x) { return m.get(row, x); }; })(r), c, size);
      }
    }
    for (c = 0; c < size; c++) {
      for (r = 0; r + 7 <= size; r++) {
        score += matchesAt((function (col) { return function (x) { return m.get(x, col); }; })(c), r, size);
      }
    }

    // 규칙 4: 어두운 모듈 비율 편차
    var dark = 0;
    for (i = 0; i < m.data.length; i++) dark += m.data[i];
    var ratio = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

    return score;
  }

  /**
   * 텍스트를 QR 매트릭스로 인코딩한다.
   * @param {string} text
   * @param {{ecl?: 'L'|'M'|'Q'|'H', minVersion?: number}} [options]
   * @returns {{size:number, version:number, get:(r:number,c:number)=>number}}
   */
  function encode(text, options) {
    options = options || {};
    var ecIndex = EC_LEVELS[options.ecl || 'M'];
    if (ecIndex === undefined) ecIndex = EC_LEVELS.M;
    var bytes = toUtf8Bytes(String(text));

    // 데이터가 들어가는 최소 버전 선택
    var version = -1;
    var minVersion = Math.max(1, options.minVersion || 1);
    for (var v = minVersion; v <= 40; v++) {
      var capacityBits = dataCodewordCount(v, ecIndex) * 8;
      var neededBits = 4 + charCountBits(v) + bytes.length * 8;
      if (neededBits <= capacityBits) { version = v; break; }
    }
    if (version === -1) {
      throw new Error('QR 용량 초과: ' + bytes.length + '바이트는 하나의 QR에 담을 수 없습니다.');
    }

    // ---- 비트 스트림 구성 ----
    var bits = [];
    function push(value, length) {
      for (var i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
    }
    push(4, 4); // byte mode
    push(bytes.length, charCountBits(version));
    for (var b = 0; b < bytes.length; b++) push(bytes[b], 8);

    var totalDataCodewords = dataCodewordCount(version, ecIndex);
    var capacity = totalDataCodewords * 8;
    var terminator = Math.min(4, capacity - bits.length);
    push(0, terminator);
    while (bits.length % 8 !== 0) bits.push(0);

    var dataCodewords = [];
    for (var i = 0; i < bits.length; i += 8) {
      var byteVal = 0;
      for (var k = 0; k < 8; k++) byteVal = (byteVal << 1) | bits[i + k];
      dataCodewords.push(byteVal);
    }
    var padBytes = [0xec, 0x11];
    var padIdx = 0;
    while (dataCodewords.length < totalDataCodewords) {
      dataCodewords.push(padBytes[padIdx++ % 2]);
    }

    // ---- 블록 분할 + 오류정정 ----
    var blockCount = EC_BLOCKS[(version - 1) * 4 + ecIndex];
    var ecPerBlock = EC_CODEWORDS[(version - 1) * 4 + ecIndex] / blockCount;
    var shortLength = Math.floor(totalDataCodewords / blockCount);
    var longBlocks = totalDataCodewords % blockCount;

    var dataBlocks = [], ecBlocks = [], offset = 0;
    for (var n = 0; n < blockCount; n++) {
      var len = shortLength + (n >= blockCount - longBlocks ? 1 : 0);
      var block = dataCodewords.slice(offset, offset + len);
      offset += len;
      dataBlocks.push(block);
      ecBlocks.push(encodeECC(block, ecPerBlock));
    }

    // ---- 인터리빙 ----
    var finalCodewords = [];
    var maxDataLen = shortLength + (longBlocks > 0 ? 1 : 0);
    for (var d = 0; d < maxDataLen; d++) {
      for (var bi = 0; bi < blockCount; bi++) {
        if (d < dataBlocks[bi].length) finalCodewords.push(dataBlocks[bi][d]);
      }
    }
    for (var e = 0; e < ecPerBlock; e++) {
      for (var bj = 0; bj < blockCount; bj++) finalCodewords.push(ecBlocks[bj][e]);
    }

    // ---- 매트릭스 구성 ----
    var size = symbolSize(version);
    var matrix = createMatrix(size);
    placeFinder(matrix, 0, 0);
    placeFinder(matrix, 0, size - 7);
    placeFinder(matrix, size - 7, 0);
    placeAlignment(matrix, version);
    placeTiming(matrix);
    reserveFormatAreas(matrix, version);
    placeData(matrix, finalCodewords);
    // 남는 비트(remainder bits)는 0으로 두므로 별도 처리 불필요
    void remainderBits(version);

    // ---- 마스크 선택 ----
    var best = null, bestScore = Infinity, bestMask = 0;
    for (var mask = 0; mask < 8; mask++) {
      var candidate = applyMask(matrix, mask);
      writeFormatInfo(candidate, ecIndex, mask);
      writeVersionInfo(candidate, version);
      var s = penalty(candidate);
      if (s < bestScore) { bestScore = s; best = candidate; bestMask = mask; }
    }
    void bestMask;

    return {
      size: size,
      version: version,
      get: function (r, c) { return best.data[r * size + c]; },
      modules: best.data
    };
  }

  /**
   * QR 매트릭스를 SVG 문자열로 변환한다.
   */
  function toSVG(text, options) {
    options = options || {};
    var qr = encode(text, options);
    var margin = options.margin === undefined ? 2 : options.margin;
    var dim = qr.size + margin * 2;
    var dark = options.dark || '#0b1020';
    var light = options.light || '#ffffff';
    var path = [];
    for (var r = 0; r < qr.size; r++) {
      for (var c = 0; c < qr.size; c++) {
        if (qr.get(r, c)) path.push('M' + (c + margin) + ' ' + (r + margin) + 'h1v1h-1z');
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim +
      '" shape-rendering="crispEdges" role="img" aria-label="QR 코드">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>' +
      '<path fill="' + dark + '" d="' + path.join('') + '"/></svg>';
  }

  var QR = { encode: encode, toSVG: toSVG };

  if (typeof module !== 'undefined' && module.exports) module.exports = QR;
  global.QR = QR;
})(typeof window !== 'undefined' ? window : globalThis);
