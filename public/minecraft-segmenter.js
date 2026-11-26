/* global Vision */
// Shared by the classic worker and browsers that cannot initialize MediaPipe in a worker.
globalThis.MineSegmenter = class {
  task = null
  useCPU = false
  closed = false

  async init(base, useCPU = false, files) {
    files ??= await Vision.FilesetResolver.forVisionTasks(base + 'mediapipe/wasm')
    const create = delegate => Vision.ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: base + 'mediapipe/selfie_segmenter.tflite', delegate },
      runningMode: 'VIDEO',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    })
    let task
    if (!useCPU) {
      try { task = await create('GPU') }
      catch { /* Retry on the CPU when the worker's GPU delegate is unavailable. */ }
    }
    this.useCPU = !task
    task ??= await create('CPU')
    if (this.closed) task.close()
    else this.task = task
  }

  detect(source, timestamp) {
    let output
    this.task.segmentForVideo(source, timestamp, result => {
      const mask = result.confidenceMasks[0]
      const confidence = mask.getAsFloat32Array()
      const pixels = new Uint8Array(confidence.length)
      for (let index = 0; index < pixels.length; index++) {
        pixels[index] = Math.round(confidence[index] * 255)
      }
      output = { pixels, width: mask.width, height: mask.height, timestamp }
    })
    return output
  }

  close() {
    this.closed = true
    this.task?.close()
    this.task = null
  }
}
