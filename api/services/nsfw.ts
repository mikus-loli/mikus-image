/**
 * NSFWJS content moderation service.
 *
 * Uses nsfwjs + @tensorflow/tfjs (pure JS, no native deps) so it runs anywhere.
 * The model is lazy-loaded on first use and cached for the process lifetime.
 * If loading fails (e.g. no network to download the model), the service enters
 * a degraded state and callers decide how to handle it via the degrade mode.
 */
import * as tf from '@tensorflow/tfjs'
import * as nsfwjs from 'nsfwjs'
import sharp from 'sharp'

// Force the CPU backend explicitly (pure JS, always available).
try {
  tf.setBackend('cpu')
  await tf.ready()
} catch {
  // backend already registered; ignore
}

let modelPromise: Promise<nsfwjs.NSFWJS> | null = null
let loadError: Error | null = null

export interface NsfwPrediction {
  className: string
  probability: number
}

export interface NsfwResult {
  predictions: NsfwPrediction[]
  /** Highest probability among the configured NSFW classes */
  maxNsfwScore: number
  /** The class with the highest probability overall */
  topClass: string
  /** Whether the image is considered NSFW given the classes + threshold */
  isNsfw: boolean
}

export class NsfwServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'NsfwServiceError'
  }
}

/** Whether the model loaded successfully at least once. */
export function isNsfwReady(): boolean {
  return modelPromise !== null && loadError === null
}

/** Last error encountered while loading the model (null if none / not tried). */
export function getNsfwLoadError(): Error | null {
  return loadError
}

/** Reset the error state so the model can be retried on the next upload. */
export function resetNsfwState(): void {
  modelPromise = null
  loadError = null
}

/**
 * Lazy-load the NSFWJS model. Downloads the default model on first call
 * (mobileNetV2 mid, ~2-3MB) and caches it in memory.
 */
export function loadNsfwModel(): Promise<nsfwjs.NSFWJS> {
  if (loadError) return Promise.reject(loadError)
  if (!modelPromise) {
    modelPromise = nsfwjs.load().catch((err: unknown) => {
      loadError = err instanceof Error ? err : new Error(String(err))
      modelPromise = null
      throw new NsfwServiceError('NSFWJS 模型加载失败', err)
    })
  }
  return modelPromise
}

/**
 * Decode an image buffer into a RGB Tensor3D using sharp.
 * Resized to 299x299 to bound memory and inference time; nsfwjs re-normalizes
 * internally based on the loaded model.
 */
async function bufferToTensor(buffer: Buffer): Promise<tf.Tensor3D> {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .resize(299, 299, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  // sharp returns raw RGB bytes; build a uint8 tensor [H, W, 3]
  return tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels || 3])
}

/**
 * Classify an image buffer and return NSFW predictions.
 * Throws NsfwServiceError if the model is unavailable.
 */
export async function classifyImage(buffer: Buffer): Promise<NsfwResult> {
  const model = await loadNsfwModel()
  const tensor = await bufferToTensor(buffer)
  try {
    const predictions = (await model.classify(tensor)) as NsfwPrediction[]
    return buildResult(predictions)
  } finally {
    tensor.dispose()
  }
}

function buildResult(predictions: NsfwPrediction[]): NsfwResult {
  // Default NSFW classes per nsfwjs: Hentai, Porn, Sexy
  const nsfwClasses = ['Hentai', 'Porn', 'Sexy']
  let maxNsfwScore = 0
  for (const p of predictions) {
    if (nsfwClasses.includes(p.className) && p.probability > maxNsfwScore) {
      maxNsfwScore = p.probability
    }
  }
  const top = predictions.reduce(
    (best, cur) => (cur.probability > best.probability ? cur : best),
    predictions[0] ?? { className: 'Unknown', probability: 0 }
  )
  return {
    predictions,
    maxNsfwScore,
    topClass: top.className,
    // Default threshold 0.5; callers may override via settings.
    isNsfw: maxNsfwScore >= 0.5,
  }
}

/**
 * Evaluate an image against the configured NSFW policy.
 *
 * @param buffer      Image bytes (any format sharp can read)
 * @param nsfwClasses Lower-cased class names that count as NSFW
 * @param threshold   Probability threshold (0-1) above which an image is flagged
 */
export async function evaluateImage(
  buffer: Buffer,
  nsfwClasses: string[],
  threshold: number
): Promise<NsfwResult> {
  const base = await classifyImage(buffer)
  let maxNsfwScore = 0
  const lowerClasses = nsfwClasses.map((c) => c.toLowerCase())
  for (const p of base.predictions) {
    if (lowerClasses.includes(p.className.toLowerCase()) && p.probability > maxNsfwScore) {
      maxNsfwScore = p.probability
    }
  }
  return {
    ...base,
    maxNsfwScore,
    isNsfw: maxNsfwScore >= threshold,
  }
}
