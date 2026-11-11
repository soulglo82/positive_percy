import { useState, useEffect, useRef } from 'react';
import { Child, Reward } from "@/api/entities";
import { awardPoints, refreshPoints, undoAction, UNDO_TOAST_MS } from "@/lib/points";
import { buildChildCreatePayload } from "@/lib/childPayload";
import { useAuth } from "@/lib/AuthContext";
import { getToken } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, ClipboardList } from "lucide-react";
import Logo from "@/components/brand/Logo";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { format } from "date-fns";
import { CONFETTI_COLORS } from "@/lib/tokens";
import ChildAvatar from "../components/child/ChildAvatar";
import { childColour } from "@/lib/childColour";

import SectionHeader from "../components/SectionHeader";
import ChildCard from "../components/child/ChildCard";
import AddChildModal from "../components/child/AddChildModal";
import EditChildModal from "../components/child/EditChildModal";
import AddPointsModal from "../components/child/AddPointsModal";
import SpendRewardsModal from "../components/child/SpendRewardsModal";
import OnboardingTips, { shouldShowOnboarding } from "../components/OnboardingTips";
import HeroCard from "../components/dashboard/HeroCard";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorCard from "../components/ErrorCard";

export default function ParentDashboard() {
  const { user } = useAuth();
  const [showAddChild, setShowAddChild] = useState(false);
  const [showEditChild, setShowEditChild] = useState(false);
  const [showAddPoints, setShowAddPoints] = useState(false);
  const [showSpendRewards, setShowSpendRewards] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [streak, setStreak] = useState(0);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && shouldShowOnboarding()) {
      setShowOnboarding(true);
    }
  }, [user]);

  // The family's timezone: filled in once from this browser if it was never
  // set. The server ignores it otherwise (A2 W1).
  useEffect(() => {
    if (!user) return;
    let tz;
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return; }
    if (!tz) return;
    fetch('/api/family/timezone', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ timezone: tz, auto: true }),
    }).catch(() => {});
  }, [user]);

  const { data: children = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['children'],
    // A dashboard left open rolls into the new week when looked at again.
    refetchOnWindowFocus: true,
    queryFn: () => Child.list(),
    enabled: !!user,
  });

  const { data: rewards = [] } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => Reward.list(),
    enabled: !!user,
  });

  // Fetch behavior categories (quick actions are now derived from categories)
  const { data: behaviorCategories } = useQuery({
    queryKey: ['behaviorCategories'],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch('/api/behavior-categories', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  // Derive quick actions from categories with is_quick_action=true
  const categoryQuickActions = (behaviorCategories || [])
    .filter(c => c.is_quick_action)
    .map(c => ({ id: c.id, label: c.name, points: c.points || 5, icon: c.icon, category: c.name, assigned_children: c.assigned_children || [] }));

  // Only the family's own ticked behaviours (A2 W4). None ticked: none shown,
  // and the card points to Settings (external review, 2026-11-11).
  const allQuickActions = categoryQuickActions;

  // Fetch recent activity feed
  const { data: recentActivity = [] } = useQuery({
    queryKey: ['recentActivity'],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch('/api/activity-feed?limit=5&filter=all', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const createChildMutation = useMutation({
    mutationFn: (data) => Child.create(buildChildCreatePayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      toast.success("Child added.");
    },
  });

  const updateChildMutation = useMutation({
    mutationFn: ({ id, data }) => Child.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });

  // Children with an award in flight. A ref, not state, so a second tap in
  // the same frame sees the first one and is ignored.
  const awarding = useRef(new Set());
  // Which child's star pops: set only by an award from this device.
  const [pop, setPop] = useState({ childId: null, n: 0 });
  const [awardingIds, setAwardingIds] = useState([]);

  const handleAddPoints = (child) => {
    setSelectedChild(child);
    setShowAddPoints(true);
  };

  const handleSpendRewards = (child) => {
    setSelectedChild(child);
    setShowSpendRewards(true);
  };

  const handleEditChild = (child) => {
    setSelectedChild(child);
    setShowEditChild(true);
  };

  const handleEditChildSubmit = async (data) => {
    await updateChildMutation.mutateAsync({
      id: selectedChild.id,
      data: data,
    });
    toast.success(`${data.name}'s profile updated.`);
  };

  const handleDeleteChild = async (child) => {
    try {
      await Child.delete(child.id);
      queryClient.invalidateQueries({ queryKey: ['children'] });
      toast.success(`${child.name} has been removed`);
    } catch {
      toast.error("Failed to delete child");
    }
  };

  const updateStreak = async () => {
    const token = getToken();
    try {
      const res = await fetch('/api/family/streak', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setStreak(data.streak || 0);
    } catch {}
  };

  // The server records the streak inside the award; show what it returned.
  // Returns the line to add to the award's toast, if any.
  const showStreak = (result) => {
    if (!result) return null;
    setStreak(result.streak);
    if (result.milestone) {
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 },
        colors: CONFETTI_COLORS });
      return `${result.streak}-day streak.`;
    }
    return null;
  };

  useEffect(() => {
    if (user) updateStreak();
  }, [user]);

  // Shared by quick actions and the points form. Returns true if applied.
  const applyAward = async (child, { points, category, note }) => {
    if (awarding.current.has(child.id)) {
      toast.info(`Still saving ${child.name}'s last change…`);
      return false;
    }
    awarding.current.add(child.id);
    setAwardingIds([...awarding.current]);
    try {
      const { child: updated, capped, event, streak: streakResult, duplicate, week_points_before: weekBefore, week_points_after: weekAfter } = await awardPoints(child.id, { points, category, note });
      // One toast per award, with Undo for 10 seconds (A2 U3). The weekly
      // goal and a streak milestone are added to it, not shown separately.
      const lines = [capped
        ? `${child.name} only had ${Math.abs(event.points)} points, so ${Math.abs(event.points)} were taken away.`
        : points > 0 ? `+${points} ${category} for ${child.name}` : `${points} points for ${child.name}`];
      // This week from history; a replay carries no figures, so no confetti.
      const wasBelow = typeof weekBefore === 'number' && weekBefore < updated.weekly_target;
      const isNowAbove = typeof weekAfter === 'number' && updated.weekly_target > 0 && weekAfter >= updated.weekly_target;
      if (points > 0 && wasBelow && isNowAbove) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: CONFETTI_COLORS,
        });
        lines.push(`${child.name} hit their weekly goal.`);
      }
      // A replayed award (first reply lost) carries no streak; read it instead.
      if (duplicate) updateStreak(); else { const s = showStreak(streakResult); if (s) lines.push(s); }
      // Show the new total now (not one refetch later), then pop it. The short
      // wait lets the Add Points dialog close first so the pop is seen.
      queryClient.setQueryData(['children'], (old) => Array.isArray(old)
        ? old.map((c) => (c.id === updated.id ? { ...c, ...updated, week_points: typeof weekAfter === 'number' ? weekAfter : c.week_points } : c))
        : old);
      if (points > 0) setTimeout(() => setPop((p) => ({ childId: child.id, n: p.n + 1 })), 220);
      const show = capped ? toast.warning : toast.success;
      show(lines.join(' '), {
        duration: UNDO_TOAST_MS,
        action: { label: 'Undo', onClick: undoAction('award', event.id, queryClient) },
      });
      refreshPoints(queryClient);
      if (points > 0) {
        // After the lock is released: a slow badge check must not block taps.
        // Its own broadcast refreshes the screen when badges change.
        setTimeout(() => {
          fetch(`/api/children/${child.id}/check-badges`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
          }).then(() => refreshPoints(queryClient)).catch(() => {});
        }, 0);
      }
      return true;
    } catch (err) {
      toast.error(err.status === 400 && err.message ? err.message : "Couldn't update points. Please try again.");
      return false;
    } finally {
      awarding.current.delete(child.id);
      setAwardingIds([...awarding.current]);
    }
  };

  const handlePointsSubmit = (data) => applyAward(selectedChild, data);

  const handleQuickAction = (child, action) =>
    applyAward(child, { points: action.points, category: action.category || action.label, note: '' });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        <HeroCard
          children={children}
          streak={streak}
          onAddFirstChild={() => setShowAddChild(true)}
        />

        {/* Children Grid */}
        {isLoading ? (
          <LoadingSpinner message="Loading your family..." />
        ) : isError ? (
          <ErrorCard message="Couldn't load children" onRetry={refetch} />
        ) : children.length === 0 ? (
          <Card className="border-2 border-dashed border-input shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Logo size={48} decorative className="mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No children added yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Add your first child to start tracking their progress
              </p>
              <Button onClick={() => setShowAddChild(true)}>
                <UserPlus className="w-4 h-4" />
                Add Your First Child
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={
            children.length === 1 ? "grid grid-cols-1 gap-6 max-w-xl"
              : children.length === 2 ? "grid grid-cols-1 md:grid-cols-2 gap-6"
              : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          }>
            {children.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                colour={childColour(child, children)}
                popKey={pop.childId === child.id ? pop.n : 0}
                onAddPoints={handleAddPoints}
                onEdit={handleEditChild}
                onQuickAction={handleQuickAction}
                awarding={awardingIds.includes(child.id)}
                onSpendRewards={handleSpendRewards}
                quickActions={allQuickActions.filter(qa =>
                  !qa.assigned_children || qa.assigned_children.length === 0 || qa.assigned_children.includes(child.id)
                )}
                rewards={rewards.filter(r =>
                  !r.assigned_child_ids || r.assigned_child_ids.length === 0 || r.assigned_child_ids.includes(child.id)
                )}
              />
            ))}
          </div>
        )}

        {/* Recent Activity Preview */}
        {recentActivity.length > 0 && (
          <div>
            <SectionHeader icon={ClipboardList}>Recent activity</SectionHeader>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {recentActivity.map((event) => {
                    const isEarn = event.type === 'earn';
                    const isSpend = event.type === 'spend';
                    const isUndo = event.type === 'undo';
                    const isDeduct = !isEarn && !isSpend && !isUndo && event.points < 0;
                    const colorClass = isEarn ? 'text-earn' : isSpend ? 'text-spend' : 'text-negative';
                    const action = isUndo ? 'undo:' : isEarn ? 'earned' : isSpend ? 'spent on' : isDeduct ? 'lost' : 'adjusted';
                    const eventChild = children.find(c => c.id === event.child_id);

                    return (
                      <div key={`${event.type}-${event.id}`} className="flex items-center gap-3 px-4 py-3">
                        {/* Child avatar */}
                        <ChildAvatar name={event.child_name} url={eventChild?.avatar_url} size="sm" colour={childColour(event.child_id, children)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">
                            <span className="font-semibold text-foreground">{event.child_name}</span>
                            {' '}<span className="text-muted-foreground">{action}</span>{' '}
                            <span className="font-medium text-foreground">{event.label}</span>
                          </p>
                          <p className="text-xs text-subtle-foreground mt-0.5">
                            {format(new Date(event.created_date), "MMM d, h:mm a")}
                          </p>
                        </div>
                        <span className={`text-sm font-semibold tabular-nums shrink-0 ${colorClass} ${event.undone ? 'line-through' : ''}`}>
                          {isEarn ? '+' : (isSpend || event.points < 0) ? '−' : '+'}{Math.abs(event.points)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      {/* Modals */}
      <AddChildModal
        isOpen={showAddChild}
        onClose={() => setShowAddChild(false)}
        onSubmit={(data) => createChildMutation.mutateAsync(data)}
      />

      <EditChildModal
        isOpen={showEditChild}
        onClose={() => {
          setShowEditChild(false);
          setSelectedChild(null);
        }}
        child={selectedChild}
        onSubmit={handleEditChildSubmit}
        onDelete={handleDeleteChild}
      />

      <AddPointsModal
        isOpen={showAddPoints}
        onClose={() => {
          setShowAddPoints(false);
          setSelectedChild(null);
        }}
        child={selectedChild}
        onSubmit={handlePointsSubmit}
      />

      <SpendRewardsModal
        isOpen={showSpendRewards}
        onClose={() => {
          setShowSpendRewards(false);
          setSelectedChild(null);
        }}
        child={selectedChild}
        rewards={rewards.filter(r =>
          !selectedChild || !r.assigned_child_ids || r.assigned_child_ids.length === 0 || r.assigned_child_ids.includes(selectedChild.id)
        )}
      />

      <OnboardingTips
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
}
