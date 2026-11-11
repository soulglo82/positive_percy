import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NumberInput from "@/components/ui/NumberInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPicker, ChildAssignList } from "./RewardFormParts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";

const EMOJI_OPTIONS = ["🎮", "🍕", "🎬", "🎨", "⚽", "📚", "🎪", "🎭", "🏊", "🎵", "🍦", "🎁"];

export default function EditRewardModal({ isOpen, onClose, reward, onSubmit, onDelete, children = [] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [costPoints, setCostPoints] = useState(50);
  const [emoji, setEmoji] = useState("🎁");
  const [assignedChildIds, setAssignedChildIds] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (reward) {
      setTitle(reward.title || "");
      setDescription(reward.description || "");
      setCostPoints(reward.cost_points || 50);
      setEmoji(reward.emoji || "🎁");
      setAssignedChildIds(reward.assigned_child_ids || []);
    }
  }, [reward]);

  const handleSubmit = () => {
    if (title.trim() && costPoints > 0) {
      onSubmit({
        title: title.trim(),
        description: description.trim(),
        cost_points: costPoints,
        emoji,
        visible_to_child: reward?.visible_to_child ?? true,
        assigned_child_ids: assignedChildIds,
      });
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

  return (<>
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Three parts: title, a scrolling middle, buttons. Fits the visible screen (svh). */}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            Edit Reward
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* Emoji Picker */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              Choose Icon
            </p>
            <EmojiPicker options={EMOJI_OPTIONS} value={emoji} onChange={setEmoji} />
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="edit-reward-title" className="mb-2 block">
              Reward Title
            </Label>
            <Input
              id="edit-reward-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Extra Screen Time"
              className="text-lg"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="edit-reward-description" className="mb-2 block">
              Description (optional)
            </Label>
            <Textarea
              id="edit-reward-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., 30 minutes of extra tablet time"
              rows={2}
            />
          </div>

          {/* Cost */}
          <div>
            <Label htmlFor="edit-reward-cost" className="mb-2 block">
              Point Cost
            </Label>
            <NumberInput
              id="edit-reward-cost"
              value={costPoints}
              onChange={setCostPoints}
              min="1"
              className="text-lg font-semibold"
            />
          </div>

          {/* Assign to Children */}
          {children.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                Assign to Children
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Leave unchecked to make available to all children
              </p>
              <ChildAssignList children={children} selectedIds={assignedChildIds} onToggle={toggleChildAssignment} />
            </div>
          )}

          {onDelete && (
            <div className="pt-4 border-t border-border">
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4" />
                Delete Reward
              </Button>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
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
            className="flex-1"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {reward?.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this reward. Any pending redemptions will be denied. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onDelete(reward);
              setShowDeleteConfirm(false);
              onClose();
            }}
            variant="destructive"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>);
}
