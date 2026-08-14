/**
 * app.js — 실시간 강의실
 *
 * 학생: QR로 입장 → 강의 요약 / 퀴즈 / 명예의 전당
 * 강사: 강의 작성 → QR 발표 화면 → 실시간 순위
 */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var config = window.CLASS_CONFIG || {};
  var BRAND = config.brand || '실시간 강의실';
  var SESSION_KEY = 'qrclass.session';

  var state = {
    room: null,
    name: '',
    quiz: null,
    result: null,
    draft: null,
    cleanups: []
  };

  // ------------------------------------------------------------------ 유틸
  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function $(selector, root) { return (root || app).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || app).querySelectorAll(selector)); }

  function on(selector, event, handler, root) {
    $$(selector, root).forEach(function (node) { node.addEventListener(event, handler); });
  }

  function go(path) { location.hash = '#/' + path; }

  function cleanup(fn) { state.cleanups.push(fn); }

  function runCleanups() {
    state.cleanups.splice(0).forEach(function (fn) {
      try { fn(); } catch (err) { /* 정리 중 오류는 무시 */ }
    });
  }

  function formatDuration(ms) {
    var total = Math.round((ms || 0) / 1000);
    var min = Math.floor(total / 60);
    var sec = total % 60;
    return min ? min + '분 ' + sec + '초' : sec + '초';
  }

  function copyText(text, button) {
    var done = function () {
      if (!button) return;
      var original = button.textContent;
      button.textContent = '복사됨';
      setTimeout(function () { button.textContent = original; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { window.prompt('복사해서 사용하세요', text); });
    } else {
      window.prompt('복사해서 사용하세요', text);
    }
  }

  function saveSession() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ room: state.room, name: state.name }));
    } catch (err) { /* 저장 공간이 없어도 화면은 계속 동작한다 */ }
  }

  function restoreSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      state.room = data.room || null;
      state.name = data.name || '';
    } catch (err) { /* 손상된 세션은 무시 */ }
  }

  function baseUrl() {
    return location.origin + location.pathname;
  }

  // ------------------------------------------------------------------ 공통 뷰 조각
  function modeBadge() {
    return window.Store.isCloud
      ? '<span class="badge cloud">공유 모드</span>'
      : '<span class="badge local">로컬 모드</span>';
  }

  function topbar(title, backPath) {
    return '<div class="topbar">' +
      (backPath !== null ? '<button class="back" data-back="' + esc(backPath) + '" aria-label="뒤로">‹</button>' : '') +
      '<div class="title">' + esc(title) + '</div>' +
      '<div class="spacer"></div>' + modeBadge() +
      '</div>';
  }

  function render(html, wide) {
    app.className = 'app' + (wide ? ' wide' : '');
    app.innerHTML = '<div class="fade-in">' + html + '</div>';
    on('[data-back]', 'click', function (e) {
      var target = e.currentTarget.getAttribute('data-back');
      go(target);
    });
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ 홈 (학생 입장)
  function viewHome() {
    var me = window.Store.getMe();
    render(
      '<div class="topbar"><div class="title">' + esc(BRAND) + '</div><div class="spacer"></div>' + modeBadge() + '</div>' +
      '<div class="stack-lg">' +
        '<div class="hero">' +
          '<div class="eyebrow">QR로 입장</div>' +
          '<h1>강의 요약 보고<br>퀴즈로 겨루기</h1>' +
          '<p class="muted" style="margin-top:10px">강사가 띄운 QR을 찍거나, 참여 코드를 입력해 들어오세요.</p>' +
        '</div>' +

        '<div class="card stack">' +
          '<div class="field-row">' +
            '<div>' +
              '<label for="join-code">참여 코드</label>' +
              '<input id="join-code" class="code-input" maxlength="6" autocomplete="off" ' +
                'autocapitalize="characters" spellcheck="false" placeholder="ABC123">' +
            '</div>' +
            '<button class="icon-btn" id="scan-btn" title="QR 스캔" aria-label="QR 스캔">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
              '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>' +
              '<path d="M7 12h10"/></svg>' +
            '</button>' +
          '</div>' +
          '<div>' +
            '<label for="join-name">이름</label>' +
            '<input id="join-name" maxlength="16" autocomplete="name" placeholder="명예의 전당에 표시될 이름" value="' + esc(me.name) + '">' +
          '</div>' +
          '<button class="btn" id="join-btn">입장하기</button>' +
          '<div id="join-msg"></div>' +
        '</div>' +

        (window.Store.isCloud ? '' :
          '<div class="notice">로컬 모드입니다. 강사가 띄운 <b>QR을 찍으면</b> 강의 내용이 그대로 담겨 열립니다. ' +
          '코드 입력은 이 기기에서 만든 강의에만 쓸 수 있어요.</div>') +

        '<div class="center"><button class="btn ghost" data-back="host">강사용 화면 열기</button></div>' +
      '</div>'
    );

    var codeInput = $('#join-code');
    codeInput.addEventListener('input', function () {
      this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    $('#join-btn').addEventListener('click', function () {
      var code = codeInput.value.trim().toUpperCase();
      var name = $('#join-name').value.trim();
      var msg = $('#join-msg');
      if (code.length < 4) { msg.innerHTML = '<div class="notice err">참여 코드를 입력해 주세요.</div>'; return; }
      if (!name) { msg.innerHTML = '<div class="notice err">이름을 입력해 주세요.</div>'; return; }

      msg.innerHTML = '<div class="notice">강의를 불러오는 중…</div>';
      window.Store.loadRoom(code)
        .then(function (room) { return room || window.Store.loadLocalRoom(code); })
        .then(function (room) {
          if (!room) {
            msg.innerHTML = '<div class="notice err">그런 참여 코드를 찾지 못했습니다. QR로 다시 시도해 보세요.</div>';
            return;
          }
          enterRoom(room, name);
        })
        .catch(function (err) {
          msg.innerHTML = '<div class="notice err">' + esc(err.message) + '</div>';
        });
    });

    $('#scan-btn').addEventListener('click', openScanner);
  }

  function enterRoom(room, name) {
    state.room = room;
    state.name = name;
    state.quiz = null;
    state.result = null;
    var me = window.Store.getMe();
    me.name = name;
    window.Store.setMe(me);
    saveSession();
    go('menu');
  }

  // ------------------------------------------------------------------ QR 스캐너
  function openScanner() {
    if (!('BarcodeDetector' in window)) {
      alert('이 브라우저는 앱 안에서의 QR 스캔을 지원하지 않습니다.\n휴대폰 기본 카메라로 QR을 찍으면 바로 열립니다.');
      return;
    }
    render(
      topbar('QR 스캔', '') +
      '<div class="card stack">' +
        '<video id="scanner-video" playsinline muted></video>' +
        '<p class="muted center">강사 화면의 QR을 사각형 안에 맞춰 주세요.</p>' +
        '<div id="scan-msg"></div>' +
      '</div>'
    );

    var video = $('#scanner-video');
    var detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    var stream = null;
    var stopped = false;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(function (media) {
        if (stopped) { media.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = media;
        video.srcObject = media;
        return video.play();
      })
      .then(function () { tick(); })
      .catch(function () {
        $('#scan-msg').innerHTML = '<div class="notice err">카메라를 열 수 없습니다. 기본 카메라 앱으로 QR을 찍어 주세요.</div>';
      });

    function tick() {
      if (stopped) return;
      detector.detect(video).then(function (codes) {
        if (stopped) return;
        if (codes && codes.length) {
          var value = codes[0].rawValue || '';
          var hashAt = value.indexOf('#');
          stop();
          if (hashAt >= 0) location.hash = value.slice(hashAt);
          else { go(''); }
          return;
        }
        requestAnimationFrame(tick);
      }).catch(function () {
        if (!stopped) requestAnimationFrame(tick);
      });
    }

    function stop() {
      stopped = true;
      if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    }

    cleanup(stop);
  }

  // ------------------------------------------------------------------ 입장 확인 화면
  function viewJoin(room) {
    var me = window.Store.getMe();
    render(
      topbar(BRAND, '') +
      '<div class="stack-lg">' +
        '<div class="hero">' +
          '<div class="eyebrow">강의 참여</div>' +
          '<h1>' + esc(room.title || '제목 없는 강의') + '</h1>' +
          '<p class="muted" style="margin-top:8px">' +
            (room.teacher ? esc(room.teacher) + ' · ' : '') +
            '요약 ' + (room.summary || []).length + '개 · 퀴즈 ' + (room.quiz || []).length + '문제' +
          '</p>' +
        '</div>' +
        '<div class="card stack">' +
          '<div>' +
            '<label for="enter-name">이름</label>' +
            '<input id="enter-name" maxlength="16" autocomplete="name" placeholder="명예의 전당에 표시될 이름" value="' + esc(me.name) + '">' +
          '</div>' +
          '<button class="btn" id="enter-btn">입장하기</button>' +
          '<div id="enter-msg"></div>' +
        '</div>' +
      '</div>'
    );

    function submit() {
      var name = $('#enter-name').value.trim();
      if (!name) { $('#enter-msg').innerHTML = '<div class="notice err">이름을 입력해 주세요.</div>'; return; }
      enterRoom(room, name);
    }

    $('#enter-btn').addEventListener('click', submit);
    $('#enter-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  // ------------------------------------------------------------------ 메뉴
  function viewMenu() {
    if (!state.room) { go(''); return; }
    var room = state.room;
    var quizCount = (room.quiz || []).length;
    var done = state.result;

    render(
      topbar(room.title || '강의', '') +
      '<div class="stack-lg">' +
        '<div class="card tight">' +
          '<div class="row">' +
            '<div style="flex:1;min-width:0">' +
              '<h2>' + esc(room.title || '제목 없는 강의') + '</h2>' +
              '<p class="muted">' + (room.teacher ? esc(room.teacher) + ' · ' : '') + esc(state.name) + '님으로 참여 중</p>' +
            '</div>' +
            '<span class="badge mono">' + esc(room.code) + '</span>' +
          '</div>' +
        '</div>' +

        '<div class="menu-grid">' +
          '<button class="menu-item" data-back="summary">' +
            '<span class="emoji">📘</span><span class="name">강의 요약</span>' +
            '<span class="desc">' + (room.summary || []).length + '개 섹션</span></button>' +
          '<button class="menu-item" data-back="quiz">' +
            '<span class="emoji">✏️</span><span class="name">퀴즈 풀기</span>' +
            '<span class="desc">' + quizCount + '문제' + (done ? ' · 완료' : '') + '</span></button>' +
          '<button class="menu-item" data-back="rank">' +
            '<span class="emoji">🏆</span><span class="name">명예의 전당</span>' +
            '<span class="desc">지금 순위 보기</span></button>' +
          '<button class="menu-item" data-back="' + (done ? 'result' : 'quiz') + '">' +
            '<span class="emoji">🎯</span><span class="name">내 결과</span>' +
            '<span class="desc">' + (done ? done.score + '점' : '아직 없음') + '</span></button>' +
        '</div>' +

        '<div class="center"><button class="btn ghost" id="leave-btn">나가기</button></div>' +
      '</div>'
    );

    $('#leave-btn').addEventListener('click', function () {
      state.room = null;
      state.quiz = null;
      state.result = null;
      try { sessionStorage.removeItem(SESSION_KEY); } catch (err) { /* 무시 */ }
      go('');
    });
  }

  // ------------------------------------------------------------------ 강의 요약
  function viewSummary() {
    if (!state.room) { go(''); return; }
    var sections = state.room.summary || [];
    var body = sections.length
      ? sections.map(function (section, i) {
        return '<div class="card section-card">' +
          '<h3>' + (i + 1) + '. ' + esc(section.heading || '') + '</h3>' +
          (section.body ? '<p class="body">' + esc(section.body) + '</p>' : '') +
          ((section.points || []).length
            ? '<ul>' + section.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>'
            : '') +
          '</div>';
      }).join('')
      : '<div class="empty"><span class="emoji">📭</span>아직 등록된 요약이 없습니다.</div>';

    render(
      topbar('강의 요약', 'menu') +
      '<div class="stack">' + body +
      '<button class="btn" data-back="quiz">퀴즈 풀러 가기</button></div>'
    );
  }

  // ------------------------------------------------------------------ 퀴즈
  function startQuiz() {
    var room = state.room;
    var questions = (room.quiz || []).slice();
    var order = questions.map(function (_, i) { return i; });
    if (room.shuffle) {
      for (var i = order.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
      }
    }
    state.quiz = {
      order: order,
      index: 0,
      answers: [],
      score: 0,
      correct: 0,
      startedAt: Date.now(),
      questionStartedAt: Date.now(),
      revealed: false,
      picked: -1
    };
  }

  function currentQuestion() {
    var quiz = state.quiz;
    return state.room.quiz[quiz.order[quiz.index]];
  }

  // 정답이면 기본 점수 70% + 남은 시간에 따른 속도 보너스 30%
  function scoreFor(question, elapsedMs, limitSec) {
    var max = question.points || 100;
    var reference = (limitSec || 30) * 1000;
    var ratio = Math.max(0, 1 - elapsedMs / reference);
    return Math.round(max * 0.7 + max * 0.3 * ratio);
  }

  function viewQuiz() {
    if (!state.room) { go(''); return; }
    if (!(state.room.quiz || []).length) {
      render(topbar('퀴즈', 'menu') + '<div class="empty"><span class="emoji">🕊️</span>등록된 퀴즈가 없습니다.</div>');
      return;
    }
    if (!state.quiz) startQuiz();
    renderQuestion();
  }

  function renderQuestion() {
    var quiz = state.quiz;
    var room = state.room;
    var question = currentQuestion();
    var limit = room.timeLimit || 0;

    var dots = quiz.order.map(function (_, i) {
      var cls = 'dot';
      if (i < quiz.index) cls += quiz.answers[i] && quiz.answers[i].correct ? ' done' : ' miss';
      else if (i === quiz.index) cls += ' current';
      return '<span class="' + cls + '"></span>';
    }).join('');

    var choices = (question.choices || []).map(function (choice, i) {
      return '<button class="choice" data-choice="' + i + '">' +
        '<span class="key">' + String.fromCharCode(65 + i) + '</span>' +
        '<span>' + esc(choice) + '</span></button>';
    }).join('');

    render(
      topbar('퀴즈 ' + (quiz.index + 1) + ' / ' + quiz.order.length, 'menu') +
      '<div class="stack">' +
        '<div class="quiz-progress">' + dots + '</div>' +
        (limit ? '<div class="timer-bar" id="timer"><i style="width:100%"></i></div>' : '') +
        '<div class="card"><h2>' + esc(question.question || '') + '</h2></div>' +
        '<div class="stack" id="choices">' + choices + '</div>' +
        '<div id="feedback"></div>' +
      '</div>'
    );

    quiz.questionStartedAt = Date.now();
    quiz.revealed = false;

    on('[data-choice]', 'click', function (e) {
      answer(parseInt(e.currentTarget.getAttribute('data-choice'), 10));
    });

    if (limit) {
      var bar = $('#timer > i');
      var timer = setInterval(function () {
        var elapsed = Date.now() - quiz.questionStartedAt;
        var left = Math.max(0, 1 - elapsed / (limit * 1000));
        bar.style.width = (left * 100).toFixed(1) + '%';
        $('#timer').classList.toggle('urgent', left < 0.3);
        if (left <= 0) {
          clearInterval(timer);
          if (!quiz.revealed) answer(-1);
        }
      }, 200);
      cleanup(function () { clearInterval(timer); });
    }
  }

  function answer(picked) {
    var quiz = state.quiz;
    if (quiz.revealed) return;
    quiz.revealed = true;
    quiz.picked = picked;

    var question = currentQuestion();
    var elapsed = Date.now() - quiz.questionStartedAt;
    var isCorrect = picked === question.answer;
    var gained = isCorrect ? scoreFor(question, elapsed, state.room.timeLimit) : 0;

    quiz.answers[quiz.index] = { picked: picked, correct: isCorrect, gained: gained, ms: elapsed };
    quiz.score += gained;
    if (isCorrect) quiz.correct++;

    $$('[data-choice]').forEach(function (node) {
      var index = parseInt(node.getAttribute('data-choice'), 10);
      node.disabled = true;
      if (index === question.answer) node.classList.add('correct');
      else if (index === picked) node.classList.add('wrong');
      else node.classList.add('dim');
    });

    var isLast = quiz.index === quiz.order.length - 1;
    var headline = picked === -1 ? '시간 초과' : (isCorrect ? '정답!' : '오답');
    $('#feedback').innerHTML =
      '<div class="card stack fade-in">' +
        '<div class="row">' +
          '<span class="verdict ' + (isCorrect ? 'ok' : 'no') + '">' + headline + '</span>' +
          '<div class="spacer"></div>' +
          '<span class="mono">+' + gained + '점</span>' +
        '</div>' +
        (question.why ? '<p class="muted">' + esc(question.why) + '</p>' : '') +
        '<button class="btn" id="next-btn">' + (isLast ? '결과 보기' : '다음 문제') + '</button>' +
      '</div>';

    $('#next-btn').addEventListener('click', function () {
      if (isLast) finishQuiz();
      else { quiz.index++; runCleanups(); renderQuestion(); }
    });
  }

  function finishQuiz() {
    var quiz = state.quiz;
    state.result = {
      score: quiz.score,
      correct: quiz.correct,
      total: quiz.order.length,
      ms: Date.now() - quiz.startedAt,
      submitted: false
    };
    go('result');
  }

  // ------------------------------------------------------------------ 결과
  function viewResult() {
    if (!state.room) { go(''); return; }
    if (!state.result) { go('quiz'); return; }
    var result = state.result;
    var room = state.room;

    var entry = {
      id: window.Store.entryIdFor(room.code),
      name: state.name,
      score: result.score,
      correct: result.correct,
      total: result.total,
      ms: result.ms,
      at: Date.now(),
      room: room.code
    };
    var resultCode = window.Payload.encodeResult(entry);

    render(
      topbar('내 결과', 'menu') +
      '<div class="stack-lg">' +
        '<div class="hero">' +
          '<div class="eyebrow">' + esc(state.name) + '</div>' +
          '<div class="score-pop">' + result.score + '<span style="font-size:1rem;font-weight:600"> 점</span></div>' +
          '<p class="muted">' + result.correct + ' / ' + result.total + ' 정답 · ' + formatDuration(result.ms) + '</p>' +
        '</div>' +

        '<div class="card stack">' +
          '<button class="btn" id="register-btn">명예의 전당에 등록하기</button>' +
          '<div id="register-msg"></div>' +
        '</div>' +

        (window.Store.isCloud ? '' :
          '<div class="card stack">' +
            '<h3>결과 코드</h3>' +
            '<p class="tiny">로컬 모드에서는 점수가 이 기기에만 저장됩니다. 아래 코드를 강사에게 보여주면 ' +
            '전체 명예의 전당에 합쳐집니다.</p>' +
            '<input class="mono" id="result-code" readonly value="' + esc(resultCode) + '">' +
            '<button class="btn ghost" id="copy-result">결과 코드 복사</button>' +
          '</div>') +

        '<div class="row">' +
          '<button class="btn ghost" id="retry-btn">다시 풀기</button>' +
          '<button class="btn" data-back="rank">명예의 전당</button>' +
        '</div>' +
      '</div>'
    );

    $('#register-btn').addEventListener('click', function () {
      var button = this;
      button.disabled = true;
      $('#register-msg').innerHTML = '<div class="notice">등록하는 중…</div>';
      window.Store.submitScore(room.code, entry).then(function () {
        result.submitted = true;
        $('#register-msg').innerHTML = '<div class="notice">등록되었습니다. 명예의 전당에서 확인하세요.</div>';
        button.textContent = '등록 완료';
      }).catch(function (err) {
        button.disabled = false;
        $('#register-msg').innerHTML = '<div class="notice err">' + esc(err.message) + '</div>';
      });
    });

    var copyButton = $('#copy-result');
    if (copyButton) {
      copyButton.addEventListener('click', function () { copyText(resultCode, this); });
    }

    $('#retry-btn').addEventListener('click', function () {
      state.quiz = null;
      state.result = null;
      go('quiz');
    });
  }

  // ------------------------------------------------------------------ 명예의 전당
  function medal(position) {
    return position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : position;
  }

  function rankRows(list, myId) {
    if (!list.length) {
      return '<div class="empty"><span class="emoji">🏅</span>아직 등록된 기록이 없습니다.<br>' +
        '<span class="tiny">퀴즈를 풀고 첫 번째 이름을 올려보세요.</span></div>';
    }
    return '<div class="rank-list">' + list.map(function (item, i) {
      var position = i + 1;
      var cls = 'rank-row' + (position <= 3 ? ' top' + position : '') + (item.id === myId ? ' me' : '');
      return '<div class="' + cls + '">' +
        '<div class="pos">' + medal(position) + '</div>' +
        '<div class="who"><div class="nm">' + esc(item.name || '이름 없음') + '</div>' +
          '<div class="tiny">' + (item.correct || 0) + '/' + (item.total || 0) + ' 정답 · ' + formatDuration(item.ms) + '</div></div>' +
        '<div class="pts">' + (item.score || 0) + '</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function viewRank() {
    if (!state.room) { go(''); return; }
    var room = state.room;
    var myId = window.Store.entryIdFor(room.code);

    render(
      topbar('명예의 전당', 'menu') +
      '<div class="stack">' +
        '<div class="card tight row">' +
          '<div style="flex:1;min-width:0"><h3>' + esc(room.title || '강의') + '</h3>' +
          '<p class="tiny">' + (window.Store.isCloud ? '실시간으로 순위가 갱신됩니다' : '이 기기에 저장된 기록입니다') + '</p></div>' +
          '<span class="badge mono">' + esc(room.code) + '</span>' +
        '</div>' +
        '<div id="rank-body"><div class="notice">불러오는 중…</div></div>' +
      '</div>'
    );

    var unsubscribe = window.Store.watchScores(room.code, function (list) {
      var body = $('#rank-body');
      if (body) body.innerHTML = rankRows(list, myId);
    });
    cleanup(unsubscribe);
  }

  // ------------------------------------------------------------------ 강사 홈
  function viewHost() {
    var rooms = window.Store.listLocalRooms();
    var list = rooms.length
      ? rooms.map(function (room) {
        return '<div class="card tight stack">' +
          '<div class="row">' +
            '<div style="flex:1;min-width:0">' +
              '<h3>' + esc(room.title || '제목 없는 강의') + '</h3>' +
              '<p class="tiny">퀴즈 ' + (room.quiz || []).length + '문제 · 요약 ' + (room.summary || []).length + '개</p>' +
            '</div>' +
            '<span class="badge mono">' + esc(room.code) + '</span>' +
          '</div>' +
          '<div class="row wrap">' +
            '<button class="btn sm" data-back="host/live/' + esc(room.code) + '">발표 화면</button>' +
            '<button class="btn sm ghost" data-back="host/edit/' + esc(room.code) + '">편집</button>' +
            '<button class="btn sm danger" data-del="' + esc(room.code) + '">삭제</button>' +
          '</div>' +
        '</div>';
      }).join('')
      : '<div class="empty"><span class="emoji">🗂️</span>아직 만든 강의가 없습니다.</div>';

    render(
      topbar('강사용', '') +
      '<div class="stack-lg">' +
        '<div class="hero">' +
          '<div class="eyebrow">강사 모드</div>' +
          '<h1>강의를 만들고<br>QR로 띄우기</h1>' +
        '</div>' +
        '<div class="row">' +
          '<button class="btn" id="new-btn">새 강의 만들기</button>' +
          '<button class="btn ghost" id="demo-btn">데모 불러오기</button>' +
        '</div>' +
        '<div class="stack">' + list + '</div>' +
        (window.Store.isCloud ? '' :
          '<div class="notice warn">로컬 모드로 동작 중입니다. 강의 내용은 QR 안에 담겨 전달되고, 학생 점수는 ' +
          '결과 코드로 모읍니다. 점수를 자동으로 모으려면 <span class="mono">config.js</span> 에 ' +
          'Realtime Database 주소를 넣으세요.</div>') +
      '</div>'
    );

    $('#new-btn').addEventListener('click', function () {
      var room = blankRoom();
      window.Store.saveLocalRoom(room).then(function () { go('host/edit/' + room.code); });
    });

    $('#demo-btn').addEventListener('click', function () {
      var demo = JSON.parse(JSON.stringify(window.SAMPLE_LECTURE));
      demo.code = window.Store.randomCode(6);
      demo.createdAt = Date.now();
      window.Store.saveLocalRoom(demo).then(function () { go('host/edit/' + demo.code); });
    });

    on('[data-del]', 'click', function (e) {
      var code = e.currentTarget.getAttribute('data-del');
      if (!confirm('이 강의와 기록을 모두 지울까요?')) return;
      window.Store.deleteLocalRoom(code);
      viewHost();
    });
  }

  function blankRoom() {
    return {
      code: window.Store.randomCode(6),
      title: '',
      teacher: '',
      timeLimit: 30,
      shuffle: true,
      createdAt: Date.now(),
      summary: [{ heading: '', body: '', points: [] }],
      quiz: [{ question: '', choices: ['', '', '', ''], answer: 0, points: 100, why: '' }]
    };
  }

  // ------------------------------------------------------------------ 강의 편집
  function viewHostEdit(code) {
    window.Store.loadLocalRoom(code).then(function (room) {
      if (!room) { go('host'); return; }
      state.draft = room;
      renderEditor();
    });
  }

  function renderEditor() {
    var room = state.draft;

    var summaryBlocks = room.summary.map(function (section, i) {
      return '<div class="editor-block">' +
        '<header><span class="n">섹션 ' + (i + 1) + '</span><div class="spacer"></div>' +
          '<button class="btn sm danger" data-rm-summary="' + i + '">삭제</button></header>' +
        '<div class="stack">' +
          '<div><label>소제목</label><input data-summary="' + i + '" data-key="heading" value="' + esc(section.heading) + '" placeholder="예: 브라우저가 화면을 그리는 순서"></div>' +
          '<div><label>본문</label><textarea data-summary="' + i + '" data-key="body" placeholder="두세 문장으로 핵심을 적어주세요">' + esc(section.body) + '</textarea></div>' +
          '<div><label>핵심 포인트 (한 줄에 하나)</label><textarea data-summary="' + i + '" data-key="points" placeholder="포인트 1&#10;포인트 2">' + esc((section.points || []).join('\n')) + '</textarea></div>' +
        '</div>' +
      '</div>';
    }).join('');

    var quizBlocks = room.quiz.map(function (question, i) {
      var choices = question.choices.map(function (choice, c) {
        return '<div><label>보기 ' + String.fromCharCode(65 + c) + '</label>' +
          '<input data-quiz="' + i + '" data-key="choice" data-choice="' + c + '" value="' + esc(choice) + '"></div>';
      }).join('');
      var picker = question.choices.map(function (_, c) {
        return '<button data-answer="' + i + '" data-choice="' + c + '" class="' + (question.answer === c ? 'on' : '') + '">' +
          String.fromCharCode(65 + c) + '</button>';
      }).join('');
      return '<div class="editor-block">' +
        '<header><span class="n">문제 ' + (i + 1) + '</span><div class="spacer"></div>' +
          '<button class="btn sm danger" data-rm-quiz="' + i + '">삭제</button></header>' +
        '<div class="stack">' +
          '<div><label>질문</label><input data-quiz="' + i + '" data-key="question" value="' + esc(question.question) + '" placeholder="무엇을 묻고 싶나요?"></div>' +
          choices +
          '<div><label>정답</label><div class="answer-pick">' + picker + '</div></div>' +
          '<div><label>배점</label><input type="number" min="10" max="1000" step="10" data-quiz="' + i + '" data-key="points" value="' + (question.points || 100) + '"></div>' +
          '<div><label>해설 (선택)</label><textarea data-quiz="' + i + '" data-key="why" placeholder="정답 공개 후 보여줄 설명">' + esc(question.why) + '</textarea></div>' +
        '</div>' +
      '</div>';
    }).join('');

    render(
      topbar('강의 편집', 'host') +
      '<div class="stack-lg">' +
        '<div class="card stack">' +
          '<div><label>강의 제목</label><input id="f-title" value="' + esc(room.title) + '" placeholder="예: 웹 개발 입문 1주차"></div>' +
          '<div><label>강사 이름</label><input id="f-teacher" value="' + esc(room.teacher) + '" placeholder="선택 사항"></div>' +
          '<div class="row">' +
            '<div style="flex:1"><label>문제당 제한 시간 (초, 0이면 무제한)</label>' +
              '<input id="f-limit" type="number" min="0" max="600" value="' + (room.timeLimit || 0) + '"></div>' +
          '</div>' +
          '<label class="row" style="cursor:pointer">' +
            '<input id="f-shuffle" type="checkbox" style="width:auto" ' + (room.shuffle ? 'checked' : '') + '>' +
            '<span>문제 순서 섞기</span></label>' +
        '</div>' +

        '<div class="stack">' +
          '<div class="row"><h2>강의 요약</h2><div class="spacer"></div>' +
            '<button class="btn sm ghost" id="add-summary">섹션 추가</button></div>' +
          summaryBlocks +
        '</div>' +

        '<div class="stack">' +
          '<div class="row"><h2>퀴즈</h2><div class="spacer"></div>' +
            '<button class="btn sm ghost" id="add-quiz">문제 추가</button></div>' +
          quizBlocks +
        '</div>' +

        '<div id="save-msg"></div>' +
        '<button class="btn" id="save-btn">저장하고 발표 화면 열기</button>' +
      '</div>'
    );

    // 기본 정보
    $('#f-title').addEventListener('input', function () { room.title = this.value; });
    $('#f-teacher').addEventListener('input', function () { room.teacher = this.value; });
    $('#f-limit').addEventListener('input', function () { room.timeLimit = parseInt(this.value, 10) || 0; });
    $('#f-shuffle').addEventListener('change', function () { room.shuffle = this.checked; });

    // 요약 입력
    on('[data-summary]', 'input', function () {
      var section = room.summary[parseInt(this.getAttribute('data-summary'), 10)];
      var key = this.getAttribute('data-key');
      if (key === 'points') {
        section.points = this.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      } else {
        section[key] = this.value;
      }
    });

    // 퀴즈 입력
    on('[data-quiz]', 'input', function () {
      var question = room.quiz[parseInt(this.getAttribute('data-quiz'), 10)];
      var key = this.getAttribute('data-key');
      if (key === 'choice') question.choices[parseInt(this.getAttribute('data-choice'), 10)] = this.value;
      else if (key === 'points') question.points = parseInt(this.value, 10) || 100;
      else question[key] = this.value;
    });

    on('[data-answer]', 'click', function () {
      var index = parseInt(this.getAttribute('data-answer'), 10);
      room.quiz[index].answer = parseInt(this.getAttribute('data-choice'), 10);
      renderEditor();
    });

    $('#add-summary').addEventListener('click', function () {
      room.summary.push({ heading: '', body: '', points: [] });
      renderEditor();
    });

    $('#add-quiz').addEventListener('click', function () {
      room.quiz.push({ question: '', choices: ['', '', '', ''], answer: 0, points: 100, why: '' });
      renderEditor();
    });

    on('[data-rm-summary]', 'click', function () {
      room.summary.splice(parseInt(this.getAttribute('data-rm-summary'), 10), 1);
      renderEditor();
    });

    on('[data-rm-quiz]', 'click', function () {
      room.quiz.splice(parseInt(this.getAttribute('data-rm-quiz'), 10), 1);
      renderEditor();
    });

    $('#save-btn').addEventListener('click', function () {
      var problems = validateRoom(room);
      if (problems.length) {
        $('#save-msg').innerHTML = '<div class="notice err">' + problems.map(esc).join('<br>') + '</div>';
        return;
      }
      var button = this;
      button.disabled = true;
      $('#save-msg').innerHTML = '<div class="notice">저장하는 중…</div>';
      window.Store.saveLocalRoom(room)
        .then(function () { return window.Store.isCloud ? window.Store.saveRoom(room) : null; })
        .then(function () { go('host/live/' + room.code); })
        .catch(function (err) {
          button.disabled = false;
          $('#save-msg').innerHTML = '<div class="notice err">' + esc(err.message) + '</div>';
        });
    });
  }

  function validateRoom(room) {
    var problems = [];
    if (!room.title.trim()) problems.push('강의 제목을 입력해 주세요.');
    room.quiz.forEach(function (question, i) {
      if (!question.question.trim()) problems.push('문제 ' + (i + 1) + '의 질문이 비어 있습니다.');
      var filled = question.choices.filter(function (c) { return c.trim(); }).length;
      if (filled < 2) problems.push('문제 ' + (i + 1) + '은 보기가 최소 2개 필요합니다.');
      if (!(question.choices[question.answer] || '').trim()) problems.push('문제 ' + (i + 1) + '의 정답 보기가 비어 있습니다.');
    });
    return problems;
  }

  // ------------------------------------------------------------------ 발표 화면
  function viewHostLive(code) {
    window.Store.loadLocalRoom(code).then(function (room) {
      if (!room) { go('host'); return; }

      render(
        topbar(room.title || '발표 화면', 'host') +
        '<div class="live-grid">' +
          '<div class="stack">' +
            '<div class="card center stack">' +
              '<div id="qr-slot"><div class="notice">QR을 만드는 중…</div></div>' +
              '<div class="joincode">' + esc(room.code) + '</div>' +
              '<p class="tiny">휴대폰 카메라로 QR을 찍거나, 위 참여 코드를 입력하세요.</p>' +
              '<button class="btn ghost" id="copy-link">참여 링크 복사</button>' +
            '</div>' +
            (window.Store.isCloud ? '' :
              '<div class="card stack">' +
                '<h3>결과 코드 모으기</h3>' +
                '<p class="tiny">학생이 보여주는 결과 코드를 붙여넣으면 명예의 전당에 합쳐집니다.</p>' +
                '<input id="paste-code" class="mono" placeholder="예: A1B2.eyJ...">' +
                '<button class="btn" id="add-code">순위에 추가</button>' +
                '<div id="paste-msg"></div>' +
              '</div>') +
          '</div>' +

          '<div class="stack">' +
            '<div class="row"><h2>🏆 명예의 전당</h2><div class="spacer"></div>' +
              '<button class="btn sm danger" id="reset-scores">기록 초기화</button></div>' +
            '<div id="live-rank"><div class="notice">불러오는 중…</div></div>' +
          '</div>' +
        '</div>',
        true
      );

      buildJoinTarget(room).then(function (target) {
        var slot = $('#qr-slot');
        if (!slot) return;
        var svg;
        try {
          // 코드 링크는 짧으니 여유 있게 M, 강의를 통째로 담는 링크는 모듈 수를 줄이려 L
          svg = window.QR.toSVG(target.url, { ecl: target.kind === 'code' ? 'M' : 'L', margin: 2 });
        } catch (err) {
          slot.innerHTML = '<div class="notice err">강의 내용이 QR 하나에 담기에 너무 깁니다. ' +
            '요약을 줄이거나 config.js 에 데이터베이스 주소를 넣어 공유 모드로 전환하세요.</div>';
          return;
        }
        slot.innerHTML = '<div class="qr-wrap" title="탭하면 크게 보입니다">' + svg + '</div>';
        slot.querySelector('.qr-wrap').addEventListener('click', function () { expandQR(svg); });

        var copyButton = $('#copy-link');
        if (copyButton) copyButton.addEventListener('click', function () { copyText(target.url, this); });
      });

      var unsubscribe = window.Store.watchScores(room.code, function (list) {
        var body = $('#live-rank');
        if (body) body.innerHTML = rankRows(list, null);
      });
      cleanup(unsubscribe);

      $('#reset-scores').addEventListener('click', function () {
        if (!confirm('이 강의의 명예의 전당 기록을 모두 지울까요?')) return;
        clearScores(room.code).then(function () {
          var body = $('#live-rank');
          if (body) body.innerHTML = rankRows([], null);
        });
      });

      var addButton = $('#add-code');
      if (addButton) {
        addButton.addEventListener('click', function () {
          var input = $('#paste-code');
          var msg = $('#paste-msg');
          try {
            var entry = window.Payload.decodeResult(input.value);
            entry.id = window.Store.randomId();
            entry.at = Date.now();
            window.Store.addLocalScore(room.code, entry).then(function () {
              msg.innerHTML = '<div class="notice">' + esc(entry.name) + ' · ' + entry.score + '점 추가됨</div>';
              input.value = '';
            });
          } catch (err) {
            msg.innerHTML = '<div class="notice err">' + esc(err.message) + '</div>';
          }
        });
      }
    });
  }

  // 프로젝터 화면 가득 QR 띄우기
  function expandQR(svg) {
    var overlay = document.createElement('div');
    overlay.className = 'qr-overlay';
    overlay.innerHTML = svg;
    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    cleanup(close);
  }

  function clearScores(code) {
    try { localStorage.removeItem('qrclass.scores.' + code); } catch (err) { /* 무시 */ }
    if (!window.Store.isCloud) return Promise.resolve();
    return fetch(String(config.databaseURL).replace(/\/+$/, '') + '/rooms/' + code + '/scores.json', { method: 'DELETE' })
      .then(function () { });
  }

  // 학생이 열게 될 주소를 만든다.
  // 공유 모드면 짧은 코드 링크, 로컬 모드면 강의 전체를 담은 링크.
  function buildJoinTarget(room) {
    if (window.Store.isCloud) {
      return Promise.resolve({ url: baseUrl() + '#/join/' + room.code, kind: 'code' });
    }
    return window.Payload.encodeRoom(room).then(function (fragment) {
      return { url: baseUrl() + '#/j/' + fragment, kind: 'payload' };
    });
  }

  // ------------------------------------------------------------------ 라우터
  function route() {
    runCleanups();
    var hash = location.hash.replace(/^#\/?/, '');
    var parts = hash.split('/');
    var head = parts[0] || '';

    if (head === 'j' && parts[1]) {
      render('<div class="notice">강의를 여는 중…</div>');
      window.Payload.decodeRoom(parts.slice(1).join('/')).then(function (room) {
        window.Store.saveLocalRoom(room);
        viewJoin(room);
      }).catch(function () {
        render('<div class="notice err">QR 링크를 읽지 못했습니다. 다시 찍어 주세요.</div>' +
          '<div style="margin-top:12px"><button class="btn ghost" data-back="">처음으로</button></div>');
        on('[data-back]', 'click', function () { go(''); });
      });
      return;
    }

    if (head === 'join' && parts[1]) {
      var code = parts[1].toUpperCase();
      render('<div class="notice">강의를 불러오는 중…</div>');
      window.Store.loadRoom(code)
        .then(function (room) { return room || window.Store.loadLocalRoom(code); })
        .then(function (room) {
          if (room) viewJoin(room);
          else {
            render('<div class="notice err">참여 코드 ' + esc(code) + ' 에 해당하는 강의를 찾지 못했습니다.</div>' +
              '<div style="margin-top:12px"><button class="btn ghost" id="home-btn">처음으로</button></div>');
            $('#home-btn').addEventListener('click', function () { go(''); });
          }
        });
      return;
    }

    if (head === 'host') {
      if (parts[1] === 'edit' && parts[2]) return viewHostEdit(parts[2]);
      if (parts[1] === 'live' && parts[2]) return viewHostLive(parts[2]);
      return viewHost();
    }

    switch (head) {
      case 'menu': return viewMenu();
      case 'summary': return viewSummary();
      case 'quiz': return viewQuiz();
      case 'result': return viewResult();
      case 'rank': return viewRank();
      default: return viewHome();
    }
  }

  restoreSession();
  window.addEventListener('hashchange', route);
  route();
})();
