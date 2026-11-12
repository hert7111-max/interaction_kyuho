# 파파괴

카메라 영상 위로 픽셀 인간 캐릭터가 기어오릅니다. 양손의 검지를 뻗어 캐릭터를 가리키면 손끝에서 무지개 레이저가 발사됩니다. 캐릭터는 감전되어 떨고 연기를 내다가 중력으로 화면 바닥에 떨어지며, 바닥에 닿을 때 짧은 픽셀 피 효과와 함께 사라집니다. 레이저를 발사하는 동안 실제 얼굴의 양쪽 눈 전체가 빛납니다.

메뉴 외에 제목·설명·안내 문구를 표시하지 않습니다. 시작과 조작은 아이콘 버튼을 사용하며 접근성 이름을 제공합니다. 오류가 있을 때만 필요한 메시지를 표시합니다.

```sh
npm install
npm run dev
```

`http://localhost:5173`을 열고 카메라 아이콘을 누른 뒤 권한을 허용하세요. 카메라는 HTTPS 또는 localhost에서 동작하며 영상은 브라우저 안에서만 처리됩니다. 재생 아이콘은 카메라 없는 마우스·터치 체험입니다. 화면을 누른 채 원하는 캐릭터를 조준합니다.

## 보관된 예제

- 기본 화면과 `/?example=papa`: 파파괴
- `/?example=snow`: Snow — 기존 코드 유지, 설명은 [docs/snow.md](docs/snow.md)
- `/?example=watertouch`: WaterTouch — 기존 코드 유지, 설명은 [docs/watertouch.md](docs/watertouch.md)
- `/?example=7`: 콜라텍

상단 메뉴에서 파파괴·Snow·WaterTouch를 전환할 수 있습니다. 이동할 때 카메라 트랙과 인식 워커를 종료합니다.

## 구현

- `src/papa.ts`: 카메라 생명주기·두 손의 검지 조준·눈 좌표 변환·아이콘 조작
- `public/papa-tracker.js`: MediaPipe Hand Landmarker와 Face Landmarker. 별도 워커에서 최대 2손과 1얼굴을 인식하며 GPU 실패 시 CPU로 대체합니다. 얼굴의 눈 테두리는 공식 `FACE_LANDMARKS_LEFT_EYE`, `FACE_LANDMARKS_RIGHT_EYE` 연결에서 추출합니다.
- `src/papa-game.ts`: 손가락 관절의 3D 펴짐 판정, 손끝/손가락 방향의 조준과 가까운 대상 보정, 등반 → 감전 → 낙하 → 충돌 → 소멸 상태 전환. 120Hz 적분·중력·회전된 캐릭터의 바닥 충돌, 연기·스파크·픽셀 혈흔 수명 관리. 실제 사람을 식별하거나 레이저 대상으로 삼지 않으며 화면에 합성한 게임 캐릭터만 충돌 판정합니다.
- `src/papa-sprites.ts`: 피부색·헤어스타일·성별 표현·의상이 다른 성인 체형의 캐릭터 14종. 프레임별 팔·무릎·그립이 바뀌는 픽셀 등반 애니메이션. 외부 이미지 다운로드 없이 Canvas로 생성합니다.
- `src/papa-renderer.ts`: 빨주노초파남보 7가닥 레이저·손끝 발광·감전 아크·만화 X-ray·연기·바닥의 픽셀 피 효과. 양 눈의 테두리를 따라 흰빛과 무지개 광륜을 합성하고 추적 위치를 부드럽게 보간합니다. 얼굴을 놓치면 오래된 눈 효과를 지웁니다.
- `src/main.ts`, `src/experiment-menu.css`: 새 예제 및 아카이브 메뉴

신체·충돌은 게임용 2D 물리 근사입니다. 실제 화면 하단을 바닥으로 사용하며, 캐릭터와 효과 수에 상한을 두었습니다. 프레임마다 화면 전체를 번쩍이는 효과는 사용하지 않습니다.

기존 고정 버전 `@mediapipe/tasks-vision@1.2.3`, Hand/Face Landmarker v1 모델을 재사용합니다. `scripts/prepare-mediapipe.mjs`가 개발·빌드 전에 SDK·WASM·모델을 준비하며 배포물에 포함합니다.

## 검사

```sh
npm test
npm run build
```

총 18개 자동 검사는 캐릭터 다양성·상향 등반·조준 대상 선택·검지 펴짐·양손 동시 발사·감전 재진입 차단·연기/스파크·중력 낙하·바닥 충돌 1회 처리·픽셀 피 발생·자연 소멸·입력 소실 시 발사 중단·개체 수 제한과 기존 Snow/WaterTouch 동작을 확인합니다. 브라우저에서는 아카이브 메뉴 전환, 텍스트 없는 게임 화면, 픽셀 캐릭터 렌더링과 카메라 시작 상태를 확인했습니다. 실제 사용자 손·얼굴 추적 품질은 조명과 가림의 영향을 받습니다.

참고: [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js), [Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js).
