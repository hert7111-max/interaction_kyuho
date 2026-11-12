# Snow · Example 08

카메라 화면에 떠다니는 구름을 검지로 찌르면 눈이 내립니다. 눈은 HumanSeg 사람 마스크의 경계와 충돌하고, 마찰로 완만한 곳에 쌓입니다. 가파른 곳에서는 미끄러지고, 몸이 이동해 지지면이 없어지면 중력으로 떨어집니다. 눈이 내리는 동안 입을 벌리면 입 주변 영상에 김이 서리고, 검지로 김을 지우며 그림을 그릴 수 있습니다. 남은 김은 천천히 증발합니다.

상단 메뉴에서 **Snow**와 **WaterTouch · ARCHIVE**를 전환할 수 있습니다. WaterTouch의 렌더러·손 추적·UI 코드는 유지했습니다.

```sh
npm install
npm run dev
```

`http://localhost:5173`에서 ‘카메라 시작하기’를 눌러 권한을 허용하세요. HTTPS 또는 localhost가 필요하며, 영상은 브라우저 안에서만 처리합니다. 밝은 곳에서 얼굴·손·상반신을 보여주세요. 구름은 양손의 검지 끝으로 건드릴 수 있습니다.

‘카메라 없이 먼저 체험하기’에서는 구름을 클릭/터치하고, ‘꾹 눌러 입김 불기’를 누른 뒤 화면을 드래그해 김을 지울 수 있습니다. 이 모드의 윤곽은 체험용 도형이며 실제 사람 인식 결과가 아닙니다.

## 인터랙션

- 구름에 검지가 닿으면 약 6초간 눈이 내립니다. 다시 닿으면 시간을 연장합니다.
- 눈의 양과 바람 방향·세기를 조절할 수 있습니다. ‘윤곽 보기’는 실제 사람 마스크를 반투명하게 표시합니다.
- 얼굴의 입술 랜드마크와 `jawOpen`을 함께 사용해 입 벌림을 인식합니다. 눈이 내릴 때만 새로운 입김이 생성됩니다.
- 입김은 원본 카메라 영상을 흐리게 합성한 응결 영역입니다. 검지의 연속 이동 경로를 따라 부드럽게 지워집니다. 지운 선은 잠시 재응결을 억제하며, 남은 김도 지수 감쇠로 증발합니다.
- 카메라 끄기 또는 메뉴 전환 시 트랙과 워커를 종료합니다. 화면을 벗어나면 추적을 멈추고 오래된 마스크와 손 위치를 지웁니다.

## 구현

- `src/main.ts`, `src/experiment-menu.css`: 예제 선택과 상단 아카이브 메뉴. `/?example=snow`, `/?example=watertouch`, 이전 콜라텍 `/?example=7`.
- `src/snow.ts`: 카메라 생명주기·검지 추적·입 벌림 인식·설정 UI.
- `public/snow-tracker.js`: MediaPipe Hand Landmarker(양손), Image Segmenter(Selfie/HumanSeg), Face Landmarker. 별도 워커, 각 모델의 GPU 실패 시 CPU 대체. 손 추적 최대 20Hz, 사람·얼굴 추적은 그 절반으로 실행합니다.
- `src/snow-physics.ts`: 사람 마스크의 부호 있는 거리장과 표면 법선, 120Hz 적분, 중력·공기저항·바람, 충돌 반발과 Coulomb 정지/운동 마찰, 쌓인 눈끼리의 지지 관계. 마스크가 움직이면 받침이 사라진 적층도 떨어집니다. 카메라 화면의 **2D 물리 근사**이며, 영상에서 실제 3D 몸의 깊이나 재질을 측정하는 방식은 아닙니다.
- `src/snow-scene.ts`: 부유하는 구름·눈송이·사람 윤곽 표시·입김 마스크와 영상 블러 합성. 눈은 최대 1,800개이며 오래된 눈은 천천히 녹습니다.
- `scripts/prepare-mediapipe.mjs`: 고정 버전 `@mediapipe/tasks-vision@1.2.3` SDK와 WASM, Google의 Hand Landmarker v1·Face Landmarker v1·Selfie Segmenter v1 모델을 준비합니다. 최초 준비에는 인터넷이 필요합니다. 실행 시 모델은 사이트 자체에서 불러옵니다.

Google Fonts를 사용할 수 없으면 시스템 글꼴로 표시됩니다. 최신 Chrome 또는 Safari를 권장합니다.

## 검사

```sh
npm test
npm run build
```

자동 검사 11개는 눈의 충돌·다층 적층·지지 소실·경사면 미끄러짐·빠른 입자의 관통 방지, HumanSeg 거리장과 거울 좌표, 입김 생성·연속 경로 지우기·증발, 입 벌림의 히스테리시스와 기존 WaterTouch 좌표 변환을 확인합니다.

개발 서버의 `/scripts/snow-browser-qa.html`은 Google 공식 손/얼굴 샘플을 입력해 실제 3종 모델 로딩·양손·얼굴·사람 마스크와 마스크 표면의 눈 적층·입김 합성을 확인할 수 있는 수동 검사 화면입니다. 입 벌림 단계는 검출된 입 위치에 합성한 열린 입 신호를 사용하므로, 실제 사용자의 입 벌림 정확도를 대신하지 않습니다. 실제 카메라의 검지·몸·얼굴 인식 상태와 눈의 적층 카운트는 실행 중인 UI에서도 확인했습니다.

WaterTouch 설명은 [docs/watertouch.md](docs/watertouch.md), 기존 인형뽑기는 [docs/toy-club.md](docs/toy-club.md)에 보관했습니다.

참고: [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [Image Segmenter](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter/web_js), [Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js).
