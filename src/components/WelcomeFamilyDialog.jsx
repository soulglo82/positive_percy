import { useNavigate } from 'react-router-dom';
import { Copy, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { createPageUrl } from '@/utils';

// Shown once after creating a family. The login page is unmounted as soon as
// authentication succeeds, so the code must be shared from the dashboard.
export default function WelcomeFamilyDialog({ familyCode, onClose }) {
  const navigate = useNavigate();
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(familyCode);
      toast.success('Family code copied.');
    } catch {
      toast.error('Could not copy the code. You can select it below.');
    }
  };
  const beginRewards = () => {
    onClose();
    navigate(createPageUrl('Rewards'));
  };

  return (
    <Dialog open={!!familyCode} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Positive Percy</DialogTitle>
          <DialogDescription>Keep this code safe. Anyone with it can access your family's account.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="rounded-md border border-border bg-muted p-4">
            <p className="text-xs text-muted-foreground mb-1">Your family code</p>
            <p className="font-mono font-semibold text-title tracking-wider text-foreground select-all">{familyCode}</p>
            <Button type="button" variant="outline" onClick={copyCode} className="w-full mt-3">
              <Copy className="w-4 h-4" aria-hidden="true" />
              Copy family code
            </Button>
          </div>
          <p className="text-sm text-foreground">
            Every behaviour starts at <strong>1 point</strong>. You can change each value later in Family settings.
          </p>
          <p className="text-sm text-muted-foreground">
            A simple first reward is extra screen time. Set its point cost to suit your family, or create another reward instead.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="flex-1">Go to Home</Button>
          <Button onClick={beginRewards} className="flex-1">
            <Gift className="w-4 h-4" aria-hidden="true" />
            Set up a reward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
