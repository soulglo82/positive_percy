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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";

const CATEGORIES = [
  "Homework",
  "Chores",
  "Kindness",
  "Good Manners",
  "Bedtime Routine",
  "Screen Time",
  "Learning Moment",
  "Other"
];

const PRESET_AMOUNTS = [5, 10, 15, 20, 25];

export default function AddPointsModal({ isOpen, onClose, child, onSubmit, isSubtract = false }) {
  const [points, setPoints] = useState(10);
  const [category, setCategory] = useState("Other");
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    onSubmit({
      points: isSubtract ? -Math.abs(points) : Math.abs(points),
      category,
      note,
    });
    setPoints(10);
    setCategory("Other");
    setNote("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className={`w-6 h-6 ${isSubtract ? 'text-rose-500' : 'text-green-500'}`} />
            {isSubtract ? 'Adjust Points' : 'Award Points'}
          </DialogTitle>
          {isSubtract && (
            <p className="text-xs text-amber-600 mt-1">
              Tip: Try to keep adjustments rare. Research shows 5 positives for every 1 correction works best.
            </p>
          )}
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              For: {child?.name}
            </Label>
          </div>

          {/* Quick Amount Buttons */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-3 block">
              Points
            </Label>
            <div className="flex gap-2 mb-3">
              {PRESET_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant={points === amount ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPoints(amount)}
                  className={points === amount 
                    ? (isSubtract ? "bg-rose-500 hover:bg-rose-600" : "bg-green-500 hover:bg-green-600")
                    : ""
                  }
                >
                  {amount}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              min="1"
              className="text-lg font-semibold"
            />
          </div>

          {/* Category */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Note (optional)
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isSubtract 
                ? "What happened?" 
                : "What did they do well?"
              }
              rows={3}
            />
          </div>
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
            className={`flex-1 ${
              isSubtract 
                ? 'bg-rose-500 hover:bg-rose-600' 
                : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
            }`}
          >
            {isSubtract ? 'Adjust' : 'Award'} Points
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
