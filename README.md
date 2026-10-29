# interaction_kyuho

밤하늘에 손끝으로 불꽃을 그리는 인터랙티브 캔버스입니다.
Vite와 TypeScript, Canvas 2D로 구현했으며 별도의 UI 프레임워크를 사용하지 않습니다.

- 클릭·터치: 선택한 위치에 무작위 색상과 모양의 폭죽이 터집니다.
- 길게 누르기: 약 2.2초까지 충전되며 폭죽의 크기가 커집니다.
- 누른 채로 드래그 후 놓기: 그린 경로를 따라 폭죽이 순서대로 터집니다.
- 키보드: 캔버스에 Tab으로 이동 후 방향키로 위치를 옮기고 Space를 눌렀다 놓습니다.

하트, 별, 원형, 이중 링 등 여섯 가지 형태와 여섯 가지 색상을 사용합니다.
터치 취소, 다중 터치, 화면 크기 변경을 처리하고 동작 줄이기 설정을 반영합니다.

## 프로젝트 구조

```text
src/              TypeScript, CSS, 이미지 소스
public/           그대로 제공되는 정적 파일
templates/        향후 사용할 템플릿 보관 폴더
index.html        웹 진입점
package.json      의존성과 npm 스크립트
package-lock.json 의존성 버전 고정
tsconfig.json     TypeScript 설정
```

`templates/`는 보관용 폴더이며 자동으로 빌드되거나 배포되지 않습니다.

## 실행 방법

Node.js 24 LTS와 npm 환경에서 실행합니다.

```sh
npm install
npm run dev
```

빌드 및 빌드 결과 미리보기:

```sh
npm run build
npm run preview
```

입력 동작 자동 검사는 `npm test`로 실행합니다(Node.js 24 이상).
실제 입력 핸들러에 클릭·길게 누르기·드래그·다중 터치·키보드 이벤트를 전달해 확인합니다.

`npm run build`는 TypeScript 검사 후 `dist/`에 배포 파일을 생성합니다.

이 컴퓨터에는 Node.js를 `~/.local/share/node-v24.22.2-darwin-arm64`에 설치했고,
`~/.local/bin`을 `~/.zprofile`의 PATH에 추가했습니다.
기존 터미널에서 npm을 찾지 못하면 새 터미널을 열거나 `source ~/.zprofile`을 실행하세요.
