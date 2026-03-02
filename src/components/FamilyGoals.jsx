import React, { useState } from 'react';
import { Family_Goal } from "@/api/entities";
import { getToken } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Target, Plus, Trophy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

const GOAL_EMOJIS = ["🎯", "🏠", "🎢", "🏖️", "🎮", "🍕", "🎬", "⚽", "🚗", "🎪"];

export default function FamilyGoals() {
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTarget, setNewTarget] = useState(500);
  const [newEmoji, setNewEmoji] = useState("🎯");

  const queryClient = useQueryClient();

  const { data: goals = [] } = useQuery({
    queryKey: ['family_goals'],
    queryFn: () => Family_Goal.filter({ status: 'active' }),
  });

  const { data: completedGoals = [] } = useQuery({
    queryKey: ['family_goals_completed'],
    queryFn: () => Family_Goal.filter({ status: 'completed' }),
  });

  const createGoalMutation = useMutation({
    mutationFn: (data) => Family_Goal.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['family_goals']);
      toast.success("Family goal created!");
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id) => Family_Goal.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['family_goals']);
      queryClient.invalidateQueries(['family_goals_completed']);
    },
  });

  const handleContribute = async (goalId, points) => {
    const token = getToken();
    try {
      const res = await fetch(`/api/family-goals/${goalId}/contribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ points }),
      });
      const updated = await res.json();
      queryClient.invalidateQueries(['family_goals']);

      if (updated.status === 'completed') {
        queryClient.invalidateQueries(['family_goals_completed']);
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#a855f7', '#ec4899', '#22c55e', '#3b82f6', '#f59e0b'],
        });
        toast.success(`Family goal "${updated.title}" completed!`);
      }
    } catch {
      toast.error("Failed to contribute to goal");
    }
  };

  const handleCreateGoal = () => {
    if (!newTitle.trim() || newTarget <= 0) return;
    createGoalMutation.mutate({
      title: newTitle.trim(),
      description: newDescription.trim(),
      emoji: newEmoji,
      target_points: newTarget,
    });
    setNewTitle("");
    setNewDescription("");
    setNewTarget(500);
    setNewEmoji("🎯");
    setShowAddGoal(false);
  };

  if (goals.length === 0 && completedGoals.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-500" />
            Family Goals
          </h2>
          <Button
            size="sm"
            onClick={() => setShowAddGoal(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            <Plus className="w-4 h-4 mr-1" /> New Goal
          </Button>
        </div>
        <Card className="border-2 border-dashed border-slate-300">
          <CardContent className="py-8 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-slate-600 text-sm">
              Set a family goal everyone can work towards together!
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddGoal(true)}
              className="mt-3"
            >
              Create First Goal
            </Button>
          </CardContent>
        </Card>
        <AddGoalDialog
          isOpen={showAddGoal}
          onClose={() => setShowAddGoal(false)}
          title={newTitle}
          setTitle={setNewTitle}
          description={newDescription}
          setDescription={setNewDescription}
          target={newTarget}
          setTarget={setNewTarget}
          emoji={newEmoji}
          setEmoji={setNewEmoji}
          onSubmit={handleCreateGoal}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Target className="w-6 h-6 text-blue-500" />
          Family Goals
        </h2>
        <Button
          size="sm"
          onClick={() => setShowAddGoal(true)}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
        >
          <Plus className="w-4 h-4 mr-1" /> New Goal
        </Button>
      </div>

      <div className="space-y-4">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onContribute={handleContribute}
            onDelete={() => deleteGoalMutation.mutate(goal.id)}
          />
        ))}

        {completedGoals.length > 0 && (
          <div className="pt-2">
            <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
              <Trophy className="w-4 h-4" /> Completed
            </p>
            {completedGoals.slice(0, 3).map((goal) => (
              <div key={goal.id} className="flex items-center gap-2 text-sm text-slate-500 py-1">
                <span>{goal.emoji}</span>
                <span className="line-through">{goal.title}</span>
                <span className="text-green-500 font-medium ml-auto">Done!</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddGoalDialog
        isOpen={showAddGoal}
        onClose={() => setShowAddGoal(false)}
        title={newTitle}
        setTitle={setNewTitle}
        description={newDescription}
        setDescription={setNewDescription}
        target={newTarget}
        setTarget={setNewTarget}
        emoji={newEmoji}
        setEmoji={setNewEmoji}
        onSubmit={handleCreateGoal}
      />
    </div>
  );
}

function GoalCard({ goal, onContribute, onDelete }) {
  const [contributeAmount, setContributeAmount] = useState(10);
  const progress = Math.min(100, Math.round((goal.current_points / goal.target_points) * 100));

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{goal.emoji}</span>
            <div>
              <h3 className="font-semibold text-slate-800">{goal.title}</h3>
              {goal.description && (
                <p className="text-xs text-slate-500">{goal.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onDelete}
            className="text-slate-400 hover:text-red-500 transition-colors p-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-2">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-600">{goal.current_points} / {goal.target_points} pts</span>
            <span className="font-medium text-blue-600">{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Input
            type="number"
            value={contributeAmount}
            onChange={(e) => setContributeAmount(Math.max(1, Number(e.target.value)))}
            min="1"
            className="w-24 h-8 text-sm"
          />
          <Button
            size="sm"
            onClick={() => onContribute(goal.id, contributeAmount)}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-8"
          >
            + Contribute
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddGoalDialog({ isOpen, onClose, title, setTitle, description, setDescription, target, setTarget, emoji, setEmoji, onSubmit }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Target className="w-6 h-6 text-blue-500" />
            New Family Goal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">Icon</Label>
            <div className="flex gap-2 flex-wrap">
              {GOAL_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-2xl p-1.5 rounded-lg border-2 transition-all ${
                    emoji === e
                      ? 'border-blue-400 bg-blue-50 scale-110'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">Goal Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Family Movie Night"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Everyone works together to earn 500 points"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">Target Points</Label>
            <Input
              type="number"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              min="1"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={onSubmit}
            disabled={!title.trim() || target <= 0}
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            Create Goal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
