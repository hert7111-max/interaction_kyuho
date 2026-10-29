# VIBE CODING WORKSHOP

크림색 바탕과 선명한 주황빛 빨강, 두꺼운 타이포그래피로 만든 고양이 이모티콘 놀이터입니다.
Vite와 TypeScript, Canvas 2D로 구현했으며 별도의 UI 프레임워크를 사용하지 않습니다.

- 클릭·터치: 선택한 위치에서 여러 표정의 고양이 이모티콘이 튀어나옵니다.
- 길게 누르기: 약 2.2초까지 충전되며 고양이의 크기와 퍼지는 범위, 수가 늘어납니다.
- 드래그 후 놓기: 그린 경로를 따라 고양이가 순서대로 터집니다.
- 키보드: 캔버스에 Tab으로 이동한 다음 방향키로 위치를 옮기고 Space를 눌렀다 놓습니다.

다중 터치, 터치 취소, 화면 크기 변경과 동작 줄이기 설정을 지원합니다.
고양이 이모티콘의 세부 모양은 기기의 기본 이모티콘 글꼴에 따라 달라집니다.
제목 글꼴은 SIL Open Font License의 Dela Gothic One을 로컬 파일로 제공합니다.

## 실행 및 검사

Node.js 24 이상과 npm을 사용합니다.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

`npm test`는 실제 입력 핸들러에 클릭·길게 누르기·드래그·다중 터치·키보드 이벤트를 전달해 확인합니다.
`npm run build`는 TypeScript 검사 후 `dist/`에 배포 파일을 생성합니다.

## 구조

- `src/main.ts`: 화면과 입력 처리, 고양이 애니메이션
- `src/style.css`: 포스터 레이아웃과 반응형 스타일
- `public/fonts/`: 제목 글꼴과 라이선스
- `scripts/check-interactions.mjs`: 입력 동작 검사
- `.openai/hosting.json`: 기존 Sites 프로젝트 및 배포 설정

`templates/`는 보관용 폴더이며 자동으로 빌드되거나 배포되지 않습니다.
