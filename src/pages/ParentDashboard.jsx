import { useState, useEffect, useRef } from 'react';
import { isAssignedTo } from "@/lib/assignment";
import { Child, Reward } from "@/api/entities";
import { awardPoints, refreshPoints, undoAction, UNDO_TOAST_MS } from "@/lib/points";
import { buildChildCreatePayload } from "@/lib/childPayload";
import { useAuth, NEW_FAMILY_WELCOME_KEY } from "@/lib/AuthContext";
import { getToken } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { CONFETTI_COLORS } from "@/lib/tokens";

import { childOrder } from "@/lib/childColour";
import { HomeHero, HomeQuickPoints, HomeWorkingTowards } from "../components/percy/HomeV11";
import AddChildModal from "../components/child/AddChildModal";
import AwardPointsDialog from "../components/home/AwardPointsDialog";
import WelcomeCard from "../components/home/WelcomeCard";
import SpendRewardsModal from "../components/child/SpendRewardsModal";
import OnboardingTips, { shouldShowOnboarding } from "../components/OnboardingTips";
import WelcomeFamilyDialog from "../components/WelcomeFamilyDialog";
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
  // Quick Points is the first card on Home, so the page waits for the first
  // load of the behaviours as it does for the children: otherwise the card
  // says "No quick points yet" for a moment and then swaps to the tiles.
  // Only the first attempt (with its one retry) holds the page back. If that
  // fails, the page is shown, and a later refetch must not take it away again
  // (it would close an open Manage goals dialog): hence the error count.
  const { data: behaviorCategories, isLoading: categoriesLoading, errorUpdateCount: categoriesErrors } = useQuery({
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

  const waitingForBehaviours = categoriesLoading && categoriesErrors === 0;

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
  // V1.1: Percy hops once after each award (the static file, moved whole).
  const [foxPlay, setFoxPlay] = useState(0);

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
        lines.push(`${child.name} hit their weekly target.`);
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
      if (points > 0) setFoxPlay((n) => n + 1);
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

  const handleQuickAction = (child, action) =>
    applyAward(child, { points: action.points, category: action.category || action.label, note: '' });

  // Oldest first, as in the approved design (and the colour order).
  const ordered = [...children].sort(childOrder);
  const homeChild = ordered.find((c) => c.id === homeChildId) || ordered[0];
  const homeActions = homeChild ? allQuickActions.filter((qa) =>
    !qa.assigned_children || qa.assigned_children.length === 0 || qa.assigned_children.includes(homeChild.id)) : [];

  return (
    <div className="min-h-screen bg-background">
        {isLoading ? (
          <div className="max-w-5xl mx-auto p-4 sm:p-6"><LoadingSpinner message="Loading your family..." /></div>
        ) : isError && children.length === 0 ? (
          // Only when there is nothing to show: a failed background refresh
          // must not replace the page and an open pop-up (V1-F §12 X27).
          <div className="max-w-5xl mx-auto p-4 sm:p-6"><ErrorCard message="Couldn't load children" onRetry={refetch} /></div>
        ) : waitingForBehaviours ? (
          <div className="max-w-5xl mx-auto p-4 sm:p-6"><LoadingSpinner message="Loading your family..." /></div>
        ) : children.length === 0 ? (
          <div className="max-w-5xl mx-auto p-4 sm:p-6"><WelcomeCard onAddFirstChild={() => setShowAddChild(true)} /></div>
        ) : (
          // V1.1 Home, the daily action centre (design/v11; owner review 23 Nov:
          // Quick Points sooner). Reading order: child, balance, Quick Points,
          // Daily Wins, then what the child is working towards.
          <div className="pv">
            <HomeHero children={ordered} child={homeChild} streak={streak} foxPlay={foxPlay}
              onSelect={setHomeChildId} />
            <div className="pv-columns">
              <div className="pv-col">
                <HomeQuickPoints child={homeChild} actions={homeActions} awarding={awardingIds.includes(homeChild.id)}
                  onAward={handleQuickAction} onOpenAward={() => handleAddPoints(homeChild)}
                  onOpenRewards={() => handleSpendRewards(homeChild)} />
              </div>
              <div className="pv-col">
                <TodaysGoalsPanel children={children} categories={behaviorCategories || []} enabled={!!user} selectedChildId={homeChild.id} />
                <HomeWorkingTowards child={homeChild} />
              </div>
            </div>
          </div>
        )}

      {/* Modals */}
      <AddChildModal
        isOpen={showAddChild}
        onClose={() => setShowAddChild(false)}
        onSubmit={(data) => createChildMutation.mutateAsync(data)}
      />

      <AwardPointsDialog
        isOpen={showAddPoints}
        onClose={() => {
          setShowAddPoints(false);
          setSelectedChild(null);
        }}
        children={ordered}
        categories={behaviorCategories || []}
        initialChildId={selectedChild?.id}
        onSubmit={applyAward}
      />

      <SpendRewardsModal
        isOpen={showSpendRewards}
        onClose={() => {
          setShowSpendRewards(false);
          setSelectedChild(null);
        }}
        child={ordered.find((c) => c.id === selectedChild?.id) || selectedChild}
        rewards={rewards.filter(r => !selectedChild || isAssignedTo(r, selectedChild.id))}
      />

      <WelcomeFamilyDialog
        familyCode={welcomeCode}
        onClose={() => setWelcomeCode(null)}
      />
      <OnboardingTips
        isOpen={showOnboarding && !welcomeCode}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
}
