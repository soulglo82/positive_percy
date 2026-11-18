import { useState, useEffect, useRef } from 'react';
import { Child, Reward } from "@/api/entities";
import { awardPoints, refreshPoints, undoAction, UNDO_TOAST_MS } from "@/lib/points";
import { buildChildCreatePayload } from "@/lib/childPayload";
import { useAuth, NEW_FAMILY_WELCOME_KEY } from "@/lib/AuthContext";
import { getToken } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import Logo from "@/components/brand/Logo";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { CONFETTI_COLORS } from "@/lib/tokens";

import { childOrder } from "@/lib/childColour";
import { StreakStrip, FamilyStrip, LittleWins, WorkingTowards, QuickPoints } from "../components/home/HomeSections";
import AddChildModal from "../components/child/AddChildModal";
import AddPointsModal from "../components/child/AddPointsModal";
import SpendRewardsModal from "../components/child/SpendRewardsModal";
import OnboardingTips, { shouldShowOnboarding } from "../components/OnboardingTips";
import WelcomeFamilyDialog from "../components/WelcomeFamilyDialog";
import HeroCard from "../components/dashboard/HeroCard";
import TodaysGoalsPanel from "../components/dashboard/TodaysGoalsPanel";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorCard from "../components/ErrorCard";

export default function ParentDashboard() {
  const { user, familyCode } = useAuth();
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAddPoints, setShowAddPoints] = useState(false);
  const [showSpendRewards, setShowSpendRewards] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [welcomeCode, setWelcomeCode] = useState(null);
  const [streak, setStreak] = useState(0);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    // The signup view unmounts on successful authentication. Give brand-new
    // families one chance to copy their code and set a first reward instead.
    let pending = null;
    try { pending = sessionStorage.getItem(NEW_FAMILY_WELCOME_KEY); } catch {}
    if (pending && pending === familyCode) {
      try { sessionStorage.removeItem(NEW_FAMILY_WELCOME_KEY); } catch {}
      setWelcomeCode(pending);
      return;
    }
    if (shouldShowOnboarding()) setShowOnboarding(true);
  }, [user, familyCode]);

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
    .map(c => ({ id: c.id, label: c.name, points: c.points ?? 1, icon_key: c.icon_key, category: c.name, assigned_children: c.assigned_children || [] }));

  // Only the family's own ticked behaviours (A2 W4). None ticked: none shown,
  // and the card points to Settings (external review, 2026-11-11).
  const allQuickActions = categoryQuickActions;

  // V1: Recent Activity is no longer on Home (it lives in Activity).

  const createChildMutation = useMutation({
    mutationFn: (data) => Child.create(buildChildCreatePayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      toast.success("Child added.");
    },
  });

  // Children with an award in flight. A ref, not state, so a second tap in
  // the same frame sees the first one and is ignored.
  const awarding = useRef(new Set());
  const [awardingIds, setAwardingIds] = useState([]);
  // V1: the child selected in the family strip drives Goals, the summary,
  // Working towards and Quick Points.
  const [homeChildId, setHomeChildId] = useState(null);

  const handleAddPoints = (child) => {
    setSelectedChild(child);
    setShowAddPoints(true);
  };

  const handleSpendRewards = (child) => {
    setSelectedChild(child);
    setShowSpendRewards(true);
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
      const { child: updated, event, streak: streakResult, duplicate, week_points_before: weekBefore, week_points_after: weekAfter } = await awardPoints(child.id, { points, category, note });
      // One toast per award, with Undo for 10 seconds (A2 U3). The weekly
      // goal and a streak milestone are added to it, not shown separately.
      const lines = [`+${points} ${category} for ${child.name}`];
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
      toast.success(lines.join(' '), {
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

  // Oldest first, as in the approved design (and the colour order).
  const ordered = [...children].sort(childOrder);
  const homeChild = ordered.find((c) => c.id === homeChildId) || ordered[0];
  const homeActions = homeChild ? allQuickActions.filter((qa) =>
    !qa.assigned_children || qa.assigned_children.length === 0 || qa.assigned_children.includes(homeChild.id)) : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        {isLoading ? (
          <LoadingSpinner message="Loading your family..." />
        ) : isError ? (
          <ErrorCard message="Couldn't load children" onRetry={refetch} />
        ) : children.length === 0 ? (
          <>
            <HeroCard children={children} streak={streak} onAddFirstChild={() => setShowAddChild(true)} />
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
          </>
        ) : (
          <>
            <StreakStrip streak={streak} />
            <div>
              <h1 className="font-display font-extrabold text-title text-primary">Welcome back!</h1>
              <p className="text-muted-foreground">Good things are happening, one small step at a time.</p>
            </div>
            <FamilyStrip children={ordered} selectedId={homeChild.id} onSelect={setHomeChildId} />
            {/* The DOM is in reading order (Goals, Little wins, Working towards,
                Quick Points), so Tab and screen readers follow what phones
                show. Desktop places the same cards in two columns:
                Goals + Quick Points | Little wins + Working towards. */}
            <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
              <div className="lg:col-start-1 lg:row-start-1">
                <TodaysGoalsPanel children={children} categories={behaviorCategories || []} enabled={!!user} selectedChildId={homeChild.id} />
              </div>
              <div className="flex flex-col gap-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
                <LittleWins child={homeChild} />
                <WorkingTowards child={homeChild} />
              </div>
              <div className="lg:col-start-1 lg:row-start-2">
                <QuickPoints child={homeChild} actions={homeActions} awarding={awardingIds.includes(homeChild.id)}
                  onAward={handleQuickAction}
                  onOpenAward={() => handleAddPoints(homeChild)}
                  onOpenRewards={() => handleSpendRewards(homeChild)} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <AddChildModal
        isOpen={showAddChild}
        onClose={() => setShowAddChild(false)}
        onSubmit={(data) => createChildMutation.mutateAsync(data)}
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

      <WelcomeFamilyDialog
        familyCode={welcomeCode}
        onClose={() => setWelcomeCode(null)}
      />
      <OnboardingTips
        isOpen={showOnboarding && !welcomeCode}
        onClose={() => setShowOnboarding(false)}
        firstRun
      />
    </div>
  );
}
