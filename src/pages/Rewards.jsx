import { useState } from 'react';
import { Child, Reward } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Gift } from "lucide-react";
import { toast } from "sonner";

import Logo from "@/components/brand/Logo";
import { sortRewardsForParent } from "@/lib/rewardOrder";
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
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      toast.success("Reward created.");
    },
  });

  const updateRewardMutation = useMutation({
    mutationFn: ({ id, data }) => Reward.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
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
    toast.success("Reward updated.");
  };

  const deleteRewardMutation = useMutation({
    mutationFn: (id) => Reward.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
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
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-display text-title font-semibold text-foreground">
              Rewards
            </h1>
            <p className="text-muted-foreground mt-1">Create rewards your kids can earn 🎁</p>
          </div>
          <Button onClick={() => setShowAddReward(true)}>
            <Plus className="w-4 h-4" />
            New Reward
          </Button>
        </div>

        <SectionHeader icon={Gift}>Available rewards</SectionHeader>
        {isLoading ? (
          <LoadingSpinner message="Loading rewards..." />
        ) : isError ? (
          <ErrorCard message="Couldn't load rewards" onRetry={refetch} />
        ) : rewards.length === 0 ? (
          <Card className="border-2 border-dashed border-input shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Logo size={48} decorative className="mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No rewards yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Create rewards your children can work towards
              </p>
              <Button onClick={() => setShowAddReward(true)}>
                <Gift className="w-4 h-4" />
                Create First Reward
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Shown-to-children rewards first, then hidden ones; cheapest first in each. */}
            {sortRewardsForParent(rewards).map((reward) => (
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
