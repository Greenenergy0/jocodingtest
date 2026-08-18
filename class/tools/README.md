# 검증·빌드 스크립트

앱(`class/`)은 의존성이 하나도 없습니다. 여기 있는 스크립트만 개발용 패키지를 씁니다.

```bash
cd class/tools
npm install
npx playwright install chromium   # 브라우저가 이미 있으면 생략
npm test
```

## 무엇을 검증하나

| 명령 | 하는 일 |
| --- | --- |
| `npm run test:qr` | 직접 구현한 QR 생성기를 `qrcode` 패키지와 비트 단위로 대조 (무작위 2,000여 건 + 경계값) |
| `npm run test:local` | 로컬 모드 전 구간. **화면의 QR을 이미지로 구워 실제 디코더로 되읽어** 폰 카메라와 같은 경로를 확인 |
| `npm run test:cloud` | 공유 모드 전 구간. mock 데이터베이스를 띄우고 학생 2명이 서로 다른 기기에서 참여 |
| `npm test` | 위 셋을 순서대로 |

강사 화면과 학생 화면은 각각 다른 브라우저 컨텍스트로 띄웁니다. 저장소·쿠키가
분리되므로 실제로 다른 기기에서 접속하는 것과 같은 조건입니다.

`test:local` 은 저장소가 막힌 브라우저(시크릿 모드 등)에서도 앱이 메모리로
대체해 끝까지 동작하는지까지 확인합니다.

## 빌드

```bash
npm run build            # class/lecture-room.single.html 생성
npm run build -- 경로    # 원하는 위치로
```

`class/` 의 8개 파일을 한 개의 HTML로 묶습니다. 강사가 USB로 들고 다니거나
파일 하나만 올릴 수 있는 곳에 배포할 때 씁니다. 어떤 charset 헤더로 서빙되어도
한글이 깨지지 않도록 **순수 ASCII** 로 출력합니다.

## mock 데이터베이스

```bash
npm run mock-db          # http://127.0.0.1:8124
```

Firebase Realtime Database REST API 중 앱이 쓰는 부분만 흉내 냅니다
(경로별 GET/PUT/DELETE, SSE 스트리밍, CORS). 실제 Firebase 프로젝트 없이
공유 모드를 손으로 만져보고 싶을 때 `class/config.js` 의 `databaseURL` 에
저 주소를 넣으면 됩니다.

## 참고

- 크로미움 경로를 직접 지정하려면 `CHROMIUM_PATH` 환경변수를 쓰세요.
  지정하지 않으면 playwright 기본값을 쓰고, 없으면 `PLAYWRIGHT_BROWSERS_PATH`
  아래에서 찾습니다.
- 각 스크립트는 자기 정적 서버를 빈 포트로 띄웁니다. 미리 서버를 켜둘 필요가 없습니다.
