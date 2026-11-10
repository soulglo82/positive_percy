import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getToken } from "@/lib/AuthContext";
import { refreshPoints } from "@/lib/points";
import { useQueryClient } from "@tanstack/react-query";

// The family's timezone decides when "this week" starts (Monday 00:00) and
// which day an award counts towards the streak.
export default function FamilyTimezone() {
  const queryClient = useQueryClient();
  const [timezone, setTimezone] = useState(null);
  const [saving, setSaving] = useState(false);

  const zones = useMemo(() => {
    try { return Intl.supportedValuesOf('timeZone'); } catch { return ['Asia/Singapore', 'Europe/London', 'America/New_York']; }
  }, []);

  useEffect(() => {
    fetch('/api/family/timezone', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTimezone(d?.timezone ?? ''))
      .catch(() => setTimezone(''));
  }, []);

  const save = async (value) => {
    const previous = timezone;
    setTimezone(value);
    setSaving(true);
    try {
      const res = await fetch('/api/family/timezone', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ timezone: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save the timezone');
      setTimezone(data.timezone);
      refreshPoints(queryClient);
      toast.success('Timezone saved');
    } catch (e) {
      setTimezone(previous);
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-white/80">
      <CardContent className="p-4 space-y-2">
        <Label htmlFor="family-timezone" className="text-sm font-medium text-slate-700">Timezone</Label>
        <select
          id="family-timezone"
          className="w-full h-11 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={timezone ?? ''}
          disabled={timezone === null || saving}
          onChange={(e) => e.target.value && save(e.target.value)}
        >
          <option value="" disabled>{timezone === null ? 'Loading…' : 'Choose your timezone'}</option>
          {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
        </select>
        <p className="text-xs text-slate-500">Weeks start on Monday at midnight in this timezone.</p>
      </CardContent>
    </Card>
  );
}
