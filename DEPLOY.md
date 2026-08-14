# 배포 가이드 — 샘플 플로우 보드

Firebase Hosting에 올리는 방법입니다. 이 저장소에는 자동 배포(GitHub Actions)가
없으므로, `git push`만으로는 사이트에 반영되지 않습니다. 아래 명령을 직접 실행해야
합니다.

- Firebase 프로젝트: **jocodingtest** (`.firebaserc`에 지정되어 있음)
- 배포 후 주소: **https://jocodingtest.web.app/flow**

---

## 처음 한 번만 하면 되는 것

### 1. Node.js 확인

```bash
node -v
```

`v20` 이상이면 됩니다. 없으면 https://nodejs.org 에서 LTS 버전을 설치하세요.

### 2. Firebase 로그인

```bash
npx firebase-tools login
```

브라우저가 열립니다. **Firebase 프로젝트 `jocodingtest`의 소유자 계정**으로
로그인하세요. `npx`를 쓰므로 전역 설치는 필요 없습니다.

### 3. 접근 권한 확인

```bash
npx firebase-tools projects:list
```

목록에 `jocodingtest`가 보이면 준비 끝입니다.

---

## 배포할 때마다 하는 것

### 1. 최신 코드 받기

```bash
git checkout main
git pull
```

### 2. 로컬에서 먼저 확인 (선택)

```bash
npx firebase-tools serve --only hosting
```

http://localhost:5000/flow 에서 실제 배포와 같은 라우팅으로 열립니다.
`Ctrl+C`로 종료합니다.

### 3. 미리보기 채널로 올려보기 (권장)

실서비스 주소를 건드리지 않고 임시 주소에 먼저 올려볼 수 있습니다.

```bash
npx firebase-tools hosting:channel:deploy preview
```

`https://jocodingtest--preview-xxxx.web.app` 같은 임시 주소가 출력됩니다.
기본 7일 후 자동으로 사라집니다. 폰에서 열어보기 좋습니다.

### 4. 실제 배포

```bash
npx firebase-tools deploy --only hosting
```

1분 안에 끝납니다. 완료되면 **Hosting URL**이 출력됩니다.

### 5. 확인

- https://jocodingtest.web.app/flow — 짧은 주소 (들고 다니기 좋음)
- https://jocodingtest.web.app/sample-flow.html — 직접 주소

---

## 알아둘 것

### 올라가는 파일

`firebase.json`의 `public`이 `"."`이라 **저장소 루트 전체**가 공개됩니다.
현재 올라가는 것은 다음 6개입니다.

```
index.html          (기존 메시지 생성기)
main.js  style.css  (기존 페이지용)
sample-flow.html    (이 도구)
manifest.json  icon.svg  apple-touch-icon.png
```

`DEPLOY.md`, `blueprint.md`, 점(`.`)으로 시작하는 파일은 `ignore`에 넣어
배포에서 빠집니다. 공개되면 곤란한 파일은 루트에 두지 마세요.

### 주소 규칙

`firebase.json`의 `rewrites`는 **위에서부터 먼저 맞는 것**이 이깁니다.

| 주소 | 결과 |
|---|---|
| `/flow` | `sample-flow.html` |
| `/sample-flow.html` | 파일 그대로 |
| 그 밖의 모든 주소 | `index.html` |

마지막 줄 때문에 **오타를 내도 404가 아니라 기존 메시지 생성기 페이지가
뜹니다.** 링크를 공유할 때는 `/flow`를 그대로 쓰세요.

### 폰에서 앱처럼 쓰기

배포 후 폰 브라우저로 `/flow`를 열고,

- **iPhone (Safari)**: 공유 → `홈 화면에 추가`
- **Android (Chrome)**: 메뉴 → `홈 화면에 추가` 또는 `앱 설치`

주소창 없이 앱처럼 열립니다. 아이콘은 `icon.svg` / `apple-touch-icon.png`입니다.

### 입력 데이터는 어디에 저장되나

브라우저의 **localStorage**입니다. 서버에 올라가지 않습니다.

- 기기마다 따로 저장됩니다. 폰과 PC가 자동으로 동기화되지 않습니다.
- 기기 간 이동은 화면 위 **`공유 링크 복사`** — 내용이 통째로 주소에 담깁니다.
- 백업은 `파일` 탭의 **`JSON 내보내기`**.
- 재배포해도 이미 저장된 입력은 지워지지 않습니다. 예시 데이터로 되돌리려면
  화면의 **`예시 데이터`** 버튼을 누르세요.

### 되돌리기

Firebase 콘솔 → Hosting → 버전 기록에서 이전 버전으로 롤백할 수 있습니다.
https://console.firebase.google.com/project/jocodingtest/hosting

---

## 막혔을 때

| 증상 | 해결 |
|---|---|
| `Error: Failed to get Firebase project jocodingtest` | 로그인 계정에 권한이 없습니다. `npx firebase-tools login --reauth` 후 소유자 계정으로 다시 로그인 |
| `Error: Not in a Firebase app directory` | 저장소 루트(`firebase.json`이 있는 폴더)에서 실행하세요 |
| `/flow`가 메시지 생성기 페이지로 뜸 | 배포 전 `firebase.json`으로 올라간 것입니다. `git pull` 후 다시 배포 |
| 배포했는데 옛날 화면이 보임 | 브라우저 강력 새로고침 (`Ctrl+Shift+R` / `Cmd+Shift+R`) |
| 폰에서 글자가 잘림 | 그림은 화면 안에서 가로로 밀립니다. 좌우로 스크롤하세요 |

---

## 한 줄 요약

```bash
git pull && npx firebase-tools deploy --only hosting
```
