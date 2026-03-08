import React, { useState, useEffect } from 'react';
import { Child, Point_Event, Reward } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { getToken } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, Flame } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { Badge } from "@/components/ui/badge";

import ChildCard from "../components/child/ChildCard";
import AddChildModal from "../components/child/AddChildModal";
import EditChildModal from "../components/child/EditChildModal";
import AddPointsModal from "../components/child/AddPointsModal";
import OnboardingTips, { shouldShowOnboarding } from "../components/OnboardingTips";
import FamilyGoals from "../components/FamilyGoals";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorCard from "../components/ErrorCard";

export default function ParentDashboard() {
  const { user } = useAuth();
  const [showAddChild, setShowAddChild] = useState(false);
  const [showEditChild, setShowEditChild] = useState(false);
  const [showAddPoints, setShowAddPoints] = useState(false);
  const [showSubtractPoints, setShowSubtractPoints] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [streak, setStreak] = useState(0);

  const queryClient = useQueryClient();

  // Show onboarding tips on first visit
  useEffect(() => {
    if (user && shouldShowOnboarding()) {
      setShowOnboarding(true);
    }
  }, [user]);

  // Server-side weekly reset on mount (BUG-002)
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
      toast.success("Points updated!");
    },
  });

  const handleAddPoints = (child) => {
    setSelectedChild(child);
    setShowAddPoints(true);
  };

  const handleSubtractPoints = (child) => {
    setSelectedChild(child);
    setShowSubtractPoints(true);
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

  // Load streak on mount
  useEffect(() => {
    if (user) updateStreak();
  }, [user]);

  // BUG-003: Use atomic server-side point adjustment
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
      // Check if child just hit their weekly goal
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
    updateStreak();

    // FEAT-010: Check badges after point change
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
        category: action.category,
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
      updateStreak();

      // Check badges
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

  const handleResetWeekly = async (child) => {
    await updateChildMutation.mutateAsync({
      id: child.id,
      data: {
        weekly_points: 0,
        last_reset_date: new Date().toISOString().split('T')[0],
      },
    });
    toast.success(`${child.name}'s weekly points reset!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <img
              src="/logo.png"
              alt="Positive Percy"
              className="h-20 mb-2"
            />
            <p className="text-slate-600">Building bright futures, one point at a time</p>
          </div>
          {streak > 0 && (
            <Badge className="bg-gradient-to-r from-orange-400 to-red-500 text-white border-0 text-sm px-3 py-1.5 flex items-center gap-1.5">
              <Flame className="w-4 h-4" />
              {streak}-day streak
            </Badge>
          )}
        </div>

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
                onSubtractPoints={handleSubtractPoints}
                onEdit={handleEditChild}
                onQuickAction={handleQuickAction}
              />
            ))}
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
        isSubtract={false}
      />

      <AddPointsModal
        isOpen={showSubtractPoints}
        onClose={() => {
          setShowSubtractPoints(false);
          setSelectedChild(null);
        }}
        child={selectedChild}
        onSubmit={handlePointsSubmit}
        isSubtract={true}
      />

      <OnboardingTips
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </div>
  );
}
