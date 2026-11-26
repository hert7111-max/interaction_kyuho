/* global Vision, MineSegmenter */
// The selfie mask covers partly framed bodies. The pose masks add separately detected people.
globalThis.InvisibleRuntime = class {
  person = null
  pose = null
  closed = false
  useCPU = true

  async init(base) {
    const files = await Vision.FilesetResolver.forVisionTasks(base + 'mediapipe/wasm')
    if (this.closed) return
    const person = new MineSegmenter()
    this.person = person
    await person.init(base, true, files)
    if (this.closed) return
    // Pixel masks are read on every inference, so use the CPU to avoid GPU readback stalls.
    const pose = await Vision.PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: base + 'mediapipe/pose_landmarker_lite.task', delegate: 'CPU' },
      runningMode: 'VIDEO',
      numPoses: 4,
      outputSegmentationMasks: true,
    })
    if (this.closed) pose.close()
    else this.pose = pose
  }

  detect(source, timestamp) {
    const mask = this.person.detect(source, timestamp)
    let poses = []
    this.pose.detectForVideo(source, timestamp, result => {
      poses = result.landmarks
      for (const body of result.segmentationMasks ?? []) {
        const confidence = body.getAsFloat32Array()
        for (let y = 0; y < mask.height; y++) {
          const row = y * mask.width
          const sourceRow = Math.floor((y + .5) * body.height / mask.height) * body.width
          for (let x = 0; x < mask.width; x++) {
            const index = row + x
            const sourceIndex = sourceRow + Math.floor((x + .5) * body.width / mask.width)
            const value = Math.round(confidence[sourceIndex] * 255)
            if (value > mask.pixels[index]) mask.pixels[index] = value
          }
        }
      }
    })
    return { ...mask, poses }
  }

  close() {
    this.closed = true
    this.person?.close()
    this.pose?.close()
    this.person = this.pose = null
  }
}
