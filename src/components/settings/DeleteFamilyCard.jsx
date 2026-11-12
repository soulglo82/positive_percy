import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, getToken } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SectionHeader from '@/components/SectionHeader';

export default function DeleteFamilyCard() {
  const { familyCode, logout } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch('/api/family/deletion-capability', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (mounted) setEnabled(Boolean(d?.enabled)); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Do not present an irreversible action before a verified purge and restore
  // operation has been configured. The API applies the same gating.
  if (!enabled || !familyCode) return null;

  const requestDeletion = async () => {
    if (busy || confirmation !== familyCode) return;
    setBusy(true);
    try {
      const r = await fetch('/api/family/request-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ confirmation }),
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        throw new Error(json.error || 'Could not request family deletion.');
      }
      setDialogOpen(false);
      logout();
      toast.info('Family access is now locked. You can recover it using your family code within seven days.');
    } catch (err) {
      toast.error(err.message || 'Could not request deletion.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeader icon={Trash2}>Delete family account</SectionHeader>
      <Card>
        <CardContent className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            Delete the entire family account, including children's profiles, points, rewards
            and photos. Everyone is locked out immediately. You can restore the family
            with your family code for seven days. After that, permanent deletion begins.
          </p>
          <p className="text-sm text-muted-foreground">
            Download your Family Report and technical data first if you need a copy.
            Keep the family code safe during the recovery period.
          </p>
          <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Request family deletion
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={dialogOpen} onOpenChange={(open) => {
        if (!busy) { setDialogOpen(open); if (!open) setConfirmation(''); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the entire family?</AlertDialogTitle>
            <AlertDialogDescription>
              This locks out every adult immediately. All children, points history,
              photos and rewards are scheduled for permanent deletion after seven days.
              Enter your exact family code to confirm. You'll need it to recover the
              account during those seven days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="confirm-family-deletion" className="text-sm font-medium text-foreground">
              Enter family code: {familyCode}
            </label>
            <Input
              id="confirm-family-deletion"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep family</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || confirmation !== familyCode}
              onClick={(e) => { e.preventDefault(); requestDeletion(); }}
            >
              {busy ? 'Requesting deletion…' : 'Lock family and request deletion'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
