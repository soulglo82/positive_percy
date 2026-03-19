import React from 'react';
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export default function RewardStackSummary({ stack = [], childName, onConfirm, isConfirming = false }) {
  if (stack.length === 0) return null;

  const stackTotal = stack.reduce((sum, item) => sum + item.cost, 0);

  return (
    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="text-xs font-semibold text-amber-800 mb-2">
        {childName}'s Reward Stack
      </div>
      <div className="space-y-1">
        {stack.map((item, index) => (
          <div key={`${item.rewardId}-${index}`} className="flex items-center justify-between text-xs">
            <span className="text-slate-600 truncate mr-2">✓ {item.name}</span>
            <span className="font-medium text-slate-700 shrink-0">{item.cost}pts</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-200 text-xs">
        <span className="font-semibold text-slate-700">Total:</span>
        <span className="font-bold text-amber-700">{stackTotal}pts</span>
      </div>
      <Button
        onClick={onConfirm}
        disabled={isConfirming}
        className="w-full mt-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white min-h-[44px]"
      >
        <CheckCircle className="w-4 h-4 mr-1" />
        {isConfirming ? 'Confirming...' : `Confirm Rewards for ${childName}`}
      </Button>
    </div>
  );
}
