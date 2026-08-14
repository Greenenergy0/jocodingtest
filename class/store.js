/**
 * store.js — 강의방/점수 저장소
 *
 * 두 가지 어댑터를 같은 인터페이스로 감싼다.
 *  - CloudStore : Firebase Realtime Database (REST + SSE, SDK 불필요)
 *  - LocalStore : localStorage (+ BroadcastChannel 로 같은 기기 탭 간 동기화)
 *
 * 공개 API (모두 Promise)
 *   Store.mode                      'cloud' | 'local'
 *   Store.saveRoom(room)
 *   Store.loadRoom(code)            -> room | null
 *   Store.submitScore(code, entry)  -> entry
 *   Store.listScores(code)          -> entry[]
 *   Store.watchScores(code, cb)     -> unsubscribe()
 */
(function (global) {
  'use strict';

  var CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O/1/I 제외
  var LS_ROOMS = 'qrclass.rooms';
  var LS_SCORES = 'qrclass.scores.';
  var LS_ME = 'qrclass.me';

  function randomCode(length) {
    var out = '';
    var buf = new Uint32Array(length || 6);
    (global.crypto || global.msCrypto).getRandomValues(buf);
    for (var i = 0; i < buf.length; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    return out;
  }

  function randomId() {
    return randomCode(4).toLowerCase() + Date.now().toString(36);
  }

  function readJSON(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  // 점수 → 순위 정렬. 동점이면 소요 시간이 짧은 쪽이 앞선다.
  function rankSort(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if ((a.ms || 0) !== (b.ms || 0)) return (a.ms || 0) - (b.ms || 0);
    return (a.at || 0) - (b.at || 0);
  }

  function toList(obj) {
    if (!obj) return [];
    var list = Array.isArray(obj) ? obj.slice() : Object.keys(obj).map(function (k) {
      var v = obj[k];
      return Object.assign({ id: k }, v);
    });
    return list.filter(Boolean).sort(rankSort);
  }

  // ---------------------------------------------------------------- LocalStore
  var LocalStore = {
    mode: 'local',

    saveRoom: function (room) {
      var rooms = readJSON(LS_ROOMS, {});
      rooms[room.code] = room;
      writeJSON(LS_ROOMS, rooms);
      return Promise.resolve(room);
    },

    loadRoom: function (code) {
      var rooms = readJSON(LS_ROOMS, {});
      return Promise.resolve(rooms[code] || null);
    },

    submitScore: function (code, entry) {
      var key = LS_SCORES + code;
      var scores = readJSON(key, {});
      scores[entry.id] = entry;
      writeJSON(key, scores);
      broadcast(code);
      return Promise.resolve(entry);
    },

    listScores: function (code) {
      return Promise.resolve(toList(readJSON(LS_SCORES + code, {})));
    },

    watchScores: function (code, cb) {
      var self = this;
      function refresh() { self.listScores(code).then(cb); }
      refresh();
      var onStorage = function (e) { if (e.key === LS_SCORES + code) refresh(); };
      global.addEventListener('storage', onStorage);
      var channel = subscribe(code, refresh);
      return function () {
        global.removeEventListener('storage', onStorage);
        channel();
      };
    }
  };

  // 같은 기기의 다른 탭(강사 발표 화면 ↔ 학생 화면)끼리 즉시 동기화
  var bc = null;
  var listeners = {};
  if (global.BroadcastChannel) {
    bc = new global.BroadcastChannel('qrclass');
    bc.onmessage = function (e) {
      var code = e.data && e.data.code;
      (listeners[code] || []).forEach(function (fn) { fn(); });
    };
  }
  // BroadcastChannel 과 storage 이벤트는 모두 "쓴 쪽"에는 오지 않으므로
  // 같은 문서의 구독자에게는 직접 알려준다.
  function broadcast(code) {
    if (bc) bc.postMessage({ code: code });
    (listeners[code] || []).forEach(function (fn) { fn(); });
  }
  function subscribe(code, fn) {
    listeners[code] = listeners[code] || [];
    listeners[code].push(fn);
    return function () {
      listeners[code] = (listeners[code] || []).filter(function (f) { return f !== fn; });
    };
  }

  // ---------------------------------------------------------------- CloudStore
  function CloudStore(baseUrl) {
    this.mode = 'cloud';
    this.base = String(baseUrl).replace(/\/+$/, '');
  }

  CloudStore.prototype._url = function (path) {
    return this.base + '/rooms/' + path + '.json';
  };

  CloudStore.prototype._request = function (path, options) {
    return fetch(this._url(path), options).then(function (res) {
      if (!res.ok) throw new Error('데이터베이스 요청 실패 (' + res.status + ')');
      return res.json();
    });
  };

  CloudStore.prototype.saveRoom = function (room) {
    return this._request(room.code + '/room', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room)
    }).then(function () { return room; });
  };

  CloudStore.prototype.loadRoom = function (code) {
    return this._request(code + '/room', { method: 'GET' });
  };

  CloudStore.prototype.submitScore = function (code, entry) {
    // id 를 클라이언트가 만들어 PUT 하므로 재제출 시 덮어쓰기가 된다
    return this._request(code + '/scores/' + entry.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    }).then(function () { return entry; });
  };

  CloudStore.prototype.listScores = function (code) {
    return this._request(code + '/scores', { method: 'GET' }).then(toList);
  };

  CloudStore.prototype.watchScores = function (code, cb) {
    var self = this;
    var stopped = false;
    var source = null;
    var timer = null;

    function refresh() {
      if (stopped) return;
      self.listScores(code).then(function (list) { if (!stopped) cb(list); }).catch(function () { });
    }

    function startPolling() {
      if (timer || stopped) return;
      timer = setInterval(refresh, 4000);
    }

    refresh();

    // EventSource 는 Accept: text/event-stream 을 보내므로 RTDB 스트리밍이 바로 붙는다.
    try {
      source = new global.EventSource(self._url(code + '/scores'));
      source.addEventListener('put', refresh);
      source.addEventListener('patch', refresh);
      source.onerror = function () {
        // 스트리밍이 막히면 폴링으로 조용히 내려간다
        if (source) { source.close(); source = null; }
        startPolling();
      };
    } catch (err) {
      startPolling();
    }

    return function () {
      stopped = true;
      if (source) source.close();
      if (timer) clearInterval(timer);
    };
  };

  // ---------------------------------------------------------------- 내 정보
  function getMe() {
    return readJSON(LS_ME, { name: '', entries: {} });
  }

  function setMe(me) {
    writeJSON(LS_ME, me);
    return me;
  }

  // 같은 방에서는 항상 같은 entryId 를 재사용해 중복 등록을 막는다
  function entryIdFor(code) {
    var me = getMe();
    me.entries = me.entries || {};
    if (!me.entries[code]) {
      me.entries[code] = randomId();
      setMe(me);
    }
    return me.entries[code];
  }

  // ---------------------------------------------------------------- 팩토리
  var config = global.CLASS_CONFIG || {};
  var active = config.databaseURL ? new CloudStore(config.databaseURL) : LocalStore;

  global.Store = {
    mode: active.mode,
    isCloud: active.mode === 'cloud',
    saveRoom: function (room) { return active.saveRoom(room); },
    loadRoom: function (code) { return active.loadRoom(code); },
    submitScore: function (code, entry) { return active.submitScore(code, entry); },
    listScores: function (code) { return active.listScores(code); },
    watchScores: function (code, cb) { return active.watchScores(code, cb); },

    // 로컬 모드에서도 강사가 만든 방 목록은 항상 이 기기에 남긴다
    saveLocalRoom: function (room) { return LocalStore.saveRoom(room); },
    loadLocalRoom: function (code) { return LocalStore.loadRoom(code); },
    listLocalRooms: function () {
      var rooms = readJSON(LS_ROOMS, {});
      return Object.keys(rooms).map(function (k) { return rooms[k]; })
        .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    },
    deleteLocalRoom: function (code) {
      var rooms = readJSON(LS_ROOMS, {});
      delete rooms[code];
      writeJSON(LS_ROOMS, rooms);
      global.localStorage.removeItem(LS_SCORES + code);
    },
    addLocalScore: function (code, entry) { return LocalStore.submitScore(code, entry); },

    getMe: getMe,
    setMe: setMe,
    entryIdFor: entryIdFor,
    randomCode: randomCode,
    randomId: randomId,
    rankSort: rankSort
  };
})(window);
