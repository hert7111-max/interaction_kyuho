# particle · Interaction Archive

부드러운 흑백 카메라 화면에서 손끝이 얼굴과 겹치는 좁은 부분에만 컬러 데이터모쉬가 생깁니다. 손끝을 움직이면 지나간 자리에 블록 깨짐·RGB 어긋남·지지직거리는 잔상이 남고, 손끝을 떼면 약 1.2초 안에 원본 흑백 영상으로 복원됩니다. 참고 이미지의 마젠타·시안·노랑·보라·버건디·그린을 사용합니다.

카메라 아이콘으로 시작합니다. MediaPipe가 양손의 열 손가락 끝과 얼굴 윤곽을 인식합니다. 손바닥이나 손가락 방향 레이 대신 손끝 좌표와 마지막 손가락 마디의 길이로 작은 접촉 영역을 계산합니다. 정지한 손끝에도 해당 위치만 반응합니다. 카메라 영상과 추적은 기기 안에서 처리하며 화면에는 상단 아카이브와 조작 아이콘만 표시합니다.

## 예제 보관

- 기본 화면 / `/?example=particle`: particle
- `/?example=papa`: [파파괴](docs/papa.md)
- `/?example=snow`: [Snow](docs/snow.md)
- `/?example=watertouch`: [WaterTouch](docs/watertouch.md)
- `/?example=7`: 콜라텍

기존 예제의 효과와 추적 코드는 보존했습니다.

## particle 구현과 검증

- 이전 얼굴 전체 분산/파티클 처리를 교체했습니다. 얼굴의 실제 윤곽 안에서 손끝 크기의 쓸고 지나간 영역만 활성화하는 128×160 접촉 필드를 사용합니다. 각 흔적은 독립적으로 복원됩니다. 손을 다시 인식하거나 좌표가 크게 튀면 중간에 긴 선을 연결하지 않습니다.
- 원본 흑백 대비는 기존 2.25에서 1.08로 낮췄습니다. GPU의 출력 마스크가 접촉 필드 밖의 컬러·변위·피드백을 차단하므로 얼굴 전체나 배경으로 오류가 번지지 않습니다. 마우스/터치 조작도 제거해 카메라의 손끝만 반응합니다.
- 평상시는 한 번의 흑백 변환, 접촉 중에는 해상도를 제한한 두 피드백 버퍼로 렌더링합니다. 접촉 필드 배열과 텍스처를 재사용하고 최대 60Hz·DPR 1.5 제한, 숨김 시 카메라·추론·렌더링 정지를 유지합니다. 기존 무손실 Brotli/gzip 압축과 지연 로딩도 유지합니다.
- 추론은 한 프레임씩 보내며 처리 시간에 따라 빈도를 조절합니다. GPU/CPU, Worker/DOM, ImageBitmap/ImageData 대체 경로를 유지합니다.

```sh
npm test
npm run build
```

자동 검사 32개는 손끝 접촉의 좁은 범위, 얼굴 윤곽 밖의 오인식 차단, 이동 경로와 좌표 튐 처리, 흔적별 자동 복원, 열 손가락과 버퍼 재사용 및 기존 예제를 검증합니다. `/scripts/particle-browser-qa.html`은 Google의 공식 손/얼굴 샘플로 실제 MediaPipe 인식, GPU 컬러 출력의 국소 범위, 접촉하지 않은 픽셀의 원본 유지와 자동 복원을 확인하는 개발용 페이지입니다. 배포에는 포함하지 않습니다. 이번 작업에서는 브라우저 연결 제한으로 실제 화면 검증을 완료하지 못했습니다.

화면에서 손끝과 얼굴 윤곽의 2D 겹침을 접촉으로 사용합니다. 실제 피부에 닿았는지의 깊이 측정은 수행하지 않습니다. 카메라에는 HTTPS와 권한이, 렌더링에는 WebGL2가 필요합니다. 실제 발열과 개별 OS/인앱 브라우저의 동작은 해당 기기에서 확인해야 합니다.

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

콘솔에는 다음 형식으로 주소가 표시됩니다. 현재 PC의 공유 주소는 `https://172.30.1.83:5173`입니다.

```text
Local:   https://127.0.0.1:5173
Network: https://172.30.1.83:5173
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
