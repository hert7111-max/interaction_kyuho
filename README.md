# particle · Interaction Archive

부드러운 흑백 카메라 화면에서 엄지와 검지를 모아 집고 끌면, 잡은 부분이 고무처럼 쭉 늘어납니다. 잡고 있는 동안 늘어난 형태가 유지되고, 손가락을 벌려 놓으면 약 16초에 걸쳐 서서히 원래 화면으로 돌아옵니다. 두 손으로 각각 다른 부분을 당길 수도 있습니다.

카메라 아이콘으로 시작합니다. MediaPipe로 양손을 추적하며, 손바닥 크기에 비례한 엄지–검지 간격과 히스테리시스로 집기/놓기를 구분합니다. 얼굴이 보이지 않아도 화면 어디서나 잡을 수 있습니다. 카메라 영상과 추적은 기기 안에서 처리하고, 화면에는 아카이브 메뉴·조작 아이콘·집은 위치의 작은 링만 표시합니다.

## 예제 보관

- 기본 화면 / `/?example=particle`: particle
- `/?example=papa`: [파파괴](docs/papa.md)
- `/?example=snow`: [Snow](docs/snow.md)
- `/?example=watertouch`: [WaterTouch](docs/watertouch.md)
- `/?example=7`: 콜라텍

기존 예제의 효과와 추적 코드는 보존했습니다.

## particle 구현과 검증

- 데이터모쉬·컬러 오류·코드 효과를 고무 변형으로 교체했습니다. 192×192 격자에 원본 영상 좌표를 저장하고 작은 드래그를 연속적으로 누적해, 집은 재질이 손가락을 따라 이동하면서 주변이 부드럽게 늘어납니다. 이미 늘어난 부분도 다시 잡을 수 있습니다.
- 열린 손은 변형을 만들지 않습니다. 손을 놓거나 추적을 잃으면 잡기를 해제하고, 모든 손이 놓인 시점부터 약 16초의 완만한 곡선으로 복원합니다. 좌표가 크게 튀면 순간 이동 대신 놓기 처리합니다.
- 좌표를 RGBA8 텍스처의 두 16비트 값으로 저장해 부동소수점 텍스처 확장 없이 사용합니다. 기본 흑백 대비 1.08과 현재 카메라 영상을 유지하며, 한 번의 GPU 패스로 렌더링합니다. 이전 피드백 버퍼와 코드 아틀라스는 제거했습니다.
- 배열·텍스처 재사용, 최대 60Hz·DPR 1.5 제한, 손 모델만 불러오기, 추론 빈도 조절, GPU/CPU·Worker/DOM·ImageBitmap/ImageData 대체 경로, 숨김 시 정지, 무손실 Brotli/gzip 압축과 지연 로딩을 유지합니다.

```sh
npm test
npm run build
```

자동 검사 34개는 집기 히스테리시스, 열린 손 무반응, 잡은 픽셀 이동, 주변의 연속성과 뒤집힘 방지, 유지·16초 복원, 양손 잡기와 재잡기, 추적 끊김·좌표 튐·초기화, 세로 화면·16비트 좌표 정확도와 기존 예제를 확인합니다. `/scripts/particle-browser-qa.html`은 공식 Google 이미지로 실제 MediaPipe와 GPU 변형·집기/놓기·느린 복원·원본 복귀를 확인하는 개발용 페이지이며 배포하지 않습니다.

카메라에는 HTTPS와 권한이, 렌더링에는 WebGL2가 필요합니다. 실제 카메라의 시각 검증과 발열, 개별 OS/인앱 브라우저 동작은 해당 기기에서 확인해야 합니다.

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
