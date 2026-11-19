// V1-B Child View (approved design 9de1df2, screen "childview";
// docs/engineering/V1-B-DESIGN.md §3). Choosing a reward is a request (owner
// decision D5): this page never spends points, and it has no parent Edit or
// visibility controls (D8). A parent agrees from Home. The "Saved towards"
// tile and "My next big adventure" wait for the savings ledger (D1).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { requestReward } from '@/lib/points';
import { Child, Reward } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { childOrder } from '@/lib/childColour';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Logo from '@/components/brand/Logo';
import RewardIcon from '../components/rewards/RewardIcon';
import { FamilyStrip } from '../components/home/HomeSections';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorCard from '../components/ErrorCard';

const pointsWord = (n) => (n === 1 ? 'point' : 'points');

// What one reward row shows, first match wins (design §3): a request already
// made, then affordable, then how many more points are needed.
export function rewardState(reward, child) {
  const requested = (child.reward_stack_priced || []).some((item) => item.rewardId === reward.id);
  if (requested) return { kind: 'requested' };
  const available = child.available_points ?? child.total_points ?? 0;
  if (available >= reward.cost_points) return { kind: 'ask' };
  return { kind: 'need', more: reward.cost_points - available };
}

// The rewards this child may choose: visible and assigned to them, plus any
// they already asked for (still set aside, even if hidden since), cheapest first.
export function childRewards(rewards, child) {
  const asked = new Set((child.reward_stack_priced || []).map((item) => item.rewardId));
  return rewards
    .filter((r) => {
      const assigned = !r.assigned_child_ids || r.assigned_child_ids.length === 0 || r.assigned_child_ids.includes(child.id);
      return assigned && (r.visible_to_child !== false || asked.has(r.id));
    })
    .sort((a, b) => a.cost_points - b.cost_points);
}

export default function ChildView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [childId, setChildId] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('child'); } catch { return null; }
  });
  // Requests in flight, keyed child:reward. A ref, so a second tap in the same
  // frame sees the first; held until fresh data has arrived (design §3).
  const inFlight = useRef(new Set());
  const [pending, setPending] = useState([]);

  // A parent may agree on another device: look again when the child comes back.
  const { data: children = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
    refetchOnWindowFocus: true,
  });
  const { data: allRewards = [], isLoading: rewardsLoading, isError: rewardsError, refetch: refetchRewards } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => Reward.list(),
    enabled: !!user,
  });
  // Rows whose request could not be confirmed by fresh data stay locked until
  // the next successful load (code review of #61: no window for a duplicate).
  const unconfirmed = useRef(new Set());
  useEffect(() => {
    if (!unconfirmed.current.size) return;
    for (const key of unconfirmed.current) inFlight.current.delete(key);
    unconfirmed.current.clear();
    setPending([...inFlight.current]);
  }, [dataUpdatedAt]);
  // After a request the button is replaced: focus moves to the row's caption.
  const captions = useRef({});
  const [focusKey, setFocusKey] = useState(null);
  useEffect(() => {
    if (focusKey && captions.current[focusKey]) { captions.current[focusKey].focus(); setFocusKey(null); }
  });
  // One polite announcement for a request, not a live region per row.
  const [announce, setAnnounce] = useState('');

  if (isLoading) return <div className="min-h-screen p-6"><LoadingSpinner message="Loading..." /></div>;

  if (children.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <Logo size={48} decorative className="mb-4" />
            <h2 className="text-title font-semibold text-foreground mb-2">Welcome!</h2>
            <p className="text-muted-foreground">Add a child on the Home screen to get started.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ordered = [...children].sort(childOrder);
  const child = ordered.find((c) => c.id === childId) || ordered[0];
  const available = child.available_points ?? child.total_points ?? 0;
  const rewards = childRewards(allRewards, child);

  const ask = async (reward) => {
    const key = child.id + ':' + reward.id;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setPending([...inFlight.current]);
    let asked = false;
    try {
      await requestReward(child.id, reward.id);
      asked = true;
    } catch (e) {
      toast.error(e.status === 400 && e.message ? e.message : "Couldn't update points. Please try again.");
    }
    // Release only once the row can show what the server now holds.
    await queryClient.refetchQueries({ queryKey: ['children'] }).catch(() => {});
    if (queryClient.getQueryState(['children'])?.status === 'error') {
      unconfirmed.current.add(key);
      return;
    }
    inFlight.current.delete(key);
    setPending([...inFlight.current]);
    if (asked) {
      setAnnounce(`${reward.title}: Ready when a parent agrees`);
      setFocusKey(key);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
        <Link to={createPageUrl('ParentDashboard')} className="inline-flex items-center min-h-11 text-sm font-semibold text-primary underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          ← Back to Home
        </Link>
        <div>
          <h1 className="font-display font-extrabold text-title text-primary">My Percy adventure</h1>
          <p className="text-muted-foreground">A child-friendly view of goals, points and rewards. No independent child account.</p>
        </div>
        <FamilyStrip children={ordered} selectedId={child.id} onSelect={setChildId} />

        <Card>
          <CardContent className="p-4 sm:p-5 space-y-3">
            <h2 className="font-display font-bold text-lg text-primary break-words">You're doing great, {child.name}!</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border p-3">
                <p className="font-display font-extrabold text-title text-foreground tabular-nums">{available}</p>
                <p className="text-sm font-medium text-muted-foreground">Ready to use</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5 space-y-3">
            <h2 className="font-display font-bold text-lg text-primary">Rewards I can choose</h2>
            <p className="sr-only" role="status">{announce}</p>
            {rewardsLoading ? (
              <LoadingSpinner message="Loading..." />
            ) : rewardsError ? (
              <ErrorCard message="Couldn't load rewards" onRetry={refetchRewards} />
            ) : rewards.length === 0 ? (
              <p className="text-muted-foreground">No rewards created yet.</p>
            ) : (
              <ul className="space-y-2">
                {rewards.map((reward) => {
                  const state = rewardState(reward, child);
                  const busy = pending.includes(child.id + ':' + reward.id);
                  const cost = `${reward.cost_points} ${pointsWord(reward.cost_points)}`;
                  return (
                    <li key={reward.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
                      <RewardIcon reward={reward} size="md" />
                      <div className="flex-1 min-w-[10rem]">
                        <p className="font-semibold text-foreground break-words">{reward.title}</p>
                        <p className="text-sm text-muted-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={-1}
                          ref={(el) => { captions.current[child.id + ':' + reward.id] = el; }}>
                          {state.kind === 'requested' ? `${cost} · Ready when a parent agrees`
                            : state.kind === 'ask' ? `${cost} · Ask a parent` : cost}
                        </p>
                      </div>
                      {state.kind === 'ask' && (
                        <Button className="ml-auto shrink-0" disabled={busy} aria-label={`Ask a parent for ${reward.title}`} onClick={() => ask(reward)}>
                          Ask a parent
                        </Button>
                      )}
                      {state.kind === 'need' && (
                        <Button variant="outline" className="ml-auto shrink-0" disabled>Need {state.more} more</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-sm text-muted-foreground">Choosing a reward is a request. Only a parent-authorised confirmation can spend points.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
