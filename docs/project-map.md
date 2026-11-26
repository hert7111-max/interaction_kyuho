# 프로젝트 구조

Vite + TypeScript 기반 브라우저 인터랙션 아카이브입니다. Three.js로 GPU 화면을 그리며 MediaPipe Tasks Vision을 로컬 모델 파일로 실행합니다. 카메라 영상·랜드마크는 브라우저에서 처리합니다.

## 진입과 예제

`index.html` → `src/main.ts`에서 `?example=`를 읽어 해당 모듈만 동적으로 불러옵니다. 기본은 `arcade`이며 공통 메뉴 스타일은 `experiment-menu.css`입니다. 예제마다 `#app`과 자체 카메라 생명주기를 구성합니다.

| URL 값 | 진입 | 핵심 구성 |
| --- | --- | --- |
| `arcade` / 기본 | `arcade.ts` | game: 전투·HP·콤보, scene/room/view: 방·시점, monitor/pixel: CRT·픽셀 영상, hand/hand-mesh/controller: 손·컨트롤러, cord: 케이블, burn: 파손 효과 |
| `rubber` | `rubber.ts` | engine: 얼굴 고무 변형·스프링, renderer: 얼굴 합성·피부색 가림, tracking: 손·전체 얼굴 |
| `particle` | `particle.ts` | engine: 화면 전체 역방향 UV 변형·16초 복원, renderer: 흑백 영상, tracking: 손만 추론 |
| `papa` | `papa.ts` | game: 등반·레이저·낙하, renderer/sprites: 인물·효과, tracking: 손·눈·윤곽 |
| `snow` | `snow.ts` | physics: 눈 충돌·적층, scene: 눈·구름·김, snow-tracker: 손·얼굴·사람 분할 |
| `watertouch` / `water` | `watertouch.ts` | water-renderer: GPU 수면·굴절, water-math: 좌표·보정, hand-tracker: 손 |
| `7` | `colatec.ts` | dancehall/dancers/party-music/network/types: 콜라텍 공간·음악·네트워크. game/machine/claw-game/toys: 인형뽑기 관련 구성 |

## 추적과 좌표

`water-math.ts`가 미러·object-fit cover·WebGL의 위쪽 y축에 맞는 좌표 변환을 제공합니다. `papa-runtime.js`는 손·얼굴 모델 초기화와 GPU 실패 시 CPU 대체를 담당합니다. particle은 이를 손 전용으로, rubber는 매 프레임 전체 얼굴 출력으로 확장합니다. Worker 처리가 불가하면 DOM 런타임, ImageBitmap 전송 실패 시 ImageData 전송을 사용합니다. 추론은 한 프레임씩 처리하고 소요 시간에 따라 간격을 조절합니다.

## 서버와 배포

`server/index.mjs`는 개발 모드에서 Vite를 연결하고 프로덕션에서는 dist 정적 파일, API와 `/party` WebSocket을 제공합니다. `server/room.mjs`, `shared/world.mjs`는 네트워크 룸·공유 월드 로직입니다. `server/static-assets.mjs`는 압축 전송 협상과 원본 대체, `server/dev-https.mjs`는 로컬 HTTPS 인증서 검사를 담당합니다.

`predev`에서 인증서와 MediaPipe 파일을 준비하고, `build`는 TypeScript 검사 → Vite 번들링 → 무손실 Brotli/gzip 생성 순서입니다. 모델·SDK·WASM은 `scripts/prepare-mediapipe.mjs`가 public/mediapipe에 준비합니다. `scripts/*.test.mjs`는 엔진·좌표·게임·네트워크 관련 보조 로직·인증서·정적 전송을 검사하고, `*-browser-qa.*`는 개발용 화면 검증 자료입니다. 예제별 동작과 과거 검증 범위는 `docs/`에 보관합니다.
