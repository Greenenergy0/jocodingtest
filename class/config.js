/**
 * 실시간 강의실 설정
 *
 * databaseURL 을 비워두면 "로컬 모드"로 동작한다.
 *  - 로컬 모드: 강의 내용은 QR 안에 통째로 담겨 학생 폰으로 전달되고,
 *    명예의 전당 기록은 각자의 기기에만 저장된다. 서버가 전혀 필요 없다.
 *    강사는 학생이 보여주는 "결과 코드"를 붙여넣어 전체 순위를 모을 수 있다.
 *  - 공유 모드: Firebase Realtime Database 주소를 넣으면 모든 학생의 점수가
 *    실시간으로 한 화면에 모인다. SDK 없이 REST + SSE 만 사용한다.
 *
 * 공유 모드 켜는 법
 *  1) https://console.firebase.google.com 에서 프로젝트 → Realtime Database 생성
 *  2) 아래 databaseURL 에 주소를 붙여넣는다 (예: https://내프로젝트-default-rtdb.firebaseio.com)
 *  3) 규칙(Rules)을 강의 시간 동안만 아래처럼 열어둔다.
 *     {
 *       "rules": {
 *         "rooms": {
 *           "$code": {
 *             ".read": true,
 *             ".write": true,
 *             ".validate": "$code.length <= 8"
 *           }
 *         }
 *       }
 *     }
 *     ※ 누구나 읽고 쓸 수 있는 상태이므로 강의가 끝나면 규칙을 다시 닫는 것을 권장한다.
 */
window.CLASS_CONFIG = {
  databaseURL: '',
  brand: '실시간 강의실'
};
