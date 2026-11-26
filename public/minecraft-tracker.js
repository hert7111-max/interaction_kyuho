/* global MineSegmenter, InvisibleRuntime */
let segmenter, frameCanvas, frameContext

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      importScripts(data.base + 'mediapipe/vision_bundle.js', data.base + 'minecraft-segmenter.js')
      if (data.pose) importScripts(data.base + 'invisible-runtime.js')
      segmenter = data.pose ? new InvisibleRuntime() : new MineSegmenter()
      await segmenter.init(data.base)
      self.postMessage({ type: 'ready', cpu: segmenter.useCPU })
      return
    }

    let source = data.bitmap
    if (!source) {
      frameCanvas ??= new OffscreenCanvas(data.width, data.height)
      frameContext ??= frameCanvas.getContext('2d')
      if (frameCanvas.width !== data.width) frameCanvas.width = data.width
      if (frameCanvas.height !== data.height) frameCanvas.height = data.height
      frameContext.putImageData(new ImageData(data.pixels, data.width, data.height), 0, 0)
      source = frameCanvas
    }
    const start = performance.now()
    const mask = segmenter.detect(source, data.timestamp)
    self.postMessage({
      type: 'mask', ...mask, generation: data.generation, duration: performance.now() - start,
    }, [mask.pixels.buffer])
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error) })
  } finally {
    data.bitmap?.close()
  }
}
