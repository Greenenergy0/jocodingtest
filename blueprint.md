# jocodingtest

빌드 도구 없이 정적 파일만으로 돌아가는 웹 실험실. 리포지토리 루트가 곧 배포되는 사이트다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `index.html`, `main.js`, `style.css` | 기분·상황을 고르면 메시지를 만들어 주는 페이지 |
| `class/` | **실시간 강의실** — QR로 참여하는 강의 요약 & 퀴즈 & 명예의 전당 |
| `sample-flow.html` | 공정 플로우 보드 (단독 실행 파일) |
| `firebase.json`, `.firebaserc` | Firebase Hosting 설정 (`public: "."`) |
| `.github/workflows/deploy-pages.yml` | `main` 푸시 시 GitHub Pages 배포 |

## 실시간 강의실 (`class/`)

강의 시간에 QR 하나를 띄우면 학생들이 각자의 폰으로 들어와 강의 요약을 읽고,
퀴즈를 풀고, 명예의 전당에서 점수를 겨룬다. 자세한 사용법과 설계는
[`class/README.md`](class/README.md) 참고.

핵심 결정 세 가지:

- **의존성 0** — QR 생성기까지 직접 구현해(`class/qr.js`) 외부 스크립트를 쓰지 않는다.
- **서버 없이도 완결** — 로컬 모드에서는 강의 전체를 압축해 QR(URL) 안에 담아 전달하고,
  점수는 짧은 "결과 코드"로 모은다.
- **켜면 실시간** — `class/config.js` 에 Firebase Realtime Database 주소만 넣으면
  REST + SSE로 모든 학생의 점수가 강사 화면에 자동으로 모인다.

## 로컬 실행

```bash
python3 -m http.server 8000
# http://localhost:8000/          메시지 생성기
# http://localhost:8000/class/    실시간 강의실
```

## 배포

- GitHub Pages: `main` 브랜치 푸시 → Actions가 자동 배포.
  저장소 Settings → Pages → Source 를 **GitHub Actions** 로 지정해야 한다.
- Firebase Hosting: `firebase deploy`
