import React, { useState } from 'react';
import { Child, Point_Event, Redemption } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Gift, History, RefreshCw, Award, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import ChildCard from "../components/child/ChildCard";
import AddChildModal from "../components/child/AddChildModal";
import EditChildModal from "../components/child/EditChildModal";
import AddPointsModal from "../components/child/AddPointsModal";
import RedemptionCard from "../components/redemptions/RedemptionCard";

export default function ParentDashboard() {
  const { user } = useAuth();
  const [showAddChild, setShowAddChild] = useState(false);
  const [showEditChild, setShowEditChild] = useState(false);
  const [showAddPoints, setShowAddPoints] = useState(false);
  const [showSubtractPoints, setShowSubtractPoints] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);

  const queryClient = useQueryClient();

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const childrenData = await Child.list();

      // Check for weekly reset (Monday)
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday
      const todayStr = today.toISOString().split('T')[0];

      for (const child of childrenData) {
        const lastReset = child.last_reset_date ? new Date(child.last_reset_date) : null;
        const shouldReset = !lastReset || (
          dayOfWeek === 1 && // It's Monday
          lastReset.toISOString().split('T')[0] !== todayStr // Haven't reset today
        );

        if (shouldReset && child.weekly_points > 0) {
          await Child.update(child.id, {
            weekly_points: 0,
            last_reset_date: todayStr,
          });
          child.weekly_points = 0;
          child.last_reset_date = todayStr;
        }
      }

      return childrenData;
    },
    enabled: !!user,
  });

  const { data: pendingRedemptions = [] } = useQuery({
    queryKey: ['pendingRedemptions'],
    queryFn: () => Redemption.filter({ status: 'Pending' }, '-created_date'),
    refetchInterval: 5000,
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

  const updateRedemptionMutation = useMutation({
    mutationFn: ({ id, data }) => Redemption.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['pendingRedemptions']);
      queryClient.invalidateQueries(['children']);
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

  const handlePointsSubmit = async (data) => {
    await createPointEventMutation.mutateAsync({
      child_id: selectedChild.id,
      child_name: selectedChild.name,
      points: data.points,
      category: data.category,
      note: data.note,
    });

    await updateChildMutation.mutateAsync({
      id: selectedChild.id,
      data: {
        total_points: selectedChild.total_points + data.points,
        weekly_points: selectedChild.weekly_points + data.points,
      },
    });
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

  const handleApproveRedemption = async (redemption) => {
    const child = children.find(c => c.id === redemption.child_id);
    if (!child) return;

    await updateRedemptionMutation.mutateAsync({
      id: redemption.id,
      data: { status: 'Approved' },
    });

    await updateChildMutation.mutateAsync({
      id: child.id,
      data: {
        total_points: child.total_points - redemption.reward_cost,
        weekly_points: Math.max(0, child.weekly_points - redemption.reward_cost),
      },
    });

    toast.success(`${redemption.child_name}'s request approved!`);
  };

  const handleDenyRedemption = async (redemption) => {
    await updateRedemptionMutation.mutateAsync({
      id: redemption.id,
      data: { status: 'Denied' },
    });
    toast.info("Request denied");
  };

  const totalPoints = children.reduce((sum, child) => sum + child.total_points, 0);
  const totalWeeklyPoints = children.reduce((sum, child) => sum + child.weekly_points, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6922d1673349deb31c162ae5/46a4a0d5e_82981AEC-56DC-4F47-88A7-BE6A182A15D7.png"
              alt="Positive Percy"
              className="h-20 mb-2"
            />
            <p className="text-slate-600">Building bright futures, one point at a time ✨</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowAddChild(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Child
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {children.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Total Children</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{children.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Total Points</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{totalPoints}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">This Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">{totalWeeklyPoints}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pending Redemptions */}
        {pendingRedemptions.length > 0 && (
          <Card className="border-2 border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <Award className="w-5 h-5" />
                Pending Reward Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingRedemptions.map((redemption) => (
                <RedemptionCard
                  key={redemption.id}
                  redemption={redemption}
                  onApprove={handleApproveRedemption}
                  onDeny={handleDenyRedemption}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Children Grid */}
        {children.length === 0 ? (
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
              />
            ))}
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
    </div>
  );
}
