import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { teamWorkflowApi, type TeamCreationRequest } from '../../../api/teamWorkflow';

interface Props {
  onChanged?: () => void;
}

export default function TeamApplicationsPanel({ onChanged }: Props) {
  const [data, setData] = useState<TeamCreationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<TeamCreationRequest | null>(null);
  const [action, setAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await teamWorkflowApi.pendingApplications());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openReview = (row: TeamCreationRequest, act: 'APPROVED' | 'REJECTED') => {
    setReviewTarget(row);
    setAction(act);
    setComment('');
  };

  const submitReview = async () => {
    await teamWorkflowApi.reviewApplication(reviewTarget!.id, {
      status: action,
      reviewComment: comment || undefined,
    });
    message.success(action === 'APPROVED' ? '已批准，团队已创建' : '已驳回');
    setReviewTarget(null);
    await load();
    onChanged?.();
  };

  const columns: ColumnsType<TeamCreationRequest> = [
    { title: '团队名称', dataIndex: 'name' },
    {
      title: '申请人',
      render: (_, r) => `${r.applicant?.name}（${r.applicant?.username}）`,
    },
    { title: '说明', dataIndex: 'description', render: (v) => v || '—', ellipsis: true },
    { title: '申请理由', dataIndex: 'reason', ellipsis: true },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      width: 160,
      render: (_, r) => (
        <>
          <Button type="link" size="small" onClick={() => openReview(r, 'APPROVED')}>
            批准
          </Button>
          <Button type="link" size="small" danger onClick={() => openReview(r, 'REJECTED')}>
            驳回
          </Button>
        </>
      ),
    },
  ];

  return (
    <>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={data} locale={{ emptyText: '暂无待审申请' }} />

      <Modal
        title={action === 'APPROVED' ? `批准创建「${reviewTarget?.name}」` : `驳回申请「${reviewTarget?.name}」`}
        open={!!reviewTarget}
        onOk={submitReview}
        onCancel={() => setReviewTarget(null)}
      >
        <p style={{ marginBottom: 8, color: '#666' }}>
          申请人：{reviewTarget?.applicant?.name}（{reviewTarget?.applicant?.username}）
        </p>
        <Input.TextArea
          rows={3}
          placeholder="审核意见（可选）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Modal>
    </>
  );
}
