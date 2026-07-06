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

/** 仅检测人脸框（用于实时预览叠加，较轻量） */
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

export function parseStoredDescriptors(raw: string): number[][] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  if (typeof parsed[0] === 'number') return [parsed as number[]];
  return parsed as number[][];
}

export function serializeDescriptors(templates: number[][]): string {
  const valid = templates.filter((t) => Array.isArray(t) && t.length === 128);
  if (valid.length === 0) throw new Error('无效的人脸特征');
  return JSON.stringify(valid[0]);
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
