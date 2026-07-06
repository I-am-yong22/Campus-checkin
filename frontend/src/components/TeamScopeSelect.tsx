import { Select } from 'antd';
import type { ManagedTeam } from '../api/teams';

interface TeamScopeSelectProps {
  teams: ManagedTeam[] | { id: number; name: string }[];
  value?: number;
  onChange: (teamId: number) => void;
  loading?: boolean;
  style?: React.CSSProperties;
}

export default function TeamScopeSelect({ teams, value, onChange, loading, style }: TeamScopeSelectProps) {
  return (
    <Select
      style={{ width: '100%', ...style }}
      value={value}
      onChange={onChange}
      loading={loading}
      options={teams.map((t) => ({
        value: t.id,
        label: 'memberCount' in t ? `${t.name}（${t.memberCount} 人）` : t.name,
      }))}
      placeholder="请选择团队"
    />
  );
}
