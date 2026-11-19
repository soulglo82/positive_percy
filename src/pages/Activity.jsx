// V1-C Activity (approved design 9de1df2, screen "activity";
// docs/engineering/V1-C-DESIGN.md). Every row comes from /api/activity-feed;
// the four filters are server projections of "All" (goal rows are tagged by
// the completion join). Correct (this week's awards) and the undone marking
// are kept from A2.
import { useState } from 'react';
import { Child } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { getToken } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { correctAward, refreshPoints } from "@/lib/points";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PercyIcon from "@/components/icons/PercyIcon";
import { cn } from "@/lib/utils";
import Logo from "@/components/brand/Logo";
import { format, isSameDay, subDays } from "date-fns";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorCard from "../components/ErrorCard";

const PAGE_SIZE = 50;
export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'earned', label: 'Earned' },
  { key: 'goals', label: 'Goals' },
  { key: 'spent', label: 'Spent' },
];

// "Today · Wednesday 18 November", "Yesterday · Tuesday 17 November", and
// "Monday 16 November" for older days (owner item A1).
export function dayLabel(dateStr, now = new Date()) {
  const date = new Date(dateStr);
  const day = format(date, 'EEEE d MMMM');
  if (isSameDay(date, now)) return 'Today · ' + day;
  if (isSameDay(date, subDays(now, 1))) return 'Yesterday · ' + day;
  return day;
}

export default function Activity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [correctionTarget, setCorrectionTarget] = useState(null);
  const [correcting, setCorrecting] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [extra, setExtra] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
  });

  // Weekly summary. The server works out the week in the family's timezone.
  const { data: summary } = useQuery({
    queryKey: ['weeklySummary'],
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await fetch('/api/summary', { headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  const fetchFeed = async (offsetVal) => {
    const params = new URLSearchParams({ filter: activeFilter, limit: PAGE_SIZE, offset: offsetVal });
    if (selectedChildId !== 'all') params.set('child_id', selectedChildId);
    const res = await fetch(`/api/activity-feed?${params}`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error('Failed to load activity');
    return res.json();
  };

  // First page per filter and child; earlier pages are appended below it.
  const { data: firstPage = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['activityFeed', activeFilter, selectedChildId],
    queryFn: async () => {
      const events = await fetchFeed(0);
      setExtra([]); // a refreshed first page starts the list again
      return events;
    },
    // Keep the page on screen while another filter or child loads.
    placeholderData: (previous) => previous,
    enabled: !!user,
  });
  const allEvents = [...firstPage, ...extra];
  // Before any earlier page is loaded, a full first page means there may be more.
  const canLoadMore = extra.length ? hasMore : firstPage.length === PAGE_SIZE;

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const more = await fetchFeed(allEvents.length);
      setExtra((prev) => [...prev, ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } catch {
      toast.error("Couldn't load activity");
    }
    setLoadingMore(false);
  };

  if (isLoading && !firstPage.length) return <div className="min-h-screen p-6"><LoadingSpinner message="Loading activity..." /></div>;
  if (isError) return <div className="min-h-screen p-6"><ErrorCard message="Couldn't load activity" onRetry={refetch} /></div>;

  // Group events by day, newest first.
  const groups = [];
  for (const event of allEvents) {
    const label = dayLabel(event.created_date);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.events.push(event);
    else groups.push({ label, events: [event] });
  }

  const pointsEarned = summary?.childStats?.reduce((sum, c) => sum + c.week_points, 0) || 0;
  const goalsCompleted = summary?.goalsCompleted ?? 0;

  const canCorrect = (event) => event.type === 'earn' && !event.undone &&
    !!summary?.weekStart && new Date(event.created_date) >= new Date(summary.weekStart);

  const confirmCorrection = async () => {
    if (!correctionTarget || correcting) return;
    setCorrecting(true);
    try {
      await correctAward(correctionTarget.id);
      toast.success(`Corrected ${correctionTarget.child_name}'s mistaken award.`);
      setCorrectionTarget(null);
      refreshPoints(queryClient);
    } catch (err) {
      toast.error(err.message || "Couldn't correct this award.");
    } finally {
      setCorrecting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="font-display font-extrabold text-title text-primary">Activity</h1>
          <p className="text-muted-foreground">Every point has a story. This is your family's history.</p>
        </div>

        <Card>
          <CardContent className="p-4 sm:p-5 space-y-3">
            <h2 className="font-display font-bold text-lg text-primary">This week</h2>
            <div className="grid grid-cols-2 gap-3 max-w-md" data-week-boxes>
              <div className="rounded-md border border-border p-3 text-center">
                <p className="font-display font-extrabold text-title text-foreground tabular-nums">{pointsEarned}</p>
                <p className="text-sm font-medium text-muted-foreground">Points earned</p>
              </div>
              <div className="rounded-md border border-border p-3 text-center">
                <p className="font-display font-extrabold text-title text-foreground tabular-nums">{goalsCompleted}</p>
                <p className="text-sm font-medium text-muted-foreground">Goals completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5 space-y-4">
            <h2 className="font-display font-bold text-lg text-primary">Activity log</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Show activity">
                {FILTERS.map(({ key, label }) => (
                  <button key={key} type="button" aria-pressed={activeFilter === key} onClick={() => { setExtra([]); setActiveFilter(key); }}
                    className={cn('min-h-11 rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      activeFilter === key ? 'border-2 border-selected-border bg-selected text-primary' : 'border border-border bg-card text-foreground hover:bg-accent')}>
                    {label}
                  </button>
                ))}
              </div>
              {children.length > 1 && (
                <div className="w-44">
                  <Select value={selectedChildId} onValueChange={(v) => { setExtra([]); setSelectedChildId(v); }}>
                    <SelectTrigger aria-label="Child">
                      <SelectValue placeholder="All Children" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Children</SelectItem>
                      {children.map((child) => (
                        <SelectItem key={child.id} value={child.id}>{child.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {groups.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3 text-center text-muted-foreground">
                <Logo size={48} decorative />
                No activity found
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <section key={group.label} aria-label={group.label}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group.label}</h3>
                    <div className="rounded-lg border border-border">
                      {group.events.map((event) => (
                        <NarrativeItem key={`${event.type}-${event.id}`} event={event}
                          canCorrect={canCorrect(event)} onCorrect={() => setCorrectionTarget(event)} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
            {canLoadMore && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : 'Load earlier activity'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-5 space-y-1">
            <h2 className="font-display font-bold text-lg text-primary">Corrections and Undo</h2>
            <p className="text-sm text-muted-foreground">Historical entries remain visible when a parent corrects a mistaken award or reverses an eligible action.</p>
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={!!correctionTarget} onOpenChange={(open) => { if (!open && !correcting) setCorrectionTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Correct mistaken award?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {correctionTarget?.points} mistakenly awarded points from {correctionTarget?.child_name}?
              This corrects only the selected award, keeps an Activity record, and cannot be done if those points have been spent or reserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={correcting}>Keep award</AlertDialogCancel>
            <AlertDialogAction disabled={correcting} onClick={(e) => { e.preventDefault(); confirmCorrection(); }}>Correct award</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// The approved row icons: a tick for a goal, a heart for an award, a gift for
// a spend (approved icon set). Other kinds: Undo's arrow, or the info mark.
// Literal ids only (release gate: no computed PercyIcon ids).
export function rowIconKind(event) {
  if (event.type === 'earn') return event.goal_completion_id ? 'goal' : 'earn';
  if (event.type === 'spend') return 'spend';
  if (event.type === 'undo') return 'undo';
  return 'other';
}
function RowIcon({ event }) {
  const cls = 'h-6 w-6 shrink-0 text-primary';
  switch (rowIconKind(event)) {
    case 'goal': return <PercyIcon id="phosphor:check-circle:duotone" className={cls} />;
    case 'earn': return <PercyIcon id="phosphor:hand-heart:duotone" className={cls} />;
    case 'spend': return <PercyIcon id="phosphor:gift:duotone" className={cls} />;
    case 'undo': return <PercyIcon id="phosphor:arrow-counter-clockwise:duotone" className={cls} />;
    default: return <PercyIcon id="phosphor:info:duotone" className={cls} />;
  }
}

// One row: the approved line shapes (design §2). Other kinds keep their
// shipped wording.
export function rowText(event) {
  const time = format(new Date(event.created_date), 'h:mm a');
  if (event.type === 'earn' && event.goal_completion_id) {
    return { lead: 'completed', what: `“${event.goal_title}”`, sub: `Today’s Goal · ${event.label} · ${time}` };
  }
  if (event.type === 'earn') {
    const swap = event.label === 'Other' && event.note;
    const what = swap ? event.note : event.label;
    const note = swap ? null : event.note;
    return { lead: 'earned', what, sub: note ? `${note} · ${time}` : time };
  }
  if (event.type === 'spend') return { lead: 'redeemed', what: event.label, sub: `Parent-confirmed reward · ${time}` };
  const lead = event.type === 'undo' ? 'undo:' : event.type === 'starting' ? 'started with'
    : event.type === 'correction' ? 'had a one-off' : event.points < 0 ? 'had an earlier adjustment for' : 'adjusted';
  return { lead, what: event.label, sub: time };
}

function NarrativeItem({ event, canCorrect, onCorrect }) {
  const isEarn = event.type === 'earn';
  const isSpend = event.type === 'spend';
  // Earned in green; spends in muted ink; deductions, undo and corrections in
  // ink. Each number also carries its sign, so colour is never the only cue.
  const colorClass = isEarn ? 'text-earn' : isSpend ? 'text-spend' : 'text-negative';
  // An undone award or spend and its undo row are both shown, the amount
  // struck through, so the list still adds up to the balance.
  const undone = !!event.undone;
  const { lead, what, sub } = rowText(event);

  return (
    <div className="flex items-center gap-3 px-3 py-3 border-b border-border last:border-b-0">
      <RowIcon event={event} />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug break-words">
          <span className="font-semibold text-foreground">{event.child_name}</span>
          {' '}<span className="text-muted-foreground">{lead}</span>{' '}
          <span className="font-medium text-foreground">{what}</span>
        </p>
        <p className="text-xs text-subtle-foreground mt-0.5 break-words">
          {sub}
          {undone && event.type !== 'undo' && ' · undone'}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-sm font-semibold tabular-nums ${colorClass} ${undone ? 'line-through' : ''}`}>
          {isEarn ? '+' : (isSpend || event.points < 0) ? '−' : '+'}{Math.abs(event.points)}
        </span>
        {canCorrect && (
          <button type="button" onClick={onCorrect} className="min-h-11 px-2 text-xs font-semibold text-foreground underline rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Correct ${event.child_name} award of ${event.points} points`}>
            Correct
          </button>
        )}
      </div>
    </div>
  );
}
