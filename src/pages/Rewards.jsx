// V1-D reward catalogue (approved design 9de1df2, screen "rewards";
// docs/engineering/V1-D-DESIGN.md §4.1). "Bigger rewards" is not built: it
// needs explicit goal designation, which arrives with the savings design
// (owner decisions D1/D7).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Child, Reward } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useRewardMutations } from "@/hooks/useRewardMutations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Gift } from "lucide-react";
import PercyIcon from "@/components/icons/PercyIcon";
import { cn } from "@/lib/utils";

import Logo from "@/components/brand/Logo";
import { sortRewardsForParent } from "@/lib/rewardOrder";
import { REWARD_TEMPLATES } from "@/data/reward-templates";
import RewardTile from "../components/rewards/RewardTile";
import RewardForm from "../components/rewards/RewardForm";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorCard from "../components/ErrorCard";

const FIRST_REWARD = REWARD_TEMPLATES.find((template) => template.title === 'Extra Screen Time');
const FILTERS = [
  { key: 'all', label: 'All rewards', keep: () => true },
  { key: 'visible', label: 'Visible', keep: (r) => r.visible_to_child !== false },
  { key: 'hidden', label: 'Hidden', keep: (r) => r.visible_to_child === false },
];

// Moved to components (code review of #61); re-exported for existing imports.
export { RewardTile };

export default function Rewards() {
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [starterTemplate, setStarterTemplate] = useState(null);
  const [filter, setFilter] = useState('all');

  const { data: rewards = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => Reward.list('-created_date'),
  });
  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
  });

  const { save, remove } = useRewardMutations();

  const openNew = (template = null) => { setEditing(null); setStarterTemplate(template); setFormOpen(true); };
  const openEdit = (reward) => { setEditing(reward); setStarterTemplate(null); setFormOpen(true); };
  const close = () => { setFormOpen(false); setEditing(null); setStarterTemplate(null); };

  const submit = (data) => save(editing?.id, data);

  const shown = sortRewardsForParent(rewards).filter(FILTERS.find((f) => f.key === filter).keep);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="font-display font-extrabold text-title text-primary">Rewards</h1>
          <p className="text-muted-foreground">Choose little treats and bigger adventures together.</p>
        </div>

        {isLoading ? (
          <LoadingSpinner message="Loading rewards..." />
        ) : isError ? (
          <ErrorCard message="Couldn't load rewards" onRetry={refetch} />
        ) : rewards.length === 0 ? (
          <Card className="border-2 border-dashed border-input shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Logo size={48} decorative className="mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No rewards yet</h3>
              <p className="text-muted-foreground mb-4">Create rewards your children can work towards</p>
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Extra screen time is a suggested first reward. You choose its point cost and can edit or replace it.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={() => openNew(FIRST_REWARD)}>
                  <Gift className="w-4 h-4" />
                  Start with screen time
                </Button>
                <Button variant="outline" onClick={() => openNew()}>Create another reward</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display font-bold text-lg text-primary">Your reward catalogue</h2>
                <Button onClick={() => openNew()}>
                  <PercyIcon id="phosphor:plus-circle:duotone" className="h-5 w-5" />
                  New reward
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">For the whole family or selected children. You control what children can see.</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Show rewards">
                {FILTERS.map((f) => (
                  <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
                    className={cn('min-h-11 rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      filter === f.key ? 'border-2 border-selected-border bg-selected text-primary' : 'border border-border bg-card text-foreground hover:bg-accent')}>
                    {f.label}
                  </button>
                ))}
              </div>
              {shown.length === 0 ? (
                <p className="text-muted-foreground">No rewards match this filter.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {shown.map((reward) => <RewardTile key={reward.id} reward={reward} onEdit={openEdit} />)}
                </div>
              )}
              <div className="flex justify-end">
                <Button asChild variant="outline">
                  <Link to={createPageUrl('ChildView')}>View child reward choices</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <RewardForm
        isOpen={formOpen}
        onClose={close}
        reward={editing}
        initialTemplate={starterTemplate}
        children={children}
        onSubmit={submit}
        onDelete={async (reward) => { if (await remove(reward)) close(); }}
      />
    </div>
  );
}
