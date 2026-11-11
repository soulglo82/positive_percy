import { useEffect, useState } from 'react';
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
import { Points } from "@/components/brand/PointsStar";
import { Gift, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { REWARD_TEMPLATES } from "@/data/reward-templates";
import { PERCY } from "@/constants/terminology";

const EMOJI_OPTIONS = ["🎮", "🍕", "🎬", "🎨", "⚽", "📚", "🎪", "🎭", "🏊", "🎵", "🍦", "🎁"];

const CATEGORY_LABELS = {
  starter: 'Recommended first reward',
  quick: PERCY.REWARD_CAT_QUICK,
  medium: PERCY.REWARD_CAT_MEDIUM,
  big: PERCY.REWARD_CAT_BIG,
};

export default function AddRewardModal({ isOpen, onClose, onSubmit, children = [], initialTemplate = null }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [costPoints, setCostPoints] = useState(50);
  const [emoji, setEmoji] = useState("🎁");
  const [assignedChildIds, setAssignedChildIds] = useState([]);
  const [showIdeas, setShowIdeas] = useState(false);

  // Prefill only when opening the modal. Parents can change every field
  // before saving; opening a normal blank reward never reuses old values.
  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialTemplate?.title || "");
    setDescription(initialTemplate?.description || "");
    setCostPoints(initialTemplate?.cost_points ?? 50);
    setEmoji(initialTemplate?.emoji || "🎁");
    setAssignedChildIds([]);
    setShowIdeas(false);
  }, [isOpen, initialTemplate]);

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
      {/* Three parts: title, a scrolling middle, buttons. Fits the visible screen (svh). */}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            Create Reward
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* Browse Ideas */}
          <div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              aria-expanded={showIdeas}
              onClick={() => setShowIdeas(!showIdeas)}
            >
              <Lightbulb className="w-4 h-4" strokeWidth={1.5} />
              Browse Reward Ideas
              {showIdeas ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
            </Button>
            {showIdeas && (
              <div className="mt-3 border border-border rounded-md p-3 space-y-3">
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {REWARD_TEMPLATES.filter(t => t.category === cat).map((t) => (
                        <button
                          key={t.title}
                          type="button"
                          onClick={() => selectTemplate(t)}
                          className="inline-flex items-center gap-1.5 px-3 min-h-11 rounded-full bg-muted hover:bg-accent text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <span aria-hidden="true">{t.emoji}</span>
                          <span>{t.title}</span>
                          <Points value={t.cost_points} className="text-xs text-muted-foreground" starClassName="h-3 w-3" />
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
            <p className="text-sm font-medium text-foreground mb-2">
              Choose Icon
            </p>
            <EmojiPicker options={EMOJI_OPTIONS} value={emoji} onChange={setEmoji} />
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="add-reward-title" className="mb-2 block">
              Reward Title
            </Label>
            <Input
              id="add-reward-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Extra Screen Time"
              className="text-lg"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="add-reward-description" className="mb-2 block">
              Description (optional)
            </Label>
            <Textarea
              id="add-reward-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., 30 minutes of extra tablet time"
              rows={2}
            />
          </div>

          {/* Cost */}
          <div>
            <Label htmlFor="add-reward-cost" className="mb-2 block">
              Point Cost
            </Label>
            <NumberInput
              id="add-reward-cost"
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
            Create Reward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
