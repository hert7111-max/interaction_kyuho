/* global Vision */
let task, canvas, context, mode

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      importScripts(data.sdk)
      const files = await Vision.FilesetResolver.forVisionTasks(data.wasm)
      mode = data.mode
      const Task = mode === 'gesture' ? Vision.GestureRecognizer : Vision.PoseLandmarker
      task = await Task.createFromOptions(files, {
        ...data.options, baseOptions: { modelAssetPath: data.model, delegate: 'CPU' },
      })
      self.postMessage({ type: 'ready', connections: mode === 'gesture' ? [] : Task.POSE_CONNECTIONS })
    } catch (error) { self.postMessage({ type: 'error', message: String(error) }) }
    return
  }

  const { bitmap, w, h, pixels, timestamp } = data
  try {
    let source = bitmap
    if (!source) {
      canvas ??= new OffscreenCanvas(w, h)
      context ??= canvas.getContext('2d')
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
      context.putImageData(new ImageData(pixels, w, h), 0, 0)
      source = canvas
    }
    if (mode === 'gesture') {
      const result = task.recognizeForVideo(source, timestamp)
      self.postMessage({
        type: 'frame', timestamp, landmarks: result.landmarks[0] ?? null,
        category: result.gestures[0]?.[0] ?? null,
        handId: (result.handedness ?? result.handednesses)?.[0]?.[0]?.categoryName,
      })
      return
    }
    task.detectForVideo(source, timestamp, result => {
      const part = result.segmentationMasks?.[0]
      const landmarks = result.landmarks[0] ?? null
      const mask = part ? {
        pixels: Uint8Array.from(part.getAsFloat32Array(), value => Math.round(value * 255)),
        width: part.width, height: part.height,
      } : null
      const transfer = []
      if (bitmap) transfer.push(bitmap)
      if (mask) transfer.push(mask.pixels.buffer)
      self.postMessage({ type: 'frame', timestamp, landmarks, mask, bitmap }, transfer)
    })
  } catch (error) {
    bitmap?.close()
    self.postMessage({ type: 'error', message: String(error) })
  } finally { if (mode === 'gesture') bitmap?.close() }
}
