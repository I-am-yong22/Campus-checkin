import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Input, Select, Space, Spin, Steps, Tag, Typography, message } from 'antd';
import { captureAverageDescriptor, loadFaceModels } from './face/faceApi';
import FaceOverlay from './face/FaceOverlay';
import KioskHeader from './components/KioskHeader';
import { kioskApi, type KioskUser } from './api';

const { Text } = Typography;

interface Props {
  adminToken?: string;
  headerExtra?: React.ReactNode;
}

function nowClock(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

export default function Register({ adminToken: initialToken = '', headerExtra }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [clock, setClock] = useState(nowClock());
  const [ready, setReady] = useState(false);
  const [initErr, setInitErr] = useState('');
  const [adminToken, setAdminToken] = useState(initialToken);
  const [tokenVerified, setTokenVerified] = useState(!!initialToken);
  const [verifying, setVerifying] = useState(false);
  const [users, setUsers] = useState<KioskUser[]>([]);
  const [userId, setUserId] = useState<number | undefined>();
  const [capturing, setCapturing] = useState(false);
  const [lastResult, setLastResult] = useState<{ name: string; seat: string } | null>(null);

  const currentStep = !tokenVerified ? 0 : !userId ? 1 : 2;

  useEffect(() => {
    const t = setInterval(() => setClock(nowClock()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (initialToken) {
      setAdminToken(initialToken);
      setTokenVerified(true);
    }
  }, [initialToken]);

  const loadUsers = useCallback(async () => {
    try {
      const { users: list } = await kioskApi.users();
      setUsers(list);
    } catch (e: any) {
      message.error(e?.message || '加载用户失败');
    }
  }, []);

  const bindStreamToVideo = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    if (video.paused) {
      await video.play();
    }
  }, []);

  const onVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && streamRef.current) {
        el.srcObject = streamRef.current;
        el.play().catch(() => {});
      }
    },
    [],
  );

  useEffect(() => {
    if (!tokenVerified) {
      setReady(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setInitErr('');
        await loadFaceModels();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        await bindStreamToVideo();
        await loadUsers();
        setReady(true);
      } catch (e: any) {
        if (mounted) {
          setInitErr(e?.message || '初始化失败（摄像头权限/模型加载）');
        }
      }
    })();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setReady(false);
    };
  }, [tokenVerified, loadUsers, bindStreamToVideo]);

  const verifyToken = async () => {
    if (!adminToken.trim()) return message.warning('请输入管理口令');
    setVerifying(true);
    try {
      await kioskApi.verifyAdmin(adminToken.trim());
      setTokenVerified(true);
      message.success('口令验证通过');
    } catch (e: any) {
      message.error(e?.message || '口令错误');
    } finally {
      setVerifying(false);
    }
  };

  const handleCapture = useCallback(async () => {
    if (!tokenVerified) return message.warning('请先验证管理口令');
    if (!userId) return message.warning('请先选择用户');
    setCapturing(true);
    try {
      const descriptor = await captureAverageDescriptor(videoRef.current!, 6);
      if (!descriptor) {
        message.warning('未能采集到清晰人脸，请正对摄像头重试');
        return;
      }
      const res = await kioskApi.registerFace(userId, descriptor, adminToken);
      message.success(res.message);
      if (res.seat) {
        setLastResult({ name: res.name, seat: res.seat });
      }
      await loadUsers();
    } catch (e: any) {
      message.error(e?.message || '录入失败');
    } finally {
      setCapturing(false);
    }
  }, [adminToken, userId, loadUsers, tokenVerified]);

  if (initErr && tokenVerified) {
    return (
      <div className="kiosk-shell">
        <KioskHeader clock={clock} extra={headerExtra} />
        <div className="register-page">
          <Alert type="error" showIcon message="现场录入不可用" description={initErr} />
        </div>
      </div>
    );
  }

  const selected = users.find((u) => u.id === userId);
  const showSuccessSeat = lastResult && selected && lastResult.name === selected.name;
  const previewSeat = selected?.seat ?? null;

  const seatPanel = tokenVerified ? (
    <div className="register-seat-panel">
      <div className="register-seat-panel__title">座位</div>
      {showSuccessSeat ? (
        <div className="register-seat-panel__success">
          <Text type="secondary">录入成功</Text>
          <div className="register-seat-panel__name">{lastResult!.name}</div>
          <Text type="secondary">您的座位</Text>
          <div className="register-seat-panel__code">{lastResult!.seat}</div>
        </div>
      ) : previewSeat ? (
        <div className="register-seat-panel__preview">
          <Text type="secondary">当前座位</Text>
          <div className="register-seat-panel__code register-seat-panel__code--preview">{previewSeat}</div>
        </div>
      ) : (
        <div className="register-seat-panel__placeholder">
          <Text type="secondary">录入成功后将显示座位</Text>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="kiosk-shell">
      <KioskHeader clock={clock} extra={headerExtra} />

      <div className="register-page">
        <div className="register-content">
          <Steps
            className="register-steps"
            current={currentStep}
            size="small"
            items={[
              { title: '验证口令' },
              { title: '选择用户' },
              { title: '采集人脸' },
            ]}
          />

          <Card className="register-card" title="现场人脸录入">
            {!tokenVerified && (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Text type="secondary">用于在签到机上为新成员或识别不准的成员登记/更新人脸。</Text>
                <Input.Password
                  placeholder="管理口令"
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  onPressEnter={verifyToken}
                />
                <Button type="primary" loading={verifying} onClick={verifyToken}>
                  验证并继续
                </Button>
              </Space>
            )}

            {tokenVerified && (
              <div className="register-layout">
                <div className="register-stage kiosk-stage">
                  <Select
                    showSearch
                    placeholder="选择用户"
                    style={{ width: '100%' }}
                    value={userId}
                    onChange={setUserId}
                    optionFilterProp="label"
                    options={users.map((u) => ({
                      value: u.id,
                      label: `${u.name}（${u.username}）${u.team ? ' · ' + u.team.name : ''}${u.faceRegistered ? ' · 已录入' : ''}${u.seat ? ' · 座位 ' + u.seat : ''}`,
                    }))}
                  />
                  <div className="register-target-row">
                    {selected ? (
                      <>
                        <Text type="secondary">目标：{selected.name}</Text>
                        <span className="register-target-row__tags">
                          {selected.faceRegistered ? (
                            <Tag color="success">已录入（将覆盖）</Tag>
                          ) : (
                            <Tag color="warning">未录入</Tag>
                          )}
                          {selected.seat && <Tag>座位 {selected.seat}</Tag>}
                        </span>
                      </>
                    ) : (
                      <Text type="secondary" className="register-target-row__placeholder">
                        请选择要录入的用户
                      </Text>
                    )}
                  </div>

                  <div className="kiosk-video-wrap register-video-wrap">
                    <video ref={onVideoRef} className="kiosk-video" muted playsInline autoPlay />
                    <FaceOverlay videoRef={videoRef} active={ready && !!userId} />
                    {(!ready || capturing) && (
                      <div className="kiosk-overlay">
                        <Spin tip={ready ? '采集中…' : '加载中…'} />
                      </div>
                    )}
                  </div>

                  <Button
                    type="primary"
                    size="large"
                    block
                    loading={capturing}
                    disabled={!ready || !userId}
                    onClick={handleCapture}
                  >
                    采集并录入人脸
                  </Button>
                </div>
                {seatPanel}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
