import { useState, useEffect } from 'react';
import { Child, Point_Event, Reward } from "@/api/entities";
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

  // Server-side weekly reset on mount
  useEffect(() => {
    if (!user) return;
    const token = getToken();
    fetch('/api/children/weekly-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }).then(res => res.json()).then(result => {
      if (result.reset && result.children_reset > 0) {
        queryClient.invalidateQueries(['children']);
        toast.info("Weekly points have been reset!");
      }
    }).catch(() => {});
  }, [user]);

  const { data: children = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['children'],
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
      queryClient.invalidateQueries(['children']);
      toast.success("Child added successfully!");
    },
  });

  const updateChildMutation = useMutation({
    mutationFn: ({ id, data }) => Child.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['children']);
    },
  });

  const createPointEventMutation = useMutation({
    mutationFn: (data) => Point_Event.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['children']);
      queryClient.invalidateQueries(['recentActivity']);
      queryClient.invalidateQueries(['activityFeed']);
      toast.success("Points updated!");
    },
  });

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
      queryClient.invalidateQueries(['children']);
      toast.success(`${child.name} has been removed`);
    } catch {
      toast.error("Failed to delete child");
    }
  };

  const updateStreak = async () => {
    const token = getToken();
    try {
      const res = await fetch('/api/family/check-streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setStreak(data.streak);
      if (data.updated && [7, 14, 30, 60, 100].includes(data.streak)) {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 },
          colors: ['#f59e0b', '#ef4444', '#f97316'] });
        toast.success(`${data.streak}-day streak! You're on fire!`);
      }
    } catch {}
  };

  useEffect(() => {
    if (user) updateStreak();
  }, [user]);

  const handlePointsSubmit = async (data) => {
    if (data.points < 0) {
      const newTotal = selectedChild.total_points + data.points;
      if (newTotal < 0) {
        toast.warning(`This will reduce ${selectedChild.name}'s points to 0`);
      }
    }

    await createPointEventMutation.mutateAsync({
      child_id: selectedChild.id,
      child_name: selectedChild.name,
      points: data.points,
      category: data.category,
      note: data.note,
    });

    const token = getToken();
    const res = await fetch(`/api/children/${selectedChild.id}/adjust-points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ points: data.points }),
    });

    if (data.points > 0) {
      const updated = await res.json();
      const wasBelow = selectedChild.weekly_points < selectedChild.weekly_target;
      const isNowAbove = updated.weekly_points >= updated.weekly_target;
      if (wasBelow && isNowAbove) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#a855f7', '#ec4899', '#22c55e', '#3b82f6', '#f59e0b'],
        });
        toast.success(`${selectedChild.name} hit their weekly goal!`);
      }
    }

    queryClient.invalidateQueries(['children']);
    queryClient.invalidateQueries(['recentActivity']);
    updateStreak();

    if (data.points > 0) {
      try {
        const badgeToken = getToken();
        await fetch(`/api/children/${selectedChild.id}/check-badges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${badgeToken}` },
        });
      } catch {}
    }
  };

  const handleQuickAction = async (child, action) => {
    try {
      await createPointEventMutation.mutateAsync({
        child_id: child.id,
        child_name: child.name,
        points: action.points,
        category: action.category || action.label,
        note: '',
      });

      const token = getToken();
      const res = await fetch(`/api/children/${child.id}/adjust-points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ points: action.points }),
      });

      const updated = await res.json();
      const wasBelow = child.weekly_points < child.weekly_target;
      const isNowAbove = updated.weekly_points >= updated.weekly_target;
      if (wasBelow && isNowAbove) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#a855f7', '#ec4899', '#22c55e', '#3b82f6', '#f59e0b'],
        });
        toast.success(`${child.name} hit their weekly goal!`);
      }

      queryClient.invalidateQueries(['children']);
      queryClient.invalidateQueries(['recentActivity']);
      updateStreak();

      try {
        await fetch(`/api/children/${child.id}/check-badges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        });
      } catch {}
    } catch {
      toast.error("Failed to award points");
    }
  };

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
                    const colorClass = isEarn ? 'text-green-600' : isSpend ? 'text-orange-600' : 'text-slate-500';
                    const action = isEarn ? 'earned' : isSpend ? 'spent on' : 'adjusted';
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
                          {isEarn ? '+' : isSpend ? '-' : ''}{Math.abs(event.points)}pts
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
