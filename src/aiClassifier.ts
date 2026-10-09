/**
 * Pretrained AI-Image Classifier Signal (Phase 4)
 * Model: Organika/sdxl-detector (Swin Transformer fine-tuned on generative images)
 * 
 * Rules:
 * - Lazy-load and cache the model, with a loading state in the UI
 * - Returns { aiProbability: number | null, modelName }
 * - Never throws into the UI (try/catch returns null)
 * - Averages full image plus 3-5 random crops
 */

export interface ClassifierResult {
  aiProbability: number | null
  modelName: string
}

export const CLASSIFIER_MODEL_NAME = 'Organika/sdxl-detector'

let isModelLoading = false
const loadingListeners = new Set<(loading: boolean) => void>()

export function isClassifierLoading(): boolean {
  return isModelLoading
}

export function subscribeClassifierLoading(listener: (loading: boolean) => void): () => void {
  loadingListeners.add(listener)
  listener(isModelLoading)
  return () => loadingListeners.delete(listener)
}

function setModelLoading(loading: boolean) {
  isModelLoading = loading
  for (const listener of loadingListeners) {
    try {
      listener(loading)
    } catch {
      // Ignore listener errors
    }
  }
}

/**
 * Classifies an image using the pretrained neural classifier.
 * Never throws — always returns a safe object with null on any error or missing runtime.
 */
export async function classifyImageAi(
  imageSource: any,
  imagePath?: string
): Promise<ClassifierResult> {
  try {
    setModelLoading(true)

    // Check if running in Node.js environment (e.g. eval:compare or test harness)
    if (typeof window === 'undefined' || typeof process !== 'undefined' && process?.versions?.node) {
      if (imagePath) {
        try {
          const { spawnSync } = await import('node:child_process')
          const fs = await import('node:fs')
          const path = await import('node:path')
          let scriptPath = path.resolve(process.cwd(), 'scratch', 'classify_image.py')
          if (!fs.existsSync(scriptPath)) {
            scriptPath = path.resolve(process.cwd(), '..', 'scratch', 'classify_image.py')
          }
          const res = spawnSync('py', ['-3.13', scriptPath, imagePath], {
            encoding: 'utf-8',
            timeout: 15000,
          })
          if (res.stdout) {
            // Find last line which is JSON
            const lines = res.stdout.trim().split('\n')
            const lastLine = lines[lines.length - 1]
            const parsed = JSON.parse(lastLine)
            if (typeof parsed.aiProbability === 'number') {
              return {
                aiProbability: parsed.aiProbability,
                modelName: parsed.modelName || CLASSIFIER_MODEL_NAME,
              }
            }
          }
        } catch {
          // Node fallback failed gracefully
        }
      }
    }

    // In-browser client inference (using cached WebAssembly / ONNX / WebGL pipeline)
    if (typeof window !== 'undefined' && imageSource) {
      try {
        const prob = await runBrowserInference(imageSource)
        if (typeof prob === 'number') {
          return {
            aiProbability: prob,
            modelName: CLASSIFIER_MODEL_NAME,
          }
        }
      } catch (browserErr) {
        console.warn('In-browser ONNX inference fallback:', browserErr)
      }
    }

    return {
      aiProbability: null,
      modelName: CLASSIFIER_MODEL_NAME,
    }
  } catch {
    return {
      aiProbability: null,
      modelName: CLASSIFIER_MODEL_NAME,
    }
  } finally {
    setModelLoading(false)
  }
}

let cachedSession: any = null
let sessionPromise: Promise<any> | null = null

async function getBrowserSession(): Promise<any> {
  if (cachedSession) return cachedSession
  if (sessionPromise) return sessionPromise

  sessionPromise = (async () => {
    try {
      const ort = await import('onnxruntime-web')
      if (ort.env && ort.env.wasm) {
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/'
        ort.env.wasm.numThreads = 1
      }
      const session = await ort.InferenceSession.create('/models/ai_detector.onnx', {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      })
      cachedSession = session
      return session
    } catch (err) {
      console.warn('Failed to initialize in-browser ONNX session:', err)
      return null
    } finally {
      sessionPromise = null
    }
  })()

  return sessionPromise
}

function imageToFloat32Tensor(
  source: any,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  ort: any
): any {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 224
    canvas.height = 224
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, 224, 224)
    const imgData = ctx.getImageData(0, 0, 224, 224)
    const { data } = imgData

    const mean = [0.485, 0.456, 0.406]
    const std = [0.229, 0.224, 0.225]

    const floatData = new Float32Array(3 * 224 * 224)
    const planeSize = 224 * 224

    for (let i = 0; i < planeSize; i++) {
      const r = data[i * 4] / 255.0
      const g = data[i * 4 + 1] / 255.0
      const b = data[i * 4 + 2] / 255.0

      floatData[i] = (r - mean[0]) / std[0]
      floatData[planeSize + i] = (g - mean[1]) / std[1]
      floatData[planeSize * 2 + i] = (b - mean[2]) / std[2]
    }

    return new ort.Tensor('float32', floatData, [1, 3, 224, 224])
  } catch {
    return null
  }
}

async function runBrowserInference(imageSource: any): Promise<number | null> {
  const session = await getBrowserSession()
  if (!session) return null

  const ort = await import('onnxruntime-web')

  const width = imageSource.naturalWidth || imageSource.videoWidth || imageSource.width || 224
  const height = imageSource.naturalHeight || imageSource.videoHeight || imageSource.height || 224

  const crops = [
    { sx: 0, sy: 0, sw: width, sh: height },
  ]
  if (width > 224 && height > 224) {
    crops.push({ sx: 0, sy: 0, sw: Math.floor(width * 0.8), sh: Math.floor(height * 0.8) })
    crops.push({ sx: Math.floor(width * 0.2), sy: Math.floor(height * 0.2), sw: width - Math.floor(width * 0.2), sh: height - Math.floor(height * 0.2) })
    crops.push({ sx: Math.floor(width * 0.1), sy: Math.floor(height * 0.1), sw: Math.floor(width * 0.8), sh: Math.floor(height * 0.8) })
  }

  const scores: number[] = []

  for (const crop of crops) {
    const tensor = imageToFloat32Tensor(imageSource, crop.sx, crop.sy, crop.sw, crop.sh, ort)
    if (!tensor) continue

    const feeds: Record<string, any> = { pixel_values: tensor }
    const results = await session.run(feeds)
    const logits = results.logits?.data as Float32Array
    if (!logits || logits.length < 2) continue

    const maxVal = Math.max(logits[0], logits[1])
    const exp0 = Math.exp(logits[0] - maxVal)
    const exp1 = Math.exp(logits[1] - maxVal)
    const probAi = (exp0 / (exp0 + exp1)) * 100.0
    scores.push(probAi)
  }

  if (scores.length === 0) return null
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return Math.round(avg * 10) / 10
}
