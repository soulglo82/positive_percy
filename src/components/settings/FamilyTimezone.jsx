import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  // A stored zone this browser lists under another name (Asia/Kolkata vs
  // Asia/Calcutta, UTC) still shows as chosen.
  const options = useMemo(
    () => (timezone && !zones.includes(timezone) ? [timezone, ...zones] : zones),
    [timezone, zones]
  );

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
    <Card>
      <CardContent className="p-4 space-y-2">
        <Label htmlFor="family-timezone">Timezone</Label>
        {/* Always controlled ('' shows the placeholder), so a failed save
            goes back to what is stored instead of showing the rejected zone. */}
        <Select
          value={timezone || ''}
          disabled={timezone === null || saving}
          onValueChange={(v) => v && v !== timezone && save(v)}
        >
          <SelectTrigger id="family-timezone">
            <SelectValue placeholder={timezone === null ? 'Loading…' : 'Choose your timezone'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((z) => <SelectItem key={z} value={z}>{z.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Weeks start on Monday at midnight in this timezone.</p>
      </CardContent>
    </Card>
  );
}
