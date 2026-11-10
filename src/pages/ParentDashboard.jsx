import { useState, useEffect, useRef } from 'react';
import { Child, Reward } from "@/api/entities";
import { awardPoints, refreshPoints } from "@/lib/points";
import { buildChildCreatePayload } from "@/lib/childPayload";
import { useAuth } from "@/lib/AuthContext";
import { getToken } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { format } from "date-fns";

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

const DEFAULT_QUICK_ACTIONS = [
  { id: 'default-1', label: "Kindness", points: 5, icon: "💛", category: "Kindness", assigned_children: [] },
  { id: 'default-2', label: "Helpfulness", points: 5, icon: "🤝", category: "Helpfulness", assigned_children: [] },
  { id: 'default-3', label: "Bravery", points: 10, icon: "🦁", category: "Bravery", assigned_children: [] },
  { id: 'default-4', label: "Caring", points: 5, icon: "🫶", category: "Caring", assigned_children: [] },
];

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

  // Fall back to defaults if no categories have quick action enabled
  const allQuickActions = categoryQuickActions.length > 0
    ? categoryQuickActions
    : DEFAULT_QUICK_ACTIONS;

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
      toast.success("Child added successfully!");
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
    toast.success(`${data.name}'s profile updated!`);
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
  const showStreak = (result) => {
    if (!result) return;
    setStreak(result.streak);
    if (result.milestone) {
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 },
        colors: ['#f59e0b', '#ef4444', '#f97316'] });
      toast.success(`${result.streak}-day streak! You're on fire!`);
    }
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
      if (capped) {
        toast.warning(`${child.name} only had ${Math.abs(event.points)} points, so ${Math.abs(event.points)} were taken away.`);
      } else {
        toast.success(points > 0 ? `+${points} ${category} for ${child.name}` : `${points} points for ${child.name}`);
      }
      // This week from history; a replay carries no figures, so no confetti.
      const wasBelow = typeof weekBefore === 'number' && weekBefore < updated.weekly_target;
      const isNowAbove = typeof weekAfter === 'number' && updated.weekly_target > 0 && weekAfter >= updated.weekly_target;
      if (points > 0 && wasBelow && isNowAbove) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#a855f7', '#ec4899', '#22c55e', '#3b82f6', '#f59e0b'],
        });
        toast.success(`${child.name} hit their weekly goal!`);
      }
      // A replayed award (first reply lost) carries no streak; read it instead.
      if (duplicate) updateStreak(); else showStreak(streakResult);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
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
          <Card className="border-2 border-dashed border-slate-300">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No children added yet
              </h3>
              <p className="text-slate-500 mb-4">
                Add your first child to start tracking their progress
              </p>
              <Button
                onClick={() => setShowAddChild(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Your First Child
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {children.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
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
            <SectionHeader icon="📋">Recent Activity</SectionHeader>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {recentActivity.map((event) => {
                    const isEarn = event.type === 'earn';
                    const isSpend = event.type === 'spend';
                    const isDeduct = !isEarn && !isSpend && event.points < 0;
                    const colorClass = isEarn ? 'text-green-600' : isSpend ? 'text-orange-600' : isDeduct ? 'text-red-600' : 'text-slate-500';
                    const action = isEarn ? 'earned' : isSpend ? 'spent on' : isDeduct ? 'lost' : 'adjusted';
                    const eventChild = children.find(c => c.id === event.child_id);

                    return (
                      <div key={`${event.type}-${event.id}`} className="flex items-center gap-3 px-4 py-3">
                        {/* Child avatar */}
                        {eventChild?.avatar_url ? (
                          <img src={eventChild.avatar_url} alt={event.child_name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(event.child_name || '?').charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">
                            <span className="font-semibold text-slate-800">{event.child_name}</span>
                            {' '}<span className="text-slate-500">{action}</span>{' '}
                            <span className="font-medium text-slate-700">{event.label}</span>
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {format(new Date(event.created_date), "MMM d, h:mm a")}
                          </p>
                        </div>
                        <span className={`text-sm font-bold shrink-0 ${colorClass}`}>
                          {isEarn ? '+' : (isSpend || event.points < 0) ? '−' : '+'}{Math.abs(event.points)}pts
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
