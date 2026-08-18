/**
 * e2e-local.js — 로컬 모드(서버 없음) 전 구간을 실제 브라우저로 돌린다.
 *
 * 강사 화면과 학생 화면을 서로 다른 브라우저 컨텍스트로 띄워 "다른 기기"를
 * 흉내내고, 화면에 그려진 QR을 이미지로 구워 실제 디코더로 되읽는다.
 * 즉 폰 카메라로 찍었을 때와 같은 경로를 검증한다.
 *
 *   node class/tools/e2e-local.js
 */
const jsQR = require('jsqr');
const { PNG } = require('pngjs');
const { startStaticServer, launchBrowser, reporter } = require('./helpers');

/** 첫 보기를 계속 고르며 퀴즈를 끝까지 푼다. */
async function playQuiz(page, choiceIndex = 0) {
  let answered = 0;
  for (;;) {
    await page.waitForSelector('[data-choice]');
    await page.locator('[data-choice]').nth(choiceIndex).click();
    await page.waitForSelector('#next-btn');
    const label = await page.locator('#next-btn').textContent();
    await page.click('#next-btn');
    answered++;
    if (label.includes('결과')) return answered;
    if (answered > 50) throw new Error('퀴즈가 끝나지 않습니다');
  }
}

async function openDemoLecture(page, baseUrl) {
  await page.goto(baseUrl + '/class/');
  await page.getByRole('button', { name: '강사용 화면 열기' }).click();
  await page.getByRole('button', { name: '데모 불러오기' }).click();
  await page.waitForSelector('#f-title');
  await page.getByRole('button', { name: '저장하고 발표 화면 열기' }).click();
  await page.waitForSelector('.qr-wrap svg');
}

(async () => {
  const log = reporter('로컬 모드 (서버 없이 QR 안에 강의를 담아 전달)');
  const server = await startStaticServer();
  const browser = await launchBrowser();
  const errors = [];

  const watch = (page, who) => {
    page.on('pageerror', e => errors.push(`${who} 예외: ${e.message}`));
    page.on('console', m => {
      // favicon 404 같은 리소스 잡음은 무시
      if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(`${who} 콘솔: ${m.text()}`);
    });
  };

  try {
    // ---------- 강사 ----------
    const teacherCtx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 3 });
    const teacher = await teacherCtx.newPage();
    watch(teacher, '강사');

    await openDemoLecture(teacher, server.url);
    const code = (await teacher.locator('.joincode').textContent()).trim();
    log.ok(`발표 화면 진입, 참여 코드 ${code}`);

    const expectedLink = await teacher.evaluate(async () => {
      const room = await window.Store.loadLocalRoom(document.querySelector('.joincode').textContent.trim());
      return location.origin + location.pathname + '#/j/' + (await window.Payload.encodeRoom(room));
    });

    // ---------- QR을 이미지로 구워 진짜 디코더로 읽기 ----------
    const shot = await teacher.locator('.qr-wrap').screenshot({ type: 'png' });
    const png = PNG.sync.read(shot);
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    if (!decoded) throw new Error('렌더링된 QR을 디코더가 읽지 못했습니다');
    if (decoded.data !== expectedLink) throw new Error('QR 내용이 참여 링크와 다릅니다');
    log.ok(`QR 디코딩 성공 (${png.width}px, 링크 ${decoded.data.length}자) — 참여 링크와 일치`);

    // ---------- 전체화면 QR ----------
    await teacher.click('.qr-wrap');
    await teacher.waitForSelector('.qr-overlay svg');
    await teacher.keyboard.press('Escape');
    await teacher.waitForFunction(() => !document.querySelector('.qr-overlay'));
    log.ok('QR 전체화면 열기/닫기');

    // ---------- 학생 (다른 기기) ----------
    const studentCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const student = await studentCtx.newPage();
    watch(student, '학생');

    await student.goto(decoded.data); // 카메라로 찍어 열린 것과 동일
    await student.waitForSelector('#enter-btn');
    log.ok(`스캔한 링크로 강의 열림: ${(await student.locator('.hero h1').textContent()).trim()}`);

    await student.fill('#enter-name', '김학생');
    await student.click('#enter-btn');
    await student.waitForSelector('.menu-grid');

    await student.getByRole('button', { name: /강의 요약/ }).click();
    await student.waitForSelector('.section-card');
    log.ok(`강의 요약 ${await student.locator('.section-card').count()}개 섹션`);

    await student.getByRole('button', { name: '퀴즈 풀러 가기' }).click();
    const answered = await playQuiz(student);
    await student.waitForSelector('.score-pop');
    log.ok(`퀴즈 ${answered}문제 완료, ${(await student.locator('.score-pop').textContent()).trim()}`);

    const resultCode = await student.inputValue('#result-code');
    await student.click('#register-btn');
    await student.waitForSelector('#register-msg .notice');
    await student.getByRole('button', { name: '명예의 전당' }).click();
    await student.waitForSelector('.rank-row');
    log.ok('학생 기기의 명예의 전당에 등록됨');

    // ---------- 결과 코드로 전체 순위 모으기 ----------
    await teacher.fill('#paste-code', resultCode);
    await teacher.click('#add-code');
    await teacher.waitForSelector('#live-rank .rank-row');
    log.ok('강사가 결과 코드를 붙여넣어 순위에 반영');

    const second = await teacher.evaluate(() => window.Payload.encodeResult({
      name: '이학생', score: 999, correct: 5, total: 5, ms: 12000, room: 'X'
    }));
    await teacher.fill('#paste-code', second);
    await teacher.click('#add-code');
    await teacher.waitForFunction(() => document.querySelectorAll('#live-rank .rank-row').length === 2);
    const top = await teacher.locator('#live-rank .rank-row').first().innerText();
    if (!top.includes('이학생')) throw new Error('점수 정렬이 틀렸습니다: ' + top.replace(/\n/g, ' '));
    log.ok('점수 순 정렬 확인 (높은 점수가 1위)');

    await teacher.fill('#paste-code', 'AAAA.bm9wZQ');
    await teacher.click('#add-code');
    await teacher.waitForSelector('#paste-msg .notice.err');
    log.ok('손상된 결과 코드는 거부됨');

    // ---------- 저장소가 막힌 환경 ----------
    const lockedCtx = await browser.newContext();
    const locked = await lockedCtx.newPage();
    watch(locked, '저장소차단');
    await locked.addInitScript(() => {
      const boom = () => { throw new DOMException('blocked', 'SecurityError'); };
      for (const key of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(window, key, { get: boom, configurable: true });
      }
    });
    await openDemoLecture(locked, server.url);
    log.ok('저장소가 막힌 브라우저에서도 발표 화면까지 도달 (메모리 대체)');

    if (errors.length) throw new Error('페이지 오류\n  ' + errors.join('\n  '));
    log.done();
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(err => { console.error('\n실패: ' + err.message + '\n'); process.exit(1); });
