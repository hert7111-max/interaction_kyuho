import { CONFIG } from '../config.js'

export function openCamera() {
  if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('카메라를 사용하려면 HTTPS 또는 localhost에서 열어주세요.')
  }
  const { width, height, frameRate } = CONFIG.camera
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'user', width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: frameRate } },
  })
}

export function closeCamera(stream) {
  stream?.getTracks().forEach(track => track.stop())
}
