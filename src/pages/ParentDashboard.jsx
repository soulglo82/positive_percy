import React, { useState, useEffect } from 'react';
import { Child, Point_Event, Reward } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { getToken } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Flame, Plus, Minus, Gift } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { motion } from "framer-motion";

import ChildCard from "../components/child/ChildCard";
import AddChildModal from "../components/child/AddChildModal";
import EditChildModal from "../components/child/EditChildModal";
import AddPointsModal from "../components/child/AddPointsModal";
import OnboardingTips, { shouldShowOnboarding } from "../components/OnboardingTips";
import FamilyGoals from "../components/FamilyGoals";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorCard from "../components/ErrorCard";

const DEFAULT_QUICK_ACTIONS = [
  { id: 'default-1', label: "Kindness", points: 5, icon: "⭐", category: "Kindness" },
  { id: 'default-2', label: "Homework", points: 10, icon: "📚", category: "Homework" },
  { id: 'default-3', label: "Chores", points: 5, icon: "🧹", category: "Chores" },
  { id: 'default-4', label: "Manners", points: 5, icon: "🤝", category: "Good Manners" },
];

export default function ParentDashboard() {
  const { user } = useAuth();
  const [showAddChild, setShowAddChild] = useState(false);
  const [showEditChild, setShowEditChild] = useState(false);
  const [showAddPoints, setShowAddPoints] = useState(false);
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

  // Fetch quick actions from DB
  const { data: quickActions } = useQuery({
    queryKey: ['quickActions'],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch('/api/quick-actions', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  // Use DB quick actions if available, otherwise defaults
  const activeQuickActions = (quickActions && quickActions.length > 0)
    ? quickActions.map(qa => ({ ...qa, category: qa.label }))
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
    mutationFn: (data) => Child.create({
      name: data.name,
      avatar_url: data.avatar_url,
      total_points: data.startingPoints || 0,
      weekly_points: data.startingPoints || 0,
      weekly_target: data.weeklyTarget,
      last_reset_date: new Date().toISOString().split('T')[0],
    }),
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
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Add Points Section Header */}
        <h2 className="text-xl font-semibold text-slate-800" style={{ marginBottom: '-16px' }}>
          Add Points
        </h2>

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
                quickActions={activeQuickActions}
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
            <h2 className="text-lg font-semibold text-slate-800 mb-3">Recent Activity</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {recentActivity.map((event) => {
                    const isEarn = event.type === 'earn';
                    const isSpend = event.type === 'spend';
                    const icon = isEarn ? '⭐' : isSpend ? '🎁' : '⚙️';
                    const colorClass = isEarn ? 'text-green-600' : isSpend ? 'text-orange-600' : 'text-slate-500';

                    return (
                      <div key={`${event.type}-${event.id}`} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-lg">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-slate-700">{event.label}</span>
                          <span className="text-xs text-slate-400 ml-2">
                            {event.child_name} · {format(new Date(event.created_date), "MMM d")}
                          </span>
                        </div>
                        <span className={`text-sm font-bold ${colorClass}`}>
                          {event.points > 0 ? '+' : ''}{event.points} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Family Goals */}
        {children.length > 0 && <FamilyGoals />}

        {/* Add Child Button */}
        {children.length > 0 && (
          <div className="flex justify-center">
            <Button
              onClick={() => setShowAddChild(true)}
              variant="outline"
              className="border-2 border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400 px-8 py-6"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Add Child
            </Button>
          </div>
        )}

        {/* Branding Footer */}
        <div className="flex flex-col items-center gap-2 pt-4 pb-8">
          <img
            src="/logo.png"
            alt="Positive Percy"
            className="h-16 opacity-60"
          />
          <p className="text-sm text-slate-400">Building bright futures, one point at a time</p>
          {streak > 0 && (
            <Badge className="bg-gradient-to-r from-orange-400 to-red-500 text-white border-0 text-sm px-3 py-1.5 flex items-center gap-1.5">
              <Flame className="w-4 h-4" />
              {streak}-day streak
            </Badge>
          )}
        </div>
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

      <OnboardingTips
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
}
