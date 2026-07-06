import { useState } from 'react';
import { Input, Modal, Segmented, message } from 'antd';
import Kiosk from './Kiosk';
import Register from './Register';
import { kioskApi } from './api';

type Mode = 'kiosk' | 'register';

export default function App() {
  const [mode, setMode] = useState<Mode>('kiosk');
  const [adminToken, setAdminToken] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  const openAdminModal = () => {
    setTokenInput(adminToken);
    setModalOpen(true);
  };

  const verifyAndEnter = async () => {
    if (!tokenInput.trim()) {
      message.warning('请输入管理口令');
      return;
    }
    setVerifying(true);
    try {
      await kioskApi.verifyAdmin(tokenInput.trim());
      setAdminToken(tokenInput.trim());
      setMode('register');
      setModalOpen(false);
      message.success('验证通过，已进入现场录入');
    } catch (e: any) {
      message.error(e?.message || '口令错误');
    } finally {
      setVerifying(false);
    }
  };

  const handleModeChange = (next: Mode) => {
    if (next === 'register') {
      if (adminToken) {
        setMode('register');
      } else {
        openAdminModal();
      }
      return;
    }
    setMode('kiosk');
  };

  const modeSwitch = (
    <Segmented
      size="small"
      value={mode}
      onChange={(v) => handleModeChange(v as Mode)}
      options={[
        { label: '签到打卡', value: 'kiosk' },
        { label: '现场录入', value: 'register' },
      ]}
    />
  );

  return (
    <div className="app-root">
      {mode === 'kiosk' ? (
        <Kiosk onAdminRequest={openAdminModal} headerExtra={modeSwitch} />
      ) : (
        <Register adminToken={adminToken} headerExtra={modeSwitch} />
      )}

      <Modal
        title="管理员验证"
        open={modalOpen}
        onOk={verifyAndEnter}
        onCancel={() => setModalOpen(false)}
        confirmLoading={verifying}
        okText="进入现场录入"
        destroyOnClose
      >
        <p style={{ marginBottom: 12, color: '#78716C' }}>
          请输入现场录入管理口令。也可在 Logo 区域右键打开此窗口。
        </p>
        <Input.Password
          placeholder="管理口令"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          onPressEnter={verifyAndEnter}
        />
      </Modal>
    </div>
  );
}
