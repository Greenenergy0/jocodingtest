/**
 * e2e-cloud.js — 공유 모드(점수 자동 집계)를 실제 브라우저로 돌린다.
 *
 * 진짜 Firebase 프로젝트 대신 mock-rtdb 를 띄우고, config.js 응답만 가로채
 * databaseURL 을 주입한다. 앱 코드는 전혀 건드리지 않는다.
 * 학생 두 명을 각각 다른 브라우저 컨텍스트로 띄워, 강사 화면이 새로고침 없이
 * 실시간으로 갱신되는지 확인한다.
 *
 *   node class/tools/e2e-cloud.js
 */
const { startStaticServer, launchBrowser, reporter } = require('./helpers');
const mockRtdb = require('./mock-rtdb');

async function playQuiz(page, choiceIndex) {
  for (;;) {
    await page.waitForSelector('[data-choice]');
    await page.locator('[data-choice]').nth(choiceIndex).click();
    await page.waitForSelector('#next-btn');
    const label = await page.locator('#next-btn').textContent();
    await page.click('#next-btn');
    if (label.includes('결과')) return;
  }
}

(async () => {
  const log = reporter('공유 모드 (Realtime Database 로 점수 실시간 집계)');
  const server = await startStaticServer();
  const db = await mockRtdb.start();
  const browser = await launchBrowser();
  const errors = [];

  const CONFIG = `window.CLASS_CONFIG={databaseURL:${JSON.stringify(db.url)},brand:"실시간 강의실"};`;

  async function newPage(options, who) {
    const page = await (await browser.newContext(options)).newPage();
    // config.js 만 갈아끼워 공유 모드로 기동시킨다
    await page.route('**/class/config.js', route =>
      route.fulfill({ contentType: 'application/javascript; charset=utf-8', body: CONFIG }));
    page.on('pageerror', e => errors.push(`${who} 예외: ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(`${who} 콘솔: ${m.text()}`);
    });
    return page;
  }

  try {
    // ---------- 강사 ----------
    const teacher = await newPage({ viewport: { width: 1200, height: 900 } }, '강사');
    await teacher.goto(server.url + '/class/');
    if (!(await teacher.locator('.badge.cloud').count())) throw new Error('공유 모드로 기동하지 않았습니다');
    log.ok('공유 모드 배지 확인');

    await teacher.getByRole('button', { name: '강사용 화면 열기' }).click();
    await teacher.getByRole('button', { name: '데모 불러오기' }).click();
    await teacher.waitForSelector('#f-title');
    await teacher.getByRole('button', { name: '저장하고 발표 화면 열기' }).click();
    await teacher.waitForSelector('.qr-wrap svg');

    const code = (await teacher.locator('.joincode').textContent()).trim();
    if (!db.read('/rooms/' + code + '/room')) throw new Error('강의가 데이터베이스에 저장되지 않았습니다');
    log.ok(`강의가 DB에 저장됨 (코드 ${code})`);

    if (await teacher.locator('#paste-code').count()) {
      throw new Error('공유 모드에서는 결과 코드 입력창이 없어야 합니다');
    }
    log.ok('공유 모드에서 결과 코드 UI 숨김');

    const joinLink = server.url + '/class/#/join/' + code;

    // ---------- 학생 둘, 서로 다른 기기 ----------
    const students = [
      { name: '김학생', pick: 0, via: 'QR 링크로' },
      { name: '이학생', pick: 1, via: '코드 입력으로' }
    ];

    for (const [index, who] of students.entries()) {
      const page = await newPage({ viewport: { width: 390, height: 844 } }, who.name);
      if (index === 0) {
        await page.goto(joinLink);
        await page.waitForSelector('#enter-btn');
        await page.fill('#enter-name', who.name);
        await page.click('#enter-btn');
      } else {
        await page.goto(server.url + '/class/');
        await page.fill('#join-code', code);
        await page.fill('#join-name', who.name);
        await page.click('#join-btn');
      }
      await page.waitForSelector('.menu-grid');

      await page.getByRole('button', { name: /퀴즈 풀기/ }).click();
      await playQuiz(page, who.pick);
      await page.waitForSelector('#register-btn');
      await page.click('#register-btn');
      await page.waitForSelector('#register-msg .notice');
      log.ok(`${who.name} — ${who.via} 입장 후 DB에 점수 등록`);
    }

    // ---------- 강사 화면이 새로고침 없이 갱신되는지 ----------
    await teacher.waitForFunction(
      () => document.querySelectorAll('#live-rank .rank-row').length === 2,
      null, { timeout: 15000 });
    log.ok('강사 발표 화면이 새로고침 없이 두 명을 모두 표시');

    const stored = db.read('/rooms/' + code + '/scores');
    if (Object.keys(stored || {}).length !== 2) throw new Error('DB에 점수가 2건 있어야 합니다');
    log.ok('데이터베이스에 점수 2건 저장 확인');

    // ---------- 기록 초기화 ----------
    teacher.on('dialog', d => d.accept());
    await teacher.click('#reset-scores');
    await teacher.waitForFunction(
      () => document.querySelectorAll('#live-rank .rank-row').length === 0,
      null, { timeout: 10000 });
    if (db.read('/rooms/' + code + '/scores')) throw new Error('DB의 점수가 지워지지 않았습니다');
    log.ok('기록 초기화가 화면과 DB 양쪽에 반영');

    if (errors.length) throw new Error('페이지 오류\n  ' + errors.join('\n  '));
    log.done();
  } finally {
    await browser.close();
    await db.close();
    await server.close();
  }
})().catch(err => { console.error('\n실패: ' + err.message + '\n'); process.exit(1); });
