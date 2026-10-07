import { loadLiteRt, loadAndCompile, Tensor } from "@litertjs/core";

const MODEL_PATH = "/models/helmet_yolo11n_best_int8.tflite";

const INPUT_SIZE = 640;
const NUM_CANDIDATES = 8400;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.25;
const DEFAULT_IOU_THRESHOLD = 0.45;

export const CLASS_NAMES = [
  "bicyclist",
  "driver",
  "helmet",
  "no-helmet",
] as const;

export interface Detection {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  classId: number;
  className: string;
}

/**
 * Sources supported by the detector.
 *
 * Images are used for normal image detection.
 * Videos are used for frame-by-frame detection.
 */
type DetectionSource = HTMLImageElement | HTMLVideoElement;

let model: any = null;

/**
 * Loads and compiles the TFLite helmet detection model.
 * The model is cached after the first load.
 */
export async function loadHelmetModel() {
  if (model) {
    return model;
  }

  await loadLiteRt("https://cdn.jsdelivr.net/npm/@litertjs/core/wasm/");

  model = await loadAndCompile(MODEL_PATH, {
    accelerator: "wasm",
  });

  console.log("Helmet detection model loaded successfully!");

  return model;
}

/**
 * Converts an image or video frame into the
 * model input format.
 *
 * Shape: [1, 3, 640, 640]
 * Layout: NCHW
 * Type: float32
 * Range: 0-1
 */
function preprocessMedia(source: DetectionSource): Float32Array {
  const canvas = document.createElement("canvas");

  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not create canvas context for preprocessing.");
  }

  /*
   * Resize the current image/video frame
   * to the model's 640x640 input.
   */
  ctx.drawImage(source, 0, 0, INPUT_SIZE, INPUT_SIZE);

  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const pixels = imageData.data;

  const planeSize = INPUT_SIZE * INPUT_SIZE;

  /*
   * Model expects channel-first:
   *
   * RRRRR...
   * GGGGG...
   * BBBBB...
   */
  const input = new Float32Array(3 * planeSize);

  for (let i = 0; i < planeSize; i++) {
    const pixelIndex = i * 4;

    // Red
    input[i] = pixels[pixelIndex] / 255.0;

    // Green
    input[planeSize + i] = pixels[pixelIndex + 1] / 255.0;

    // Blue
    input[2 * planeSize + i] = pixels[pixelIndex + 2] / 255.0;
  }

  return input;
}

/**
 * Calculates Intersection over Union (IoU)
 * between two bounding boxes.
 */
function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.x, b.x);

  const y1 = Math.max(a.y, b.y);

  const x2 = Math.min(a.x + a.width, b.x + b.width);

  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const intersectionWidth = Math.max(0, x2 - x1);

  const intersectionHeight = Math.max(0, y2 - y1);

  const intersection = intersectionWidth * intersectionHeight;

  const areaA = a.width * a.height;

  const areaB = b.width * b.height;

  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}

/**
 * Removes overlapping duplicate detections.
 *
 * NMS is performed independently for each class.
 */
function nonMaximumSuppression(
  detections: Detection[],
  threshold = DEFAULT_IOU_THRESHOLD,
): Detection[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score);

  const selected: Detection[] = [];

  while (sorted.length > 0) {
    const current = sorted.shift()!;

    selected.push(current);

    for (let i = sorted.length - 1; i >= 0; i--) {
      if (
        sorted[i].classId === current.classId &&
        iou(current, sorted[i]) > threshold
      ) {
        sorted.splice(i, 1);
      }
    }
  }

  return selected;
}

/**
 * Decodes YOLO11 output.
 *
 * Output shape:
 * [1, 8, 8400]
 *
 * Channels:
 *
 * 0 = x center
 * 1 = y center
 * 2 = width
 * 3 = height
 * 4 = bicyclist
 * 5 = driver
 * 6 = helmet
 * 7 = no-helmet
 */
function processOutput(
  output: Float32Array,
  confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
): Detection[] {
  const detections: Detection[] = [];

  for (let i = 0; i < NUM_CANDIDATES; i++) {
    const xCenter = output[i];

    const yCenter = output[NUM_CANDIDATES + i];

    const width = output[NUM_CANDIDATES * 2 + i];

    const height = output[NUM_CANDIDATES * 3 + i];

    let bestScore = 0;
    let bestClass = -1;

    for (let classId = 0; classId < CLASS_NAMES.length; classId++) {
      const score = output[(4 + classId) * NUM_CANDIDATES + i];

      if (score > bestScore) {
        bestScore = score;
        bestClass = classId;
      }
    }

    if (bestClass === -1 || bestScore < confidenceThreshold) {
      continue;
    }

    detections.push({
      x: xCenter - width / 2,

      y: yCenter - height / 2,

      width,
      height,

      score: bestScore,

      classId: bestClass,

      className: CLASS_NAMES[bestClass],
    });
  }

  return nonMaximumSuppression(detections);
}

/**
 * Shared inference function.
 *
 * This allows both images and video frames
 * to use exactly the same model pipeline.
 */
async function runDetection(
  source: DetectionSource,
  confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
): Promise<Detection[]> {
  const compiledModel = await loadHelmetModel();

  const inputData = preprocessMedia(source);

  const inputTensor = new Tensor(inputData, [1, 3, INPUT_SIZE, INPUT_SIZE]);

  let outputTensor: any = null;

  try {
    const outputs = await compiledModel.run(inputTensor);

    outputTensor = outputs[0];

    const outputData = await outputTensor.data();

    return processOutput(outputData as Float32Array, confidenceThreshold);
  } finally {
    /*
     * Release LiteRT tensors so repeated
     * video inference doesn't continuously
     * consume memory.
     */
    if (outputTensor) {
      outputTensor.delete();
    }

    inputTensor.delete();
  }
}

/**
 * Runs detection on an uploaded image.
 */
export async function detectImage(
  image: HTMLImageElement,
  confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
): Promise<Detection[]> {
  return runDetection(image, confidenceThreshold);
}

/**
 * Runs detection on the current frame
 * of a video.
 *
 * Call this repeatedly while the video
 * is playing to achieve frame-by-frame
 * detection.
 */
export async function detectVideoFrame(
  video: HTMLVideoElement,
  confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
): Promise<Detection[]> {
  /*
   * Prevent inference before the browser
   * has decoded the video's dimensions.
   */
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return [];
  }

  return runDetection(video, confidenceThreshold);
}
