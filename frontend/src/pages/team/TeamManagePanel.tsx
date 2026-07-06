import LeaderTeamWorkflow from '../LeaderTeamWorkflow';

interface Props {
  applyOnly?: boolean;
}

export default function TeamManagePanel({ applyOnly }: Props) {
  return <LeaderTeamWorkflow embedded applyOnly={applyOnly} />;
}
