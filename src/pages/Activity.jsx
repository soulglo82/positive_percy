// V1-C Activity (approved design 9de1df2, screen "activity";
// docs/engineering/V1-C-DESIGN.md). Every row comes from /api/activity-feed;
// the four filters are server projections of "All" (goal rows are tagged by
// the completion join). Correct (this week's awards) and the undone marking
// are kept from A2.
import { pointsWord } from '@/lib/savings';
import { useRef, useState } from 'react';
import { Child } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { getToken } from "@/lib/AuthContext";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { correctAward, refreshPoints, undoAction } from "@/lib/points";
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
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorCard from "../components/ErrorCard";

const PAGE_SIZE = 50;
export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'earned', label: 'Earned' },
  { key: 'goals', label: 'Goals' },
  { key: 'spent', label: 'Spent' },
];

// Calendar parts of an instant in the family's zone (owner, PR #62: days,
// Today/Yesterday and times use the same zone as the weekly totals). With no
// zone yet, the browser's.
// A zone this browser does not know falls back to the browser's own (code
// review of #62: an older browser must not fail to draw the page).
export function safeZone(timeZone) {
  if (!timeZone) return undefined;
  try { new Intl.DateTimeFormat('en-GB', { timeZone }); return timeZone; } catch { return undefined; }
}
function partsIn(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const n = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).map((x) => [x.type, x.value]));
  return { key: `${n.year}-${n.month}-${n.day}`, year: p.year, text: `${p.weekday} ${p.day} ${p.month}` };
}
const dayBefore = (key) => {
  const d = new Date(key + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// "Today · Wednesday 18 November", "Yesterday · Tuesday 17 November", then
// "Monday 16 November", with the year when it is not this year (A1).
export function dayLabel(dateStr, now = new Date(), timeZone = undefined) {
  const day = partsIn(new Date(dateStr), timeZone);
  const today = partsIn(now, timeZone);
  if (day.key === today.key) return 'Today · ' + day.text;
  if (day.key === dayBefore(today.key)) return 'Yesterday · ' + day.text;
  return day.year === today.year ? day.text : `${day.text} ${day.year}`;
}

export function timeIn(dateStr, timeZone = undefined) {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(dateStr));
}

// The goal's name when it was completed: the completion writes it into the
// award's note ("Today’s Goal: {title}", server/todaysGoals.js). Only for an
// award linked to a completion; otherwise nothing is invented (A4).
const GOAL_NOTE = 'Today’s Goal: ';
export function goalTitleOf(event) {
  if (!event.goal_completion_id || typeof event.note !== 'string' || !event.note.startsWith(GOAL_NOTE)) return null;
  const title = event.note.slice(GOAL_NOTE.length).trim();
  return title || null;
}

export default function Activity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const undoHandlers = useRef(new Map()); // one Undo handler per redemption (see undoSpendFor)
  const [correctionTarget, setCorrectionTarget] = useState(null);
  const [correcting, setCorrecting] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
  });

  // Weekly summary. The server works out the week in the family's timezone.
  // The week's figures and the family's zone. The log waits for it, so days
  // are grouped in the family's zone from the first render.
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ['weeklySummary'],
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await fetch('/api/summary', { headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error('Failed to load summary');
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

  // Pages per filter and child (code review of #62). A refresh (Correct, Undo,
  // another parent) reloads every loaded page, so the list never collapses or
  // skips rows; rows are de-duplicated by kind and id across pages.
  const feed = useInfiniteQuery({
    queryKey: ['activityFeed', activeFilter, selectedChildId],
    queryFn: ({ pageParam }) => fetchFeed(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length === PAGE_SIZE ? pages.reduce((n, p) => n + p.length, 0) : undefined),
    // Keep the list on screen while another filter or child loads (dimmed).
    placeholderData: (previous) => previous,
    enabled: !!user,
  });
  const seen = new Set();
  const allEvents = (feed.data?.pages || []).flat().filter((e) => {
    const key = e.type + '-' + e.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if ((feed.isLoading && !allEvents.length) || summaryLoading) {
    return <div className="min-h-screen p-6"><LoadingSpinner message="Loading activity..." /></div>;
  }
  if (feed.isError) return <div className="min-h-screen p-6"><ErrorCard message="Couldn't load activity" onRetry={feed.refetch} /></div>;
  if (summaryError) return <div className="min-h-screen p-6"><ErrorCard message="Couldn't load activity" onRetry={refetchSummary} /></div>;

  const timeZone = safeZone(summary?.timezone);
  // Group events by day in the family's zone, newest first.
  const groups = [];
  for (const event of allEvents) {
    const label = dayLabel(event.created_date, new Date(), timeZone);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.events.push(event);
    else groups.push({ label, events: [event] });
  }

  const pointsEarned = summary?.childStats?.reduce((sum, c) => sum + c.week_points, 0) || 0;
  const goalsCompleted = summary?.goalsCompleted ?? 0;

  const canCorrect = (event) => event.type === 'earn' && !event.undone &&
    !!summary?.weekStart && new Date(event.created_date) >= new Date(summary.weekStart);

  // A redeemed reward can be undone for 10 minutes (V1-D §10 R3: approving a
  // request has no Undo in its toast; "each redemption is undone one at a
  // time in Activity"). The server enforces the window; this only decides
  // whether to offer it. Final validation 2026-11-22: the control was missing.
  const canUndoSpend = (event) => event.type === 'spend' && !event.undone &&
    Date.now() - new Date(event.created_date).getTime() < UNDO_WINDOW_MS;
  // One handler per redemption for the life of the page (code review, 22 Nov):
  // made during render it was new on every render, so its one-tap guard and
  // its request id did not survive a refetch, and a second tap sent a second
  // undo with a new id ("Undone" then "Already undone").
  const undoSpendFor = (id) => {
    if (!undoHandlers.current.has(id)) undoHandlers.current.set(id, undoAction('spend', id, queryClient));
    return undoHandlers.current.get(id);
  };

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
                  <button key={key} type="button" aria-pressed={activeFilter === key} onClick={() => setActiveFilter(key)}
                    className={cn('min-h-11 rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      activeFilter === key ? 'border-2 border-selected-border bg-selected text-primary' : 'border border-border bg-card text-foreground hover:bg-accent')}>
                    {label}
                  </button>
                ))}
              </div>
              {children.length > 1 && (
                <div className="w-44">
                  <Select value={selectedChildId} onValueChange={setSelectedChildId}>
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

            <div aria-busy={feed.isPlaceholderData} className={feed.isPlaceholderData ? 'rounded-lg bg-muted' : undefined}>
            {groups.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3 text-center text-muted-foreground">
                <Logo size={48} decorative />
                No activity found
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <section key={group.label} aria-label={group.label}>
                    {/* As approved: the day on a tinted band, rows separated by lines with no outer box (visual review). */}
                    <h3 className="rounded-md bg-warning px-3 py-2 text-sm font-semibold text-foreground">{group.label}</h3>
                    <div>
                      {group.events.map((event) => (
                        <NarrativeItem key={`${event.type}-${event.id}`} event={event} timeZone={timeZone}
                          canCorrect={canCorrect(event)} onCorrect={() => setCorrectionTarget(event)}
                          onUndoSpend={canUndoSpend(event) ? undoSpendFor(event.id) : null} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
            </div>
            {feed.hasNextPage && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => feed.fetchNextPage().catch(() => toast.error("Couldn't load activity"))} disabled={feed.isFetchingNextPage}>
                  {feed.isFetchingNextPage ? 'Loading...' : 'Load earlier activity'}
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
              Remove {correctionTarget?.points} mistakenly awarded {pointsWord(correctionTarget?.points)} from {correctionTarget?.child_name}?
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

// Matches the server's undo window (routes.js UNDO_WINDOW).
const UNDO_WINDOW_MS = 10 * 60 * 1000;

// The approved row icons: a tick for a goal, a heart for an award, a gift for
// a spend (approved icon set). Other kinds: Undo's arrow, or the info mark.
// Literal ids only (release gate: no computed PercyIcon ids).
export function rowIconKind(event) {
  if (event.type === 'earn') return event.goal_completion_id ? 'goal' : 'earn';
  if (event.type === 'spend') return 'spend';
  if (event.type === 'undo') return 'undo';
  if (event.type === 'saving' || event.type === 'moved_back' || event.type === 'savings_ended') return 'saving';
  return 'other';
}
function RowIcon({ event }) {
  const cls = 'h-6 w-6 shrink-0 text-primary';
  switch (rowIconKind(event)) {
    case 'goal': return <PercyIcon id="phosphor:check-circle:duotone" className={cls} />;
    case 'earn': return <PercyIcon id="phosphor:hand-heart:duotone" className={cls} />;
    case 'spend': return <PercyIcon id="phosphor:gift:duotone" className={cls} />;
    case 'undo': return <PercyIcon id="phosphor:arrow-counter-clockwise:duotone" className={cls} />;
    case 'saving': return <PercyIcon id="phosphor:piggy-bank:duotone" className={cls} />;
    default: return <PercyIcon id="phosphor:info:duotone" className={cls} />;
  }
}

// One row: the approved line shapes (design §2). Other kinds keep their
// shipped wording.
export function rowText(event, timeZone = undefined) {
  const time = timeIn(event.created_date, timeZone);
  if (event.type === 'earn' && event.goal_completion_id) {
    const title = goalTitleOf(event);
    return { lead: 'completed', what: title ? `“${title}”` : 'a goal', sub: `Today’s Goal · ${event.label} · ${time}` };
  }
  if (event.type === 'earn') {
    const swap = event.label === 'Other' && event.note;
    const what = swap ? event.note : event.label;
    const note = swap ? null : event.note;
    return { lead: 'earned', what, sub: note ? `${note} · ${time}` : time };
  }
  // No parent confirmation is recorded on a redemption (and before V1 a child
  // could redeem directly), so no row claims one (A2).
  if (event.type === 'spend') return { lead: 'redeemed', what: event.label, sub: `Reward redeemed · ${time}` };
  // D1 savings moves (owner's proposed O4 wording): not balance changes.
  const pts = `${event.points} ${pointsWord(event.points)}`;
  if (event.type === 'saving') return { lead: `saved ${pts} towards`, what: event.label, sub: `Savings · ${time}` };
  if (event.type === 'moved_back') return { lead: `moved ${pts} back from`, what: event.label, sub: `Savings · ${time}` };
  // D1 §20.1 (owner review of #64, N2): why saved points stopped counting.
  // Provisional wording (§20.8): "released", not "available again".
  // Owner wording (21 Nov): a cancellation, never a success or an earning.
  // The child's name stands in for a pronoun (no pronouns are stored).
  if (event.type === 'savings_ended') {
    // Owner wording (handover 21 Nov): "{Child}'s {Goal} savings are back in
    // their points." · "{n} points returned · {reason}".
    const cause = event.note === 'unmarked' ? 'Bigger goal removed'
      : event.note === 'deleted' ? 'Reward deleted' : 'No longer assigned';
    return { possessive: true, lead: '', what: event.label, after: 'savings are back in their points.',
      sub: `${event.points} ${pointsWord(event.points)} returned · ${cause} · ${time}` };
  }
  const lead = event.type === 'undo' ? 'undo:' : event.type === 'starting' ? 'started with'
    : event.type === 'correction' ? 'had a one-off' : event.points < 0 ? 'had an earlier adjustment for' : 'adjusted';
  return { lead, what: event.label, sub: time };
}

function NarrativeItem({ event, timeZone, canCorrect, onCorrect, onUndoSpend = null }) {
  const isEarn = event.type === 'earn';
  const isSpend = event.type === 'spend';
  // Earned in green; spends in muted ink; deductions, undo and corrections in
  // ink. Each number also carries its sign, so colour is never the only cue.
  const colorClass = isEarn ? 'text-earn' : isSpend ? 'text-spend' : 'text-negative';
  // An undone award or spend and its undo row are both shown, the amount
  // struck through, so the list still adds up to the balance.
  const undone = !!event.undone;
  const { lead, what, sub, possessive = false, after = null } = rowText(event, timeZone);

  return (
    <div data-row-key={`${event.type}-${event.id}`} className="flex items-center gap-3 px-3 py-3 border-b border-border last:border-b-0">
      <RowIcon event={event} />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug break-words">
          <span className="font-semibold text-foreground">{event.child_name}{possessive ? '’s' : ''}</span>
          {' '}<span className="text-muted-foreground">{lead}</span>{' '}
          <span className="font-medium text-foreground">{what}</span>
          {after && <>{' '}<span className="text-muted-foreground">{after}</span></>}
        </p>
        <p className="text-xs text-subtle-foreground mt-0.5 break-words">
          {sub}
          {undone && event.type !== 'undo' && ' · undone'}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {/* A savings move changes no balance, so it has no amount column. */}
        {rowIconKind(event) !== 'saving' && (
        <span className={`text-sm font-semibold tabular-nums ${colorClass} ${undone ? 'line-through' : ''}`}>
          {isEarn ? '+' : (isSpend || event.points < 0) ? '−' : '+'}{Math.abs(event.points)}
        </span>
        )}
        {canCorrect && (
          <button type="button" onClick={onCorrect} className="min-h-11 px-2 text-xs font-semibold text-foreground underline rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Correct ${event.child_name} award of ${event.points} ${pointsWord(event.points)}`}>
            Correct
          </button>
        )}
        {onUndoSpend && (
          <button type="button" onClick={onUndoSpend} className="min-h-11 px-2 text-xs font-semibold text-foreground underline rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Undo ${event.child_name} redeemed ${event.label}`}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
