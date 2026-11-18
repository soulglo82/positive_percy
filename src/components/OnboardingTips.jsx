// V1 onboarding: "Let's get started", three ways to use Percy (approved design
// 9de1df2, screen "onboarding"; docs/engineering/V1-F-DESIGN.md O). Opened on
// first run and from Settings.
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const MODES = [
  { title: "1. Today's Goals", body: 'Make daily and weekly routines easy to see and celebrate.' },
  { title: '2. Notice positive behaviour', body: 'Reward kindness, effort, learning and helping whenever you see them.' },
  { title: '3. Save for something bigger', body: 'Enjoy smaller weekly treats, or keep saving points towards bigger adventures.' },
];

const STORAGE_KEY = 'percy_onboarding_done';

export default function OnboardingTips({ isOpen, onClose }) {
  const handleClose = () => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title font-extrabold text-primary">Let's get started</DialogTitle>
          <DialogDescription>Three ways to help good habits grow.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {MODES.map((mode) => (
            <section key={mode.title} className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-display font-bold text-lg text-primary">{mode.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{mode.body}</p>
            </section>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button onClick={handleClose} className="flex-1">Explore Percy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function shouldShowOnboarding() {
  try { return !localStorage.getItem(STORAGE_KEY); } catch { return false; }
}
