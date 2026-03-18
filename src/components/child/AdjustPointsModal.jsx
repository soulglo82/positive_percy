import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal } from "lucide-react";
import { PERCY, formatPoints } from "@/constants/terminology";

const ADJUST_AMOUNTS = [-5, -2, -1, 1, 2, 5];

export default function AdjustPointsModal({ isOpen, onClose, child, onSubmit }) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (delta === 0) return;
    onSubmit({
      points: delta,
      category: "Adjustment",
      note: reason || "Points adjusted",
    });
    setDelta(0);
    setReason("");
    onClose();
  };

  const handleClose = () => {
    setDelta(0);
    setReason("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <SlidersHorizontal className="w-6 h-6 text-slate-500" />
            Adjust Points
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              For: {child?.name}
            </Label>
            <p className="text-xs text-slate-500">
              Current balance: {formatPoints(child?.total_points || 0, { compact: true })}
            </p>
          </div>

          {/* Delta Buttons */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-3 block">
              Change by:
            </Label>
            <div className="flex gap-2 flex-wrap">
              {ADJUST_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant={delta === amount ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDelta(amount)}
                  className={delta === amount
                    ? (amount < 0 ? "bg-rose-500 hover:bg-rose-600" : "bg-green-500 hover:bg-green-600")
                    : ""
                  }
                >
                  {amount > 0 ? `+${amount}` : amount}
                </Button>
              ))}
            </div>
            {delta !== 0 && (
              <p className={`text-sm font-medium mt-3 ${delta < 0 ? 'text-rose-600' : 'text-green-600'}`}>
                New balance: {formatPoints(Math.max(0, (child?.total_points || 0) + delta), { compact: true })}
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Reason (optional)
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you adjusting points?"
              rows={2}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={delta === 0}
            className={`flex-1 ${
              delta < 0
                ? 'bg-rose-500 hover:bg-rose-600'
                : delta > 0
                  ? 'bg-green-500 hover:bg-green-600'
                  : ''
            }`}
          >
            {delta === 0 ? 'Select Amount' : `Adjust ${delta > 0 ? '+' : ''}${delta} ${PERCY.POINTS_COMPACT}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
