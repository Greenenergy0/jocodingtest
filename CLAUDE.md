# CLAUDE.md

> Source: https://github.com/multica-ai/andrej-karpathy-skills
> Andrej Karpathy의 LLM 코딩 관찰(모델이 확인 없이 임의로 가정하고, API/코드를 과도하게 복잡하게 만들고, 관계없는 코드까지 건드리는 경향)을 줄이기 위한 행동 가이드라인.
> 프로젝트 고유 지침과 함께 사용하며, 사소한 작업에는 판단력을 발휘해 유연하게 적용한다.

## 1. Think Before Coding (코딩 전에 먼저 생각하기)

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- 가정을 명시적으로 밝힌다. 불확실하면 질문한다.
- 여러 해석이 가능하면 조용히 하나를 고르지 말고 선택지를 제시한다.
- 더 단순한 접근이 있으면 말한다. 필요하면 반박(push back)한다.
- 불명확한 부분이 있으면 멈추고, 무엇이 헷갈리는지 명확히 말한 뒤 질문한다.

## 2. Simplicity First (단순함 우선)

**Minimum code that solves the problem. Nothing speculative.**

- 요청받은 것 이상의 기능을 넣지 않는다.
- 한 번만 쓰이는 코드에 추상화를 만들지 않는다.
- 요청하지 않은 "유연성"/"설정 가능성"을 넣지 않는다.
- 일어날 수 없는 상황에 대한 에러 핸들링을 넣지 않는다.
- 200줄로 짰는데 50줄로 될 수 있다면 다시 짠다.

기준: "시니어 엔지니어가 보면 이걸 과하게 복잡하다고 할까?" 그렇다면 단순화한다.

## 3. Surgical Changes (외과적 수술처럼 정밀하게 변경)

**Touch only what you must. Clean up only your own mess.**

- 인접한 코드/주석/포맷팅을 "개선"하지 않는다.
- 망가지지 않은 것을 리팩터링하지 않는다.
- 내 취향과 다르더라도 기존 스타일을 그대로 따른다.
- 관련 없는 죽은 코드를 발견하면 언급만 하고 삭제하지 않는다.
- 내 변경으로 인해 생긴 미사용 import/변수/함수만 제거한다. 원래 있던 죽은 코드는 요청 없이 지우지 않는다.

테스트: 변경된 모든 줄은 사용자의 요청과 직접 연결되어야 한다.

## 4. Goal-Driven Execution (목표 지향 실행)

**Define success criteria. Loop until verified.**

작업을 검증 가능한 목표로 바꾼다:
- "검증 추가해줘" → "잘못된 입력에 대한 테스트를 작성하고, 통과하게 만든다"
- "버그 고쳐줘" → "버그를 재현하는 테스트를 작성하고, 통과하게 만든다"
- "X 리팩터링해줘" → "리팩터링 전후로 테스트가 통과하는지 확인한다"

다단계 작업은 간단한 계획을 먼저 제시한다:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

강한 성공 기준은 독립적으로 반복(loop) 작업을 가능하게 한다. "그냥 되게 해줘" 같은 약한 기준은 계속된 확인을 필요로 한다.

---

**이 가이드라인이 잘 작동하고 있다는 신호:** diff에 불필요한 변경이 줄어들고, 과도한 설계로 인한 재작업이 줄어들고, 실수 이후가 아니라 구현 이전에 명확화 질문이 나온다.

---

## Appendix: Examples (원문 요약)

원본 저장소의 `EXAMPLES.md`에 각 원칙별로 Before/After 코드 예시가 정리되어 있다 (export 기능에서 숨겨진 가정, discount 계산의 과도한 추상화, 버그 수정 중 불필요한 리팩터링, "인증 시스템 고쳐줘" 같은 모호한 요청을 검증 가능한 계획으로 바꾸는 예시 등). 핵심 요지:

> Good code is code that solves today's problem simply, not tomorrow's problem prematurely.

전체 예시는 https://github.com/multica-ai/andrej-karpathy-skills/blob/main/EXAMPLES.md 참고.
