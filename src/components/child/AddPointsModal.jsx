import React, { useState } from 'react';
import CategoryIcon from '@/components/CategoryIcon';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import NumberInput from "@/components/ui/NumberInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import PointsStar from "@/components/brand/PointsStar";
import { getToken } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { PERCY } from "@/constants/terminology";
import { MAX_AWARD } from "@/lib/points";

const POSITIVE_AMOUNTS = [1, 2, 3, 4, 5, 10];
const NEGATIVE_AMOUNTS = [-1, -2, -3, -4, -5, -10];

export default function AddPointsModal({ isOpen, onClose, child, onSubmit }) {
  const [points, setPoints] = useState(1);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['behaviorCategories'],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch('/api/behavior-categories', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen,
  });

  // Filter categories by child assignment
  const filteredCategories = categories.filter(cat => {
    const assigned = cat.assigned_children || [];
    if (assigned.length === 0) return true;
    return child && assigned.includes(child.id);
  });

  // Set default category when categories load
  React.useEffect(() => {
    if (filteredCategories.length > 0 && !category) {
      setCategory(filteredCategories[0].name);
    }
  }, [filteredCategories, category]);

  const isNegative = points < 0;
  const [submitting, setSubmitting] = useState(false);
  const outOfRange = !Number.isInteger(points) || points === 0 || Math.abs(points) > MAX_AWARD;

  const handleSubmit = async () => {
    if (submitting || outOfRange) return;
    setSubmitting(true);
    try {
      const ok = await onSubmit({
        points,
        category: isNegative ? "Adjustment" : category,
        note,
      });
      if (ok === false) return; // error already shown; keep the form open
      setPoints(1);
      setCategory(filteredCategories.length > 0 ? filteredCategories[0].name : "");
      setNote("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  // Selected chip: solid selected tint and an orange edge; never colour alone (aria-pressed).
  const chipClass = (selected) => `flex items-center gap-1.5 px-3 rounded-md border text-sm font-medium transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
    selected
      ? 'bg-selected border-selected-border text-foreground'
      : 'bg-card border-border text-foreground hover:bg-accent'
  }`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PointsStar className="h-5 w-5" />
            {isNegative ? `Adjust ${PERCY.POINTS_COMPACT}` : `Award ${PERCY.POINTS_COMPACT}`}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <p className="text-sm font-medium text-foreground">
            For: {child?.name}
          </p>

          {/* Quick Amount Buttons */}
          <div>
            <Label htmlFor="award-points" className="mb-3 block">
              {PERCY.POINTS_COMPACT}
            </Label>
            <div className="grid grid-cols-3 xs:grid-cols-6 gap-2 mb-2">
              {POSITIVE_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant={points === amount ? "default" : "outline"}
                  size="sm"
                  aria-pressed={points === amount}
                  onClick={() => setPoints(amount)}
                  className="tabular-nums"
                >
                  +{amount}
                </Button>
              ))}
            </div>
            {/* Deduction row: minimal tokens only; the whole row goes in plan item 4 (no negative scoring). */}
            <div className="grid grid-cols-3 xs:grid-cols-6 gap-2 mb-3">
              {NEGATIVE_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant={points === amount ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPoints(amount)}
                  aria-pressed={points === amount}
                  className={points === amount ? "" : "text-destructive"}
                >
                  {amount}
                </Button>
              ))}
            </div>
            <NumberInput
              id="award-points"
              value={points}
              onChange={setPoints}
              min={-MAX_AWARD}
              max={MAX_AWARD}
              className="text-lg font-semibold tabular-nums"
            />
            {Math.abs(points) > MAX_AWARD && (
              <p className="text-xs text-destructive mt-1">Up to {MAX_AWARD} points at a time.</p>
            )}
            {!Number.isInteger(points) && (
              <p className="text-xs text-destructive mt-1">Whole numbers only.</p>
            )}
          </div>

          {/* Category: tappable boxes */}
          {!isNegative && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2" id="award-category">
                Category
              </p>
              {loadingCategories ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Loading categories...
                </div>
              ) : (
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="award-category">
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      aria-pressed={category === cat.name}
                      onClick={() => setCategory(cat.name)}
                      className={chipClass(category === cat.name)}
                    >
                      <CategoryIcon iconKey={cat.icon_key} />
                      <span>{cat.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={category === "Other"}
                    onClick={() => setCategory("Other")}
                    className={chipClass(category === "Other")}
                  >
                    <span>Other</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <Label htmlFor="award-note" className="mb-2 block">
              Note (optional)
            </Label>
            <Textarea
              id="award-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isNegative
                ? "Why are you adjusting points?"
                : "What did they do well?"
              }
              rows={3}
            />
          </div>
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
            disabled={outOfRange || submitting}
            className="flex-1"
          >
            {isNegative ? 'Adjust' : 'Award'} {PERCY.POINTS_COMPACT}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
