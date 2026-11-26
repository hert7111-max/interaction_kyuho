# CRT Arcade · Interaction Archive

2000년대 초 게임방의 CRT 모니터를 바라보는 1인칭 카메라 게임입니다. 로우폴리 손과 유선 컨트롤러가 손가락 움직임에 반응하고, 모니터 속에서 손가락 총으로 연사하면 전투기를 격추하며 눈이 번쩍입니다. 8종 픽셀 전투기와 VHS 화면 효과를 적용했습니다. 엄지와 손바닥이 끊김 없이 이어지는 피부 메쉬로 회색 컨트롤러를 감싸며, 선은 모니터 단자까지 이어집니다. 목재 책상·카펫·커튼·소품과 조명·그림자를 더해 입체감을 보강했습니다.

카메라 아이콘으로 시작합니다. 엄지를 세우고 검지를 뻗은 뒤 나머지 손가락을 접으면 총 자세가 됩니다. Easy 설정으로 전투기 피격 피해를 줄였고, HP 0에서는 얼굴이 폭발한 뒤 불꽃·연기와 파손 흔적이 남습니다. 얼굴을 화면 밖으로 빼면 빠르게 충전되며, 격추하면 픽셀 콤보가 쌓입니다. [구현과 검증](docs/arcade.md)

프로젝트 구조: [구성 지도](docs/project-map.md)

## 예제 보관

- `/?example=face-reaction`: 페이스 리액션 · 허공 주먹 동작에 반응하는 실시간 얼굴 효과

- `/?example=invisible`: 투명인간 · 머리 위 박수로 화면 속 사람을 배경에 합성

- `/?example=minecraft`: MineCraft · 카메라 위 3D 무기와 사람 윤곽을 이용한 타격 효과

- `/?example=rubber`: [고무 인간](docs/rubber.md)

- 기본 화면 / `/?example=arcade`: CRT Arcade
- `/?example=particle`: [particle · 고무 변형](docs/particle.md)
- `/?example=papa`: [파파괴](docs/papa.md)
- `/?example=snow`: [Snow](docs/snow.md)
- `/?example=watertouch`: [WaterTouch](docs/watertouch.md)
- `/?example=7`: 콜라텍

기존 예제의 효과와 추적 코드를 유지합니다. 테스트는 `npm test`, 프로덕션 빌드와 무손실 압축은 `npm run build`로 실행합니다. 개발 서버는 작업 중 실행하지 않았습니다.

## GitHub Pages 자동 배포

`.github/workflows/deploy-pages.yml`은 `main`에 push하거나 Actions에서 수동 실행하면 Node.js 24 → `npm ci` → 모델 준비·TypeScript 검사·Vite 빌드·압축 → 정적 경로 검사 → Pages 배포를 실행합니다. 저장소 전체가 아닌 `dist/`만 업로드하며 인증서·비밀키·로컬 서버는 배포하지 않습니다. 별도 PAT나 Secrets 등록은 필요하지 않습니다.

GitHub에서 최초 1회 설정합니다.

1. [저장소 Settings → Pages](https://github.com/hert7111-max/interaction_kyuho/settings/pages) → **Build and deployment → Source → GitHub Actions**를 선택합니다.
2. 변경 파일을 커밋하고 `main`에 push합니다. 이미 push한 뒤 Pages를 설정했다면 **Actions → Deploy to GitHub Pages → Run workflow → main**으로 실행합니다.
3. Actions의 `build`, `deploy` 성공 후 배포 주소를 엽니다. 현재 저장소 기준 예상 주소는 `https://hert7111-max.github.io/interaction_kyuho/`입니다. 카메라 권한을 허용하고, 인앱 브라우저에서 카메라가 차단되면 같은 주소를 일반 브라우저로 엽니다.

저장소에서 Actions 사용이 허용돼 있어야 합니다. Pages 메뉴가 없다면 저장소 공개 여부와 계정 플랜의 Pages 지원을 확인하세요. 기존 `github-pages` 환경에 승인·브랜치 보호 규칙이 있으면 그 규칙에 따라 승인하고 `main` 배포를 허용합니다. 기본 배포 브랜치를 바꿀 경우 workflow의 `push.branches`와 `deploy.if`를 함께 수정합니다.

빌드의 `VITE_BASE_PATH`는 Pages 액션의 `base_path` 출력에서 자동으로 정합니다. 프로젝트 사이트는 `/interaction_kyuho/`, 사용자 사이트나 루트 커스텀 도메인은 `/`를 사용합니다. 로컬 개발과 일반 `npm run build`는 기존 `/`를 유지합니다. 아이콘·스크립트·모델·Worker와 쿼리 기반 예제 메뉴가 이 기본 경로를 따릅니다. 예제 직접 주소는 `https://hert7111-max.github.io/interaction_kyuho/?example=snow`처럼 저장소 경로를 포함합니다.

로컬에서 Pages와 같은 경로로 빌드·검사할 때(macOS/Linux):

```sh
VITE_BASE_PATH=/interaction_kyuho/ npm run build
VITE_BASE_PATH=/interaction_kyuho/ npm run check:pages
```

이후 기존 로컬 프로덕션 서버를 사용하려면 `npm run build`로 `/` 경로 빌드를 다시 생성합니다. GitHub Actions는 자체 환경에서 Pages 빌드를 새로 생성하므로 로컬 `dist/`나 `public/mediapipe/`를 Git에 추가할 필요가 없습니다. `prebuild`가 SDK·WASM을 복사하고 필요한 모델을 내려받습니다. CI 빌드에는 mkcert나 로컬 TLS 인증서가 필요하지 않습니다.

카메라 예제는 정적 배포 대상입니다. 보관된 **콜라텍(`?example=7`)의 실시간 멀티플레이·`/api/info`·`/party` WebSocket은 별도 Node 서버가 필요**하며 GitHub Pages에서는 제공되지 않습니다. 기존 `npm run dev`·`npm start` 서버 기능은 유지합니다.

참고: [Vite의 GitHub Pages 배포 안내](https://vite.dev/guide/static-deploy.html#github-pages), [GitHub Pages의 Actions 배포 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## 로컬 네트워크 HTTPS 개발

개발 서버는 `0.0.0.0`에 바인딩되며 HTTPS와 HMR의 WSS를 함께 사용합니다. 기존 `/party` WebSocket, API, 카메라, 모델 로딩과 예제 메뉴를 유지합니다. `npm start`와 `npm run preview`의 기존 HTTP 프로덕션 서버 동작은 바꾸지 않았습니다.

최초 1회, **이 프로젝트 폴더의 터미널에서** 개발 CA를 신뢰하도록 설치하세요. macOS에서는 관리자 암호 입력이 필요합니다.

```sh
npm run trust:https
```

그다음 사용자가 직접 실행합니다.

```sh
npm run dev
```

콘솔에는 다음 형식으로 주소가 표시됩니다. 공유 주소는 실행 시 출력되는 **Network** 항목을 확인하세요. 아래 IP는 형식 예시입니다.

```text
Local:   https://127.0.0.1:5173
Network: https://192.168.0.10:5173
```

같은 네트워크의 다른 PC에는 **Network 주소**를 공유합니다. `localhost`나 `0.0.0.0`는 공유 주소로 사용하지 않습니다. 같은 Wi-Fi/LAN에 연결하고, 이 PC의 방화벽에서 Node/선택한 포트의 인바운드 연결을 허용해야 합니다. 게스트 Wi-Fi의 기기 간 통신 차단도 확인하세요. 포트를 바꾸면 출력되는 Network 주소의 포트도 바뀝니다.

```sh
PORT=5174 npm run dev
```

Windows PowerShell에서는 `$env:PORT=5174; npm run dev`를 사용합니다. 이미 이전 HTTP 개발 서버가 실행 중이면 종료한 뒤 새 명령으로 시작하세요.

### 인증서 생성과 보관

`predev`는 기존 MediaPipe 준비를 유지하면서 `scripts/setup-https.mjs`도 실행합니다. mkcert가 PATH에 없으면 공식 v1.4.4 배포본을 `.dev-tools/`에 준비합니다. 시스템에 설치한 mkcert를 우선 사용하며 `MKCERT_BIN`으로 경로를 지정할 수도 있습니다.

- `.certs/dev-cert.pem`: localhost, 두 루프백 IP, 현재 PC의 모든 LAN IPv4가 포함된 서버 인증서
- `.certs/dev-key.pem`: 서버 비밀키, macOS/Linux에서 권한 600
- `.certs/ca/`: 이 프로젝트 전용 mkcert CA와 CA 비밀키
- `.certs/share/rootCA.pem`: 접속 PC에 전달할 **공개 루트 CA 인증서만** 복사한 파일

`.certs/`와 `.dev-tools/`는 Git에서 제외되며 `public/` 또는 `dist/`에 포함하지 않습니다. Vite 파일 접근 거부 설정과 서버의 요청 차단을 모두 적용했습니다. CA/서버 비밀키를 공유하지 마세요. 특히 `rootCA-key.pem`은 전달하지 않습니다.

IP가 바뀌거나 인증서 갱신이 필요하면 `npm run dev`의 준비 단계가 새 SAN 인증서를 만듭니다. 수동 준비/강제 재발급은 다음과 같습니다. 이 명령들은 서버를 실행하지 않습니다.

```sh
npm run setup:https
npm run setup:https -- --force
```

### 다른 PC의 인증서 경고와 카메라 차단

1. 이 PC의 `.certs/share/rootCA.pem` **파일 하나만** 신뢰할 수 있는 경로로 전달하세요. 접속 PC의 신뢰된 루트 인증 기관에 등록한 뒤 브라우저를 다시 여세요. 서버에서 생성한 것과 다른 CA를 접속 PC에서 새로 만드는 것으로는 해결되지 않습니다.
2. Windows는 해당 PC에서 `certutil -user -addstore Root rootCA.pem`으로 현재 사용자 신뢰 저장소에 등록할 수 있습니다. macOS는 키체인 접근에서 가져온 CA를 신뢰하도록 설정합니다. Firefox에서 계속 경고하면 설정의 인증서 관리 → 인증 기관에 가져오고 웹사이트 식별을 신뢰하도록 선택하세요.
3. 인증서 경고를 무시하고 접속하기보다 CA 신뢰를 먼저 해결하세요. HTTPS로 접속한 상태에서 사이트의 카메라 권한과 OS의 브라우저 카메라 권한을 허용합니다.
4. 사내 정책이나 인앱 브라우저가 사용자 CA 또는 카메라를 차단하면 일반 Chrome/Edge/Safari에서 같은 HTTPS 주소를 여세요. 신뢰 등록 후에도 정책 차단을 우회하지는 않습니다.

설정 작업 중 개발 서버를 실행하지 않았습니다. 검사에서는 SAN·현재 IP·만료일·인증서/키 일치·CA 서명·TLS 컨텍스트와 Git 제외를 확인하며, 서버 리슨/브라우저 연결 검사는 사용자가 서버를 실행한 뒤 가능합니다.

참고: [mkcert 공식 안내](https://github.com/FiloSottile/mkcert#readme), [Vite HTTPS/HMR](https://vite.dev/config/server-options).
