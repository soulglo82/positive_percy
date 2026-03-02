import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Gift, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { REWARD_TEMPLATES } from "@/data/reward-templates";

const EMOJI_OPTIONS = ["🎮", "🍕", "🎬", "🎨", "⚽", "📚", "🎪", "🎭", "🏊", "🎵", "🍦", "🎁"];

const CATEGORY_LABELS = {
  quick: "Quick Wins (5-15 pts)",
  medium: "Medium (20-50 pts)",
  big: "Big Goals (60+ pts)",
};

export default function AddRewardModal({ isOpen, onClose, onSubmit, children = [] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [costPoints, setCostPoints] = useState(50);
  const [emoji, setEmoji] = useState("🎁");
  const [assignedChildIds, setAssignedChildIds] = useState([]);
  const [showIdeas, setShowIdeas] = useState(false);

  const selectTemplate = (template) => {
    setTitle(template.title);
    setDescription(template.description || "");
    setCostPoints(template.cost_points);
    setEmoji(template.emoji);
    setShowIdeas(false);
  };

  const handleSubmit = () => {
    if (title.trim() && costPoints > 0) {
      onSubmit({
        title: title.trim(),
        description: description.trim(),
        cost_points: costPoints,
        emoji,
        visible_to_child: true,
        assigned_child_ids: assignedChildIds,
      });
      setTitle("");
      setDescription("");
      setCostPoints(50);
      setEmoji("🎁");
      setAssignedChildIds([]);
      onClose();
    }
  };

  const toggleChildAssignment = (childId) => {
    setAssignedChildIds(prev => 
      prev.includes(childId) 
        ? prev.filter(id => id !== childId)
        : [...prev, childId]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Gift className="w-6 h-6 text-orange-500" />
            Create Reward
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Browse Ideas */}
          <div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100"
              onClick={() => setShowIdeas(!showIdeas)}
            >
              <Lightbulb className="w-4 h-4 mr-2" />
              Browse Reward Ideas
              {showIdeas ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
            </Button>
            {showIdeas && (
              <div className="mt-3 max-h-48 overflow-y-auto border rounded-lg p-3 space-y-3">
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {REWARD_TEMPLATES.filter(t => t.category === cat).map((t) => (
                        <button
                          key={t.title}
                          type="button"
                          onClick={() => selectTemplate(t)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 hover:bg-purple-100 text-xs font-medium text-slate-700 hover:text-purple-700 transition-colors"
                        >
                          <span>{t.emoji}</span>
                          <span>{t.title}</span>
                          <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] px-1 py-0 h-4">
                            {t.cost_points}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Emoji Picker */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Choose Icon
            </Label>
            <div className="grid grid-cols-6 gap-2">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`text-3xl p-2 rounded-lg border-2 transition-all ${
                    emoji === e 
                      ? 'border-orange-400 bg-orange-50 scale-110' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Reward Title
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Extra Screen Time"
              className="text-lg"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Description (optional)
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., 30 minutes of extra tablet time"
              rows={2}
            />
          </div>

          {/* Cost */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Point Cost
            </Label>
            <Input
              type="number"
              value={costPoints}
              onChange={(e) => setCostPoints(Number(e.target.value))}
              min="1"
              className="text-lg font-semibold"
            />
          </div>

          {/* Assign to Children */}
          {children.length > 0 && (
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2 block">
                Assign to Children
              </Label>
              <p className="text-xs text-slate-500 mb-3">
                Leave unchecked to make available to all children
              </p>
              <div className="space-y-2">
                {children.map((child) => (
                  <div key={child.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`child-${child.id}`}
                      checked={assignedChildIds.includes(child.id)}
                      onChange={() => toggleChildAssignment(child.id)}
                      className="w-4 h-4 rounded border-slate-300 text-purple-600 cursor-pointer"
                    />
                    <label
                      htmlFor={`child-${child.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {child.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || costPoints <= 0}
            className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
          >
            Create Reward
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
