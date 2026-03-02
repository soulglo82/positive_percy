import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const TIPS = [
  {
    emoji: "🎯",
    title: "Start small",
    body: "Set weekly targets your child can hit about 80% of the time. It's better to raise the bar later than to start too high.",
  },
  {
    emoji: "🗣️",
    title: "Be specific",
    body: "\"Great job sharing your toy with your sister!\" works much better than \"Good job\". Specific praise teaches children exactly what behavior to repeat.",
  },
  {
    emoji: "💛",
    title: "Stay positive",
    body: "Aim for at least 5 point awards for every 1 adjustment. The app works best when the focus is on catching good behavior, not punishing bad.",
  },
  {
    emoji: "📅",
    title: "Be consistent",
    body: "Even 2 minutes each evening to log the day's highlights builds the habit. Your children will start looking for ways to earn points!",
  },
];

const STORAGE_KEY = 'percy_onboarding_done';

export default function OnboardingTips({ isOpen, onClose, forceShow = false }) {
  const [step, setStep] = useState(0);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setStep(0);
    onClose();
  };

  const isLastStep = step === TIPS.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Tips for Success
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 text-center">
          <div className="text-6xl mb-4">{TIPS[step].emoji}</div>
          <h3 className="text-xl font-bold text-slate-800 mb-3">{TIPS[step].title}</h3>
          <p className="text-slate-600 leading-relaxed">{TIPS[step].body}</p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-4">
          {TIPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-purple-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {step > 0 ? (
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Skip
            </Button>
          )}
          {isLastStep ? (
            <Button
              onClick={handleClose}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              Got it!
            </Button>
          ) : (
            <Button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function shouldShowOnboarding() {
  return !localStorage.getItem(STORAGE_KEY);
}
