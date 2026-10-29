# City in Pieces · Photo Edition

실제 뉴욕 파노라마 사진을 화면 전체에 표시합니다. 화면에 텍스트·버튼·안내 문구를 표시하지 않습니다.

- 클릭·터치한 건물만 변합니다. 전경 건물은 사진 윤곽에 맞춘 다각형으로 선택하고, 먼 도시 구역도 선택할 수 있습니다.
- 선택한 건물은 다양한 가로·세로 크기의 조각으로 나뉘어 밝은 블루·시안·그린·민트·화이트 단색 블록이 됩니다.
- 변환한 건물은 원래 모습으로 돌아가지 않습니다. 로컬 저장소에 상태와 난수 시드를 기록해 새로고침 후에도 같은 색과 형태를 유지합니다.
- 화면 안의 모든 선택 가능한 건물을 변환하면 하늘을 포함한 화면 전체가 불규칙한 컬러 블록으로 채워집니다. 완성 상태도 저장됩니다.
- 모바일·화면 크기 변경·동작 줄이기 설정·키보드 조작을 지원합니다. 방향키로 건물을 고르고 Enter·Space로 변환합니다.

## 사진 출처

Adil Edin, “a view of a city from the top of a building”, New York City, 2022.
원본: https://unsplash.com/photos/a-view-of-a-city-from-the-top-of-a-building-lxOTJo7ybrw
라이선스: https://unsplash.com/license
프로젝트 자산: `public/images/new-york-panorama.jpg`.
원본 사진을 로컬 자산으로 제공하며, 건물 선택과 분리·변환은 Canvas에서 처리합니다. 사진 속 간판이 포함되지 않도록 오른쪽 일부를 화면 영역에서 제외했습니다.

## 실행 및 검사

```sh
npm install
npm run dev
npm test
npm run build
```

Node.js 24 이상. 검사는 클릭한 대상만 변하는지, 중복 클릭·하늘 클릭 무시, 불규칙한 조각 크기, 영구 변환, 저장 복원, 최종 화면 전체 덮기, 터치·키보드·반응형 동작을 확인합니다.

`src/main.ts`는 사진 좌표의 건물 마스크와 렌더링·입력·저장을 담당합니다. `.openai/hosting.json`은 기존 사이트 식별자를 유지합니다. `templates/`는 보관용입니다.
