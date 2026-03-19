import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Plus, ShoppingCart } from "lucide-react";
import { PERCY } from "@/constants/terminology";

export default function RewardStack({ stack = [], totalPoints = 0, onRemove, onAddMore }) {
  const stackTotal = stack.reduce((sum, item) => sum + item.cost, 0);
  const remaining = totalPoints - stackTotal;

  if (stack.length === 0) {
    return (
      <Card className="border-2 border-dashed border-slate-200">
        <CardContent className="py-8 text-center">
          <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            Tap + to start planning your rewards
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-purple-200 bg-purple-50/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-purple-800">Your Reward Stack</h3>
        </div>

        <div className="space-y-2">
          {stack.map((item, index) => (
            <div
              key={`${item.rewardId}-${index}`}
              className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-purple-100"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-green-600 font-bold text-sm">✓</span>
                <span className="text-sm font-medium text-slate-700 truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-purple-600">{item.cost}pts</span>
                {onRemove && (
                  <button
                    onClick={() => onRemove(index)}
                    className="p-1 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    aria-label={`Remove ${item.name} from stack`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-purple-200">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Total:</span>
            <span className="font-bold text-purple-700">{stackTotal}pts</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-slate-500">Remaining:</span>
            <span className={`font-semibold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {remaining}pts
            </span>
          </div>
        </div>

        {onAddMore && remaining > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddMore}
            className="w-full mt-3 border-purple-200 text-purple-600 hover:bg-purple-100"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add another reward
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
