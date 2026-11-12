# WaterTouch · Example 08

카메라 영상을 물 표면처럼 굴절시키는 인터랙션입니다. MediaPipe Hand Landmarker가 양손을 인식하고 각 손의 엄지·검지·중지·약지·새끼손가락 끝을 추적합니다. 손끝이 닿으면 원형 파동이 퍼지고, 움직이면 지나간 경로를 따라 물살이 갈라집니다.

```sh
npm install
npm run dev
```

`http://localhost:5173`에서 ‘카메라 시작하기’를 누르고 카메라 권한을 허용하세요. 카메라는 HTTPS 또는 localhost에서 사용할 수 있습니다. 밝은 곳에서 양손 전체를 화면에 펼치면 더 잘 인식합니다. ‘먼저 물결 체험하기’는 카메라 없이 마우스·터치로 사용할 수 있습니다.

물결 강도와 여운, 손끝 표시, 좌우 반전, 물결 초기화, 카메라 일시정지, 전체 화면을 지원합니다. 정지 시 영상 재생과 카메라 트랙을 비활성화하고, 페이지를 닫으면 트랙과 워커를 종료합니다. 영상과 손 인식은 브라우저 안에서 처리하며 서버에 전송하지 않습니다.

## 구현

- `src/watertouch.ts`: 카메라·입력·손끝 좌표·설정 UI
- `public/hand-tracker.js`: MediaPipe Hand Landmarker 워커, 최대 2손·손마다 21개 랜드마크, GPU 실패 시 CPU 대체
- `src/water-renderer.ts`: GPU 높이/속도 필드의 60Hz 파동 시뮬레이션, 10개 손끝의 연속 경로, 법선 기반 카메라 굴절과 수면 반사
- `src/water-math.ts`: 화면 채움과 거울 모드에 맞춘 좌표 변환, 시간 기반 손떨림 보정
- `scripts/prepare-mediapipe.mjs`: 고정 버전 `@mediapipe/tasks-vision@1.2.3`의 SDK·WASM과 Google의 float16 Hand Landmarker v1 모델을 `public/mediapipe/`에 준비. dev/build 전 자동 실행하며 배포물에 함께 포함

모델을 처음 준비할 때 인터넷 연결이 필요합니다. 실행 시에는 모델·WASM을 사이트 자체에서 불러옵니다. UI 폰트는 Google Fonts를 사용하며 시스템 글꼴로 대체할 수 있습니다. 최신 Chrome 또는 Safari와 WebGL2/부동소수점 렌더 타깃이 필요합니다.

## 확인

```sh
npm test
npm run build
```

자동 검사에서는 열 손끝 선택, 거울/세로 좌표 변환, 세로·울트라와이드 화면의 영상 정합, 손끝 보정을 확인합니다. dev 서버의 `/scripts/water-browser-qa.html`은 Google의 공식 두 손 이미지로 워커 모델 로딩, 실제 양손 10개 손끝 인식, 영상 텍스처, 굴절 픽셀 변화, 10개 이동 경로 렌더링을 확인합니다. 실제 사용자 카메라의 조명·가림·기기별 추적 품질은 환경에 따라 달라집니다.

이전 콜라텍 소스는 `src/colatec.ts`, `src/colatec.css`에 보관했으며 `/?example=7`로 열 수 있습니다. 기존 인형뽑기 설명은 `docs/toy-club.md`에 보관했습니다.

MediaPipe 참고: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js
