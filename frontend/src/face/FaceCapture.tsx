import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Spin, Tag } from 'antd';
import { captureAverageDescriptor, loadFaceModels } from './faceApi';
import FaceOverlay from './FaceOverlay';

interface Props {
  actionText: string;
  submitting?: boolean;
  samples?: number;
  onResult: (data: { descriptor: number[] }) => void | Promise<void>;
}

type Phase = 'init' | 'ready' | 'detecting' | 'error';

export default function FaceCapture({ actionText, submitting = false, samples = 5, onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelRef = useRef(false);
  const [phase, setPhase] = useState<Phase>('init');
  const [hint, setHint] = useState('正在加载人脸模型…');
  const [errorMsg, setErrorMsg] = useState('');

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      throw new Error('无法访问摄像头，请检查浏览器权限（需 HTTPS 或 localhost）');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadFaceModels();
        if (!mounted) return;
        await startCamera();
        if (!mounted) return;
        setPhase('ready');
        setHint('请正对摄像头，点击下方按钮采集');
      } catch (e: any) {
        if (!mounted) return;
        setErrorMsg(e.message || '初始化失败');
        setPhase('error');
      }
    })();
    return () => {
      mounted = false;
      cancelRef.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  const handleStart = useCallback(async () => {
    if (phase !== 'ready') return;
    setPhase('detecting');
    cancelRef.current = false;
    try {
      setHint('正在采集人脸特征（多帧平均，请保持不动）…');
      const descriptor = await captureAverageDescriptor(videoRef.current!, samples);
      if (!descriptor) {
        setHint('未能采集到清晰人脸，请正对摄像头重试');
        setPhase('ready');
        return;
      }
      await onResult({ descriptor });
      setHint('可重新采集');
      setPhase('ready');
    } catch (e: any) {
      setHint(e?.message || '采集失败，请重试');
      setPhase('ready');
    }
  }, [phase, onResult, samples]);

  if (phase === 'error') {
    return <Alert type="error" showIcon message="摄像头/模型初始化失败" description={errorMsg} />;
  }

  return (
    <div className="face-wrap">
      <div className="face-camera-wrap">
        <video ref={videoRef} className="face-video" muted playsInline />
        <FaceOverlay videoRef={videoRef} active={phase !== 'init'} />
        {(phase === 'init' || phase === 'detecting' || submitting) && (
          <div className="face-camera-loading">
            <Spin tip={phase === 'detecting' ? '采集中…' : submitting ? '提交中…' : '加载中…'} />
          </div>
        )}
      </div>
      <Tag color={phase === 'detecting' ? 'processing' : 'blue'} style={{ whiteSpace: 'normal', textAlign: 'center' }}>
        {hint}
      </Tag>
      <Button
        type="primary"
        size="large"
        block
        loading={phase === 'detecting' || submitting}
        disabled={phase === 'init'}
        onClick={handleStart}
      >
        {actionText}
      </Button>
    </div>
  );
}
