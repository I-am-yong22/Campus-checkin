import { useCallback, useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
import {
  captureBestDescriptor,
  detectBestMatch,
  loadFaceModels,
  type FaceEntry,
} from './face/faceApi';
import FaceOverlay from './face/FaceOverlay';
import CheckInResultOverlay, { type ResultPayload } from './components/CheckInResultOverlay';
import { kioskApi, type CheckInResp } from './api';

type Phase = 'init' | 'scanning' | 'processing' | 'result' | 'error';

interface Props {
  active: boolean;
  onBoardRefresh?: () => void;
}

export default function KioskAttendance({ active, onBoardRefresh }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const libraryRef = useRef<FaceEntry[]>([]);
  const thresholdRef = useRef<number>(0.45);
  const cancelledRef = useRef(false);
  const busyRef = useRef(false);
  const modelsLoadedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('init');
  const [hint, setHint] = useState('正在准备摄像头…');
  const [errorMsg, setErrorMsg] = useState('');
  const [activeName, setActiveName] = useState('');
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [ready, setReady] = useState(false);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const stopCamera = useCallback(() => {
    cancelledRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const waitForMatch = useCallback(async (): Promise<FaceEntry | null> => {
    const video = videoRef.current!;
    let lastUserId: number | null = null;
    let streak = 0;
    while (!cancelledRef.current) {
      const best = await detectBestMatch(video, libraryRef.current, 3);
      if (!best) {
        setHint('请站到摄像头前，面向镜头');
        lastUserId = null;
        streak = 0;
        await sleep(150);
        continue;
      }
      if (best.distance <= thresholdRef.current) {
        if (best.entry.userId === lastUserId) streak++;
        else {
          lastUserId = best.entry.userId;
          streak = 1;
        }
        setActiveName(best.entry.name);
        setHint('正在识别，请保持面向镜头');
        if (streak >= 2) return best.entry;
      } else {
        lastUserId = null;
        streak = 0;
        setActiveName('');
        setHint('未识别到已登记成员，请靠近镜头');
      }
      await sleep(120);
    }
    return null;
  }, []);

  const runCycle = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      while (!cancelledRef.current) {
        setPhase('scanning');
        setActiveName('');
        setResult(null);
        const entry = await waitForMatch();
        if (cancelledRef.current || !entry) break;

        setActiveName(entry.name);
        setPhase('processing');
        setHint('正在验证…');
        const best = await captureBestDescriptor(videoRef.current!, entry.descriptors, 10);
        if (cancelledRef.current) break;
        if (!best || best.distance > thresholdRef.current) {
          setResult({ kind: 'warning', message: '人脸核验未通过，请重试' });
          setPhase('result');
          await sleep(2500);
          continue;
        }

        try {
          const res: CheckInResp = await kioskApi.attendance(entry.userId, best.descriptor);
          const isCheckout = res.action === 'CHECK_OUT';
          setResult({
            kind: 'success',
            name: res.name,
            avatarUrl: res.avatarUrl,
            teamName: res.teamName,
            action: res.action,
            message: res.message,
            status: isCheckout ? 'CHECK_OUT' : res.status,
            workMinutes: res.workMinutes,
          });
          onBoardRefresh?.();
        } catch (e: any) {
          if (e?.data?.action === 'REJECT') {
            setResult({
              kind: 'warning',
              name: e.data?.name,
              message: e?.message || '当前不在签到/签退时段',
            });
          } else {
            setResult({ kind: 'error', message: e?.message || '操作失败，请重试' });
          }
        }
        setPhase('result');
        await sleep(3500);
      }
    } finally {
      busyRef.current = false;
    }
  }, [onBoardRefresh, waitForMatch]);

  const startCamera = useCallback(async () => {
    cancelledRef.current = false;
    setErrorMsg('');
    setPhase('init');
    try {
      const health = await kioskApi.health();
      thresholdRef.current = health.threshold || 0.45;

      if (!modelsLoadedRef.current) {
        await loadFaceModels();
        modelsLoadedRef.current = true;
      }

      const { faces } = await kioskApi.faces();
      libraryRef.current = faces.map((f) => ({
        userId: f.userId,
        name: f.name,
        username: f.username,
        teamId: f.teamId,
        descriptors: f.descriptors,
      }));

      if (faces.length === 0) {
        setErrorMsg('人脸库为空：请管理员完成人脸录入');
        setPhase('error');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
      runCycle();
    } catch (e: any) {
      setErrorMsg(e?.message || '摄像头初始化失败');
      setPhase('error');
    }
  }, [runCycle]);

  useEffect(() => {
    if (active) {
      startCamera();
    } else {
      stopCamera();
      setReady(false);
      setPhase('init');
    }
    return () => stopCamera();
  }, [active, startCamera, stopCamera]);

  if (!active) return null;

  return (
    <div className="kiosk-stage">
      <div className="kiosk-video-wrap">
        <video ref={videoRef} className="kiosk-video" muted playsInline />
        <FaceOverlay videoRef={videoRef} active={phase === 'scanning' && ready} />
        {(phase === 'init' || phase === 'processing') && (
          <div className="kiosk-overlay">
            <Spin size="large" tip={phase === 'init' ? '正在开启摄像头…' : '正在验证…'} />
          </div>
        )}
        {activeName && phase === 'processing' && (
          <div className="kiosk-name-badge">{activeName}</div>
        )}
        <CheckInResultOverlay result={phase === 'result' ? result : null} />
      </div>

      {phase === 'error' ? (
        <div className="kiosk-hint kiosk-hint--error">{errorMsg}</div>
      ) : phase !== 'result' && phase !== 'processing' ? (
        <div className="kiosk-hint kiosk-hint--info">{hint}</div>
      ) : null}
      <div className="kiosk-footnote">签到/签退时段内 · 面向镜头即可自动识别</div>
    </div>
  );
}
