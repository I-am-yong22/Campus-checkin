import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';
let loaded = false;
let loadingPromise: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (loaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    loaded = true;
  })();
  return loadingPromise;
}

const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
const fastOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });

export interface DetectResult {
  descriptor: number[];
}

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function detectFace(video: HTMLVideoElement): Promise<DetectResult | null> {
  const res = await faceapi
    .detectSingleFace(video, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!res) return null;
  return { descriptor: Array.from(res.descriptor) };
}

export async function detectFaceBox(video: HTMLVideoElement): Promise<FaceBox | null> {
  const res = await faceapi.detectSingleFace(video, fastOptions);
  if (!res) return null;
  const { x, y, width, height } = res.box;
  return { x, y, width, height };
}

export async function captureAverageDescriptor(
  video: HTMLVideoElement,
  samples = 5,
  maxTries = 15,
): Promise<number[] | null> {
  const collected: number[][] = [];
  for (let i = 0; i < maxTries && collected.length < samples; i++) {
    const r = await detectFace(video);
    if (r) collected.push(r.descriptor);
    await new Promise((res) => setTimeout(res, 100));
  }
  if (collected.length === 0) return null;
  const dim = collected[0].length;
  const avg = new Array(dim).fill(0);
  for (const d of collected) {
    for (let i = 0; i < dim; i++) avg[i] += d[i];
  }
  for (let i = 0; i < dim; i++) avg[i] /= collected.length;
  return avg;
}

/** 签到专用：多帧采集，取与模板距离最近的一帧 */
export async function captureBestDescriptor(
  video: HTMLVideoElement,
  templates: number[][],
  samples = 10,
  maxTries = 18,
): Promise<{ descriptor: number[]; distance: number } | null> {
  let best: { descriptor: number[]; distance: number } | null = null;
  let collected = 0;
  for (let i = 0; i < maxTries && collected < samples; i++) {
    const r = await detectFace(video);
    if (!r) continue;
    collected++;
    const d = minDistance(r.descriptor, templates);
    if (!best || d < best.distance) {
      best = { descriptor: r.descriptor, distance: d };
    }
    await new Promise((res) => setTimeout(res, 80));
  }
  return best;
}

export function parseStoredDescriptors(raw: string): number[][] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  if (typeof parsed[0] === 'number') return [parsed as number[]];
  return parsed as number[][];
}

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function minDistance(query: number[], templates: number[][]): number {
  if (templates.length === 0) return Infinity;
  return Math.min(...templates.map((t) => euclideanDistance(query, t)));
}

export interface FaceEntry {
  userId: number;
  name: string;
  username: string;
  teamId: number | null;
  descriptors: number[][];
}

export interface MatchResult {
  entry: FaceEntry;
  distance: number;
}

export function matchFace(descriptor: number[], library: FaceEntry[]): MatchResult | null {
  let best: MatchResult | null = null;
  for (const entry of library) {
    const distance = minDistance(descriptor, entry.descriptors);
    if (!best || distance < best.distance) {
      best = { entry, distance };
    }
  }
  return best;
}

/** 扫描时连续采多帧，取匹配最优结果（对戴眼镜等外观变化更鲁棒） */
export async function detectBestMatch(
  video: HTMLVideoElement,
  library: FaceEntry[],
  frames = 3,
): Promise<MatchResult | null> {
  let best: MatchResult | null = null;
  for (let i = 0; i < frames; i++) {
    const det = await detectFace(video);
    if (!det) continue;
    const m = matchFace(det.descriptor, library);
    if (m && (!best || m.distance < best.distance)) best = m;
  }
  return best;
}
