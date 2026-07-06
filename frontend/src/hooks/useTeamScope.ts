import { useCallback, useEffect, useState } from 'react';
import { teamsApi, type MyTeamItem } from '../api/teams';
import { useAuth } from '../store/AuthContext';

const STORAGE_KEY = 'campus-checkin-active-team-id';

export function useTeamScope() {
  const { user, refresh } = useAuth();
  const isLeader = user?.role === 'LEADER';
  const isUser = user?.role === 'USER';
  const canUse = isLeader || isUser;
  const [teams, setTeams] = useState<MyTeamItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTeamId, setActiveTeamIdState] = useState<number | undefined>();

  const refreshTeams = useCallback(async () => {
    if (!canUse) {
      setTeams([]);
      setActiveTeamIdState(undefined);
      return;
    }
    setLoading(true);
    try {
      const list = await teamsApi.myTeams();
      setTeams(list);
      const stored = localStorage.getItem(STORAGE_KEY);
      const storedId = stored ? Number(stored) : undefined;
      const validStored = storedId && list.some((t) => t.id === storedId) ? storedId : undefined;
      const nextId = validStored ?? list[0]?.id;
      setActiveTeamIdState(nextId);
      if (nextId) {
        localStorage.setItem(STORAGE_KEY, String(nextId));
        if (user?.teamId !== nextId) {
          await teamsApi.setActiveTeam(nextId).catch(() => {});
          await refresh();
        }
      }
    } finally {
      setLoading(false);
    }
  }, [canUse, user?.teamId, refresh]);

  useEffect(() => {
    refreshTeams();
  }, [refreshTeams]);

  const setActiveTeamId = useCallback(
    async (id: number) => {
      setActiveTeamIdState(id);
      localStorage.setItem(STORAGE_KEY, String(id));
      await teamsApi.setActiveTeam(id).catch(() => {});
      await refresh();
    },
    [refresh],
  );

  const activeTeam = teams.find((t) => t.id === activeTeamId);

  return {
    isLeader,
    isUser,
    canUse,
    teams,
    activeTeamId,
    activeTeam,
    setActiveTeamId,
    hasTeams: teams.length > 0,
    loading,
    refreshTeams,
  };
}
