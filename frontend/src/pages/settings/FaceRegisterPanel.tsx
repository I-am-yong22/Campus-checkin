import { useEffect, useState } from 'react';
import { Alert, Button, Space, Typography, message } from 'antd';
import FaceCapture from '../../face/FaceCapture';
import { faceApi } from '../../api/checkin';
import { useAuth } from '../../store/AuthContext';

const { Paragraph } = Typography;

export default function FaceRegisterPanel() {
  const { user, refresh } = useAuth();
  const [registered, setRegistered] = useState<boolean>(!!user?.faceRegistered);
  const [submitting, setSubmitting] = useState(false);
  const [reEnrolling, setReEnrolling] = useState(false);

  useEffect(() => {
    faceApi.status().then((s) => setRegistered(s.registered)).catch(() => {});
  }, []);

  const onResult = async ({ descriptor }: { descriptor: number[] }) => {
    setSubmitting(true);
    try {
      await faceApi.register(descriptor);
      await refresh();
      setRegistered(true);
      setReEnrolling(false);
      message.success('人脸录入成功');
    } finally {
      setSubmitting(false);
    }
  };

  const showCapture = !registered || reEnrolling;

  return (
    <div style={{ maxWidth: 460 }}>
      {registered && !reEnrolling ? (
        <div className="face-alert-registered">
          <Alert
            type="success"
            showIcon
            message="人脸已录入"
            description="之后请到现场签到机进行人脸签到。如更换了外貌或识别不准，可重新录入覆盖原有数据。"
          />
          <Button size="small" className="face-alert-registered__action" onClick={() => setReEnrolling(true)}>
            重新录入
          </Button>
        </div>
      ) : (
        <>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="请先录入人脸"
            description="录入一次即可，签到时戴眼镜或不戴眼镜都能识别。"
          />
          <Paragraph type="secondary">
            <Space direction="vertical" size={2}>
              <span>1. 保持面部在画面中央、光线充足</span>
              <span>2. 摘掉口罩、帽子等遮挡物</span>
              <span>3. 按日常状态采集一次即可</span>
            </Space>
          </Paragraph>
          {showCapture && (
            <FaceCapture
              actionText={registered ? '重新录入人脸' : '采集并录入'}
              submitting={submitting}
              samples={6}
              onResult={onResult}
            />
          )}
        </>
      )}
    </div>
  );
}
