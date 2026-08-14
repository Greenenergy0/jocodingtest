/**
 * sample.js — 처음 열었을 때 바로 시험해 볼 수 있는 데모 강의
 */
window.SAMPLE_LECTURE = {
  title: '웹 개발 입문 1주차',
  teacher: '조코딩',
  timeLimit: 30,
  shuffle: true,
  summary: [
    {
      heading: '웹은 세 개의 언어로 만들어진다',
      body: 'HTML은 뼈대, CSS는 옷, JavaScript는 움직임을 담당한다. 셋의 역할을 섞지 않는 것이 유지보수의 시작이다.',
      points: [
        'HTML — 문서의 구조와 의미(제목, 문단, 목록)',
        'CSS — 색, 여백, 배치 같은 표현',
        'JavaScript — 클릭, 입력, 통신 같은 동작'
      ]
    },
    {
      heading: '브라우저가 화면을 그리는 순서',
      body: 'HTML을 읽어 DOM 트리를 만들고, CSS를 읽어 스타일을 계산한 뒤, 배치(layout)와 그리기(paint)를 거쳐 화면에 올린다.',
      points: [
        '파싱 → DOM/CSSOM → 렌더 트리 → 레이아웃 → 페인트',
        'script 태그는 파싱을 멈추게 한다. defer 를 붙이면 문서를 다 읽은 뒤 실행된다.',
        '레이아웃을 다시 계산하게 만드는 스타일 변경은 비싸다'
      ]
    },
    {
      heading: '반응형은 "모바일 먼저"',
      body: '좁은 화면 기준으로 먼저 만들고, 넓어질 때 규칙을 더한다. 처음부터 데스크톱을 기준으로 잡으면 예외 처리가 늘어난다.',
      points: [
        'viewport 메타 태그가 없으면 모바일에서 축소되어 보인다',
        'min-width 미디어 쿼리로 넓은 화면 규칙을 덧붙인다',
        '고정 px 대신 rem, %, flex/grid 를 쓴다'
      ]
    }
  ],
  quiz: [
    {
      question: '문서의 구조와 의미를 담당하는 언어는?',
      choices: ['HTML', 'CSS', 'JavaScript', 'SQL'],
      answer: 0,
      points: 100,
      why: 'HTML은 제목·문단·목록처럼 "이것이 무엇인지"를 표현한다.'
    },
    {
      question: '브라우저의 렌더링 순서로 알맞은 것은?',
      choices: [
        '레이아웃 → 파싱 → 페인트',
        '파싱 → 렌더 트리 → 레이아웃 → 페인트',
        '페인트 → 레이아웃 → 파싱',
        '렌더 트리 → 파싱 → 페인트'
      ],
      answer: 1,
      points: 100,
      why: 'HTML/CSS를 파싱해 렌더 트리를 만들고, 위치를 계산한 뒤 화면에 그린다.'
    },
    {
      question: 'script 태그에 defer 를 붙이면 일어나는 일은?',
      choices: [
        '스크립트가 즉시 실행된다',
        '스크립트가 아예 실행되지 않는다',
        'HTML 파싱이 끝난 뒤 실행된다',
        'CSS보다 먼저 실행된다'
      ],
      answer: 2,
      points: 100,
      why: 'defer 는 문서를 다 읽은 뒤 순서대로 실행하므로 파싱을 막지 않는다.'
    },
    {
      question: '모바일에서 화면이 축소되어 보일 때 가장 먼저 확인할 것은?',
      choices: [
        'viewport 메타 태그',
        'favicon 경로',
        'JavaScript 문법 오류',
        '이미지 확장자'
      ],
      answer: 0,
      points: 100,
      why: 'width=device-width 가 없으면 브라우저가 데스크톱 폭을 가정하고 축소한다.'
    },
    {
      question: '반응형 레이아웃에서 권장되지 않는 것은?',
      choices: [
        'flex 와 grid 사용',
        'rem 단위 사용',
        '모든 요소에 고정 px 너비 지정',
        'min-width 미디어 쿼리'
      ],
      answer: 2,
      points: 100,
      why: '고정 px 는 화면 폭이 바뀔 때 넘치거나 남는다.'
    }
  ]
};
