import { Tag } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { avatarSrc } from '../utils/avatar';

export type ResultKind = 'success' | 'warning' | 'error';

export interface ResultPayload {
  kind: ResultKind;
  name?: string;
  avatarUrl?: string | null;
  teamName?: string | null;
  message: string;
  action?: 'CHECK_IN' | 'CHECK_OUT';
  status?: 'NORMAL' | 'LATE' | 'REPEAT' | 'CHECK_OUT';
  workMinutes?: number;
}

interface Props {
  result: ResultPayload | null;
}

function successCaption(result: ResultPayload): string {
  if (result.action === 'CHECK_OUT') return '签退成功';
  if (result.status === 'LATE') return '签到成功（迟到）';
  return '签到成功';
}

function SuccessOverlay({ result }: { result: ResultPayload }) {
  const src = avatarSrc(result.avatarUrl);
  const initial = result.name?.charAt(0) || '?';
  const caption = successCaption(result);

  return (
    <div className="result-success-overlay" role="status" aria-live="polite">
      <div className="result-success-overlay__content">
        <div className="result-success-overlay__avatar-wrap">
          {src ? (
            <img className="result-success-overlay__avatar" src={src} alt={result.name || ''} />
          ) : (
            <div className="result-success-overlay__avatar result-success-overlay__avatar--fallback">
              {initial}
            </div>
          )}
          <CheckCircleFilled className="result-success-overlay__check" aria-hidden />
        </div>
        {result.name && <div className="result-success-overlay__name">{result.name}</div>}
        <div className="result-success-overlay__caption">{caption}</div>
        {result.action === 'CHECK_OUT' && result.workMinutes != null && (
          <div className="result-success-overlay__sub">今日工时 {result.workMinutes} 分钟</div>
        )}
        {result.teamName && (
          <div className="result-success-overlay__team">{result.teamName}</div>
        )}
      </div>
    </div>
  );
}

function statusLabel(status?: ResultPayload['status']) {
  if (status === 'LATE') return <Tag color="warning">迟到</Tag>;
  if (status === 'REPEAT') return <Tag>已签到</Tag>;
  if (status === 'CHECK_OUT') return <Tag color="success">签退</Tag>;
  if (status === 'NORMAL') return <Tag color="success">签到</Tag>;
  return null;
}

export default function CheckInResultOverlay({ result }: Props) {
  if (!result) return null;

  if (result.kind === 'success') {
    return <SuccessOverlay result={result} />;
  }

  return (
    <div className={`result-card result-card--${result.kind}`} role="status" aria-live="polite">
      {result.name && <div className="result-card__name">{result.name}</div>}
      <div className="result-card__message">{result.message}</div>
      {(result.teamName || result.status) && (
        <div className="result-card__meta">
          {result.teamName && <span className="result-card__team">{result.teamName}</span>}
          {statusLabel(result.status)}
        </div>
      )}
    </div>
  );
}
