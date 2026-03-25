import React, { useState } from 'react';
import { Child, Reward } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Gift } from "lucide-react";
import { toast } from "sonner";

import SectionHeader from "../components/SectionHeader";
import RewardCard from "../components/rewards/RewardCard";
import AddRewardModal from "../components/rewards/AddRewardModal";
import EditRewardModal from "../components/rewards/EditRewardModal";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorCard from "../components/ErrorCard";

export default function Rewards() {
  const { user } = useAuth();
  const [showAddReward, setShowAddReward] = useState(false);
  const [showEditReward, setShowEditReward] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);

  const queryClient = useQueryClient();

  const { data: rewards = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => Reward.list('-created_date'),
  });

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
  });

  const createRewardMutation = useMutation({
    mutationFn: (data) => Reward.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rewards']);
      toast.success("Reward created!");
    },
  });

  const updateRewardMutation = useMutation({
    mutationFn: ({ id, data }) => Reward.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rewards']);
    },
  });

  const handleToggleVisibility = async (reward) => {
    await updateRewardMutation.mutateAsync({
      id: reward.id,
      data: { visible_to_child: !reward.visible_to_child },
    });
    toast.info(reward.visible_to_child ? "Hidden from children" : "Now visible to children");
  };

  const handleEditReward = (reward) => {
    setSelectedReward(reward);
    setShowEditReward(true);
  };

  const handleEditRewardSubmit = async (data) => {
    await updateRewardMutation.mutateAsync({
      id: selectedReward.id,
      data: data,
    });
    toast.success("Reward updated!");
  };

  const deleteRewardMutation = useMutation({
    mutationFn: (id) => Reward.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['rewards']);
      toast.success("Reward deleted");
    },
  });

  const handleDeleteReward = async (reward) => {
    await deleteRewardMutation.mutateAsync(reward.id);
    setShowEditReward(false);
    setSelectedReward(null);
  };

  const getAssignedChildren = (reward) => {
    if (!reward.assigned_child_ids || reward.assigned_child_ids.length === 0) {
      return [];
    }
    return children.filter(child => reward.assigned_child_ids.includes(child.id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
              Rewards Store
            </h1>
            <p className="text-slate-600 mt-1">Create rewards your kids can earn 🎁</p>
          </div>
          <Button
            onClick={() => setShowAddReward(true)}
            className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Reward
          </Button>
        </div>

        <SectionHeader icon="🎁">Available Rewards</SectionHeader>
        {isLoading ? (
          <LoadingSpinner message="Loading rewards..." />
        ) : isError ? (
          <ErrorCard message="Couldn't load rewards" onRetry={refetch} />
        ) : rewards.length === 0 ? (
          <Card className="border-2 border-dashed border-slate-300">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-6xl mb-4">🎁</div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No rewards yet
              </h3>
              <p className="text-slate-500 mb-4">
                Create rewards your children can work towards
              </p>
              <Button
                onClick={() => setShowAddReward(true)}
                className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
              >
                <Gift className="w-4 h-4 mr-2" />
                Create First Reward
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {rewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                isParentView={true}
                onToggleVisibility={handleToggleVisibility}
                onEdit={handleEditReward}
                assignedChildren={getAssignedChildren(reward)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddRewardModal
        isOpen={showAddReward}
        onClose={() => setShowAddReward(false)}
        onSubmit={(data) => createRewardMutation.mutate(data)}
        children={children}
      />

      <EditRewardModal
        isOpen={showEditReward}
        onClose={() => {
          setShowEditReward(false);
          setSelectedReward(null);
        }}
        reward={selectedReward}
        onSubmit={handleEditRewardSubmit}
        onDelete={handleDeleteReward}
        children={children}
      />
    </div>
  );
}
