/* global Vision */
// Classic worker: MediaPipe loads its WASM runtime with importScripts.
let tracker = null
self.onmessage = async (event) => {
  const message = event.data
  if (message.type === 'init') {
    try {
      importScripts(`${message.base}mediapipe/vision_bundle.js`)
      const { FilesetResolver, HandLandmarker } = Vision
      const vision = await FilesetResolver.forVisionTasks(`${message.base}mediapipe/wasm`)
      const options = { runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: .5, minHandPresenceConfidence: .5, minTrackingConfidence: .5 }
      try {
        tracker = await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: `${message.base}mediapipe/hand_landmarker.task`, delegate: 'GPU' } })
      } catch {
        tracker = await HandLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: `${message.base}mediapipe/hand_landmarker.task`, delegate: 'CPU' } })
      }
      self.postMessage({ type: 'ready' })
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }) }
  }
  if (message.type === 'frame') {
    try {
      if (!tracker) throw new Error('Hand tracker is not initialized')
      const result = tracker.detectForVideo(message.bitmap, message.timestamp)
      self.postMessage({ type: 'hands', landmarks: result.landmarks, handedness: result.handedness, timestamp: message.timestamp, generation: message.generation })
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }) }
    finally { message.bitmap.close() }
  }
}
