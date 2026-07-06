import { useEffect, useRef, useState } from 'react';
import { detectFaceBox } from './faceApi';

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active?: boolean;
  mirror?: boolean;
}

const COLOR_WAIT = 'rgba(255, 107, 53, 0.9)';
const COLOR_OK = '#22C55E';
const COLOR_OK_FILL = 'rgba(34, 197, 94, 0.35)';

function drawCorners(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  len = 18,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.moveTo(x + w - len, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + len);
  ctx.moveTo(x + w, y + h - len);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - len, y + h);
  ctx.moveTo(x + len, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - len);
  ctx.stroke();
}

export default function FaceOverlay({ videoRef, active = true, mirror = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    if (!active) return;
    runningRef.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const drawGuide = (w: number, h: number) => {
      const gw = w * 0.42;
      const gh = h * 0.52;
      const gx = (w - gw) / 2;
      const gy = (h - gh) / 2;
      ctx.strokeStyle = COLOR_WAIT;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(gx, gy, gw, gh);
      ctx.setLineDash([]);
      drawCorners(ctx, gx, gy, gw, gh, COLOR_WAIT, 14);
    };

    const drawDetected = (x: number, y: number, bw: number, bh: number) => {
      const pad = 6;
      const rx = x - pad;
      const ry = y - pad;
      const rw = bw + pad * 2;
      const rh = bh + pad * 2;
      ctx.strokeStyle = COLOR_OK_FILL;
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);
      drawCorners(ctx, rx, ry, rw, rh, COLOR_OK, 20);
    };

    const tick = async () => {
      if (!runningRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) {
        setTimeout(tick, 120);
        return;
      }

      const w = video.clientWidth;
      const h = video.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);

      const box = await detectFaceBox(video);
      setDetected(!!box);
      if (box) {
        const sx = w / video.videoWidth;
        const sy = h / video.videoHeight;
        let x = box.x * sx;
        const y = box.y * sy;
        const bw = box.width * sx;
        const bh = box.height * sy;
        if (mirror) x = w - x - bw;
        drawDetected(x, y, bw, bh);
      } else {
        drawGuide(w, h);
      }

      setTimeout(tick, 90);
    };

    tick();
    return () => {
      runningRef.current = false;
      setDetected(false);
    };
  }, [active, mirror, videoRef]);

  if (!active) return null;

  return (
    <>
      <canvas ref={canvasRef} className="face-overlay-canvas" aria-hidden />
      <div className={`face-overlay-badge ${detected ? 'face-overlay-badge--ok' : 'face-overlay-badge--wait'}`}>
        {detected ? '已检测到人脸' : '请将面部移入画面'}
      </div>
    </>
  );
}
