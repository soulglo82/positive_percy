import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Logo from "@/components/brand/Logo";

const TIPS = [
  {
    emoji: "🎮",
    title: "Start with screen time",
    body: "Extra screen time is a suggested first reward. Choose how many points it costs, and edit or replace it whenever you like. It's a reward, not a separate screen-time tracker.",
  },
  {
    emoji: "🎯",
    title: "Start small",
    body: "All behaviour categories begin at 1 point, and you can change them in Family settings. Set weekly targets your children can realistically reach.",
  },
  {
    emoji: "🗣️",
    title: "Be specific",
    body: "\"Great job sharing your toy with your sister!\" works much better than \"Good job\". Specific praise teaches children exactly what behavior to repeat.",
  },
  {
    emoji: "💛",
    title: "Stay positive",
    body: "Notice and reward positive choices. Percy doesn't deduct points for behaviour. If you award points by mistake, you can correct that award in Activity during the same week.",
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
          <DialogTitle className="flex items-center gap-2">
            <Logo size={32} decorative />
            Tips for success
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="text-center">
          <div className="text-total mb-4" aria-hidden="true">{TIPS[step].emoji}</div>
          <h3 className="text-lg font-semibold text-foreground mb-3">{TIPS[step].title}</h3>
          <p className="text-muted-foreground leading-relaxed">{TIPS[step].body}</p>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mt-6" aria-label={`Tip ${step + 1} of ${TIPS.length}`} role="img">
          {TIPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-primary' : 'bg-input'
              }`}
            />
          ))}
          </div>
        </DialogBody>

        <DialogFooter>
          {step > 0 ? (
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4" />
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
              className="flex-1"
            >
              Got it!
            </Button>
          ) : (
            <Button
              onClick={() => setStep(s => s + 1)}
              className="flex-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function shouldShowOnboarding() {
  return !localStorage.getItem(STORAGE_KEY);
}
