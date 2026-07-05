import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import NumberInput from "@/components/ui/NumberInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2 } from "lucide-react";
import { getToken } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { PERCY } from "@/constants/terminology";

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

  const handleSubmit = () => {
    onSubmit({
      points,
      category: isNegative ? "Adjustment" : category,
      note,
    });
    setPoints(1);
    setCategory(filteredCategories.length > 0 ? filteredCategories[0].name : "");
    setNote("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className={`w-6 h-6 ${isNegative ? 'text-rose-500' : 'text-green-500'}`} />
            {isNegative ? `Adjust ${PERCY.POINTS_COMPACT}` : `Award ${PERCY.POINTS_COMPACT}`}
          </DialogTitle>
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
              {PERCY.POINTS_COMPACT}
            </Label>
            <div className="grid grid-cols-6 gap-2 mb-2">
              {POSITIVE_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant={points === amount ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPoints(amount)}
                  className={points === amount
                    ? "bg-green-500 hover:bg-green-600"
                    : ""
                  }
                >
                  +{amount}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-2 mb-3">
              {NEGATIVE_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant={points === amount ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPoints(amount)}
                  className={points === amount
                    ? "bg-rose-500 hover:bg-rose-600"
                    : "text-rose-600 border-rose-200 hover:bg-rose-50"
                  }
                >
                  {amount}
                </Button>
              ))}
            </div>
            <NumberInput
              value={points}
              onChange={setPoints}
              className="text-lg font-semibold"
            />
          </div>

          {/* Category — tappable boxes */}
          {!isNegative && (
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2 block">
                Category
              </Label>
              {loadingCategories ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading categories...
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.name)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all min-h-[38px] ${
                        category === cat.name
                          ? 'bg-purple-100 border-purple-400 text-purple-800 ring-2 ring-purple-300'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCategory("Other")}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all min-h-[38px] ${
                      category === "Other"
                        ? 'bg-purple-100 border-purple-400 text-purple-800 ring-2 ring-purple-300'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    <span>Other</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Note */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Note (optional)
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isNegative
                ? "Why are you adjusting points?"
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
            disabled={points === 0}
            className={`flex-1 ${
              isNegative
                ? 'bg-rose-500 hover:bg-rose-600'
                : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
            }`}
          >
            {isNegative ? 'Adjust' : 'Award'} {PERCY.POINTS_COMPACT}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
