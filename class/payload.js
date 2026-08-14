/**
 * payload.js — 강의방을 URL 안에 통째로 담기 위한 압축/복원기
 *
 * 서버가 없어도 QR 하나로 강의 요약과 퀴즈를 학생 폰에 전달할 수 있도록,
 * 방 데이터를 짧은 키로 압축(deflate-raw)한 뒤 base64url 로 인코딩한다.
 * 결과 코드(학생 점수 카드)도 같은 방식으로 주고받는다.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------- base64url
  function bytesToBase64url(bytes) {
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64urlToBytes(str) {
    var normalized = str.replace(/-/g, '+').replace(/_/g, '/');
    while (normalized.length % 4) normalized += '=';
    var binary = atob(normalized);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // ---------------------------------------------------------------- 압축
  function deflate(bytes) {
    if (!global.CompressionStream) return Promise.resolve(null);
    try {
      var stream = new Response(bytes).body.pipeThrough(new global.CompressionStream('deflate-raw'));
      return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
    } catch (err) {
      return Promise.resolve(null);
    }
  }

  function inflate(bytes) {
    if (!global.DecompressionStream) return Promise.reject(new Error('압축 해제를 지원하지 않는 브라우저입니다.'));
    var stream = new Response(bytes).body.pipeThrough(new global.DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  }

  var encoder = new TextEncoder();
  var decoder = new TextDecoder();

  // ---------------------------------------------------------------- 키 축약
  // 긴 키 이름이 QR 용량을 잡아먹으므로 배열 형태로 눕혀서 담는다.
  function pack(room) {
    return {
      c: room.code,
      t: room.title || '',
      w: room.teacher || '',
      s: (room.summary || []).map(function (s) {
        return [s.heading || '', s.body || '', s.points || []];
      }),
      q: (room.quiz || []).map(function (q) {
        return [q.question || '', q.choices || [], q.answer | 0, q.points | 0, q.why || ''];
      }),
      o: [room.timeLimit | 0, room.shuffle ? 1 : 0]
    };
  }

  function unpack(packed) {
    return {
      code: packed.c,
      title: packed.t,
      teacher: packed.w,
      summary: (packed.s || []).map(function (s) {
        return { heading: s[0], body: s[1], points: s[2] || [] };
      }),
      quiz: (packed.q || []).map(function (q) {
        return { question: q[0], choices: q[1] || [], answer: q[2] | 0, points: q[3] || 100, why: q[4] || '' };
      }),
      timeLimit: (packed.o && packed.o[0]) || 0,
      shuffle: !!(packed.o && packed.o[1]),
      fromPayload: true
    };
  }

  /**
   * 방 데이터를 URL 조각으로 만든다. 'z' = 압축본, 'p' = 원본.
   */
  function encodeRoom(room) {
    var json = JSON.stringify(pack(room));
    var raw = encoder.encode(json);
    return deflate(raw).then(function (compressed) {
      if (compressed && compressed.length < raw.length) return 'z' + bytesToBase64url(compressed);
      return 'p' + bytesToBase64url(raw);
    });
  }

  function decodeRoom(fragment) {
    var kind = fragment.charAt(0);
    var bytes = base64urlToBytes(fragment.slice(1));
    var jsonPromise = kind === 'z'
      ? inflate(bytes).then(function (out) { return decoder.decode(out); })
      : Promise.resolve(decoder.decode(bytes));
    return jsonPromise.then(function (json) { return unpack(JSON.parse(json)); });
  }

  // ---------------------------------------------------------------- 결과 코드
  // 로컬 모드에서 학생이 강사에게 점수를 전달할 때 쓰는 짧은 문자열.
  function checksum(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) hash = ((hash * 33) ^ str.charCodeAt(i)) >>> 0;
    return hash.toString(36).slice(-4).toUpperCase();
  }

  function encodeResult(entry) {
    var body = [entry.name, entry.score, entry.correct, entry.total, Math.round((entry.ms || 0) / 100), entry.room || ''].join('|');
    var packed = bytesToBase64url(encoder.encode(body));
    return checksum(body) + '.' + packed;
  }

  function decodeResult(code) {
    var trimmed = String(code).trim().replace(/\s+/g, '');
    var dot = trimmed.indexOf('.');
    if (dot < 1) throw new Error('결과 코드 형식이 올바르지 않습니다.');
    var sum = trimmed.slice(0, dot);
    var body = decoder.decode(base64urlToBytes(trimmed.slice(dot + 1)));
    if (checksum(body) !== sum.toUpperCase()) throw new Error('결과 코드가 손상되었습니다.');
    var parts = body.split('|');
    return {
      name: parts[0],
      score: parseInt(parts[1], 10) || 0,
      correct: parseInt(parts[2], 10) || 0,
      total: parseInt(parts[3], 10) || 0,
      ms: (parseInt(parts[4], 10) || 0) * 100,
      room: parts[5] || ''
    };
  }

  global.Payload = {
    encodeRoom: encodeRoom,
    decodeRoom: decodeRoom,
    encodeResult: encodeResult,
    decodeResult: decodeResult
  };
})(window);
