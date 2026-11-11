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
import { Activity as ActivityIcon, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import ChildAvatar from "../components/child/ChildAvatar";
import { childColour } from "@/lib/childColour";
import Logo from "@/components/brand/Logo";
import { format, isToday, isYesterday, isSameWeek } from "date-fns";
import { PERCY } from "@/constants/terminology";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorCard from "../components/ErrorCard";

const PAGE_SIZE = 50;

function getDateGroup(dateStr) {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isSameWeek(date, new Date(), { weekStartsOn: 1 })) return 'This Week';
  return 'Earlier';
}

export default function Activity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [correctionTarget, setCorrectionTarget] = useState(null);
  const [correcting, setCorrecting] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [allEvents, setAllEvents] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedExpanded, setFeedExpanded] = useState(false);

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
      const token = getToken();
      const res = await fetch('/api/summary', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  const fetchFeed = async (filter, offsetVal = 0) => {
    const token = getToken();
    const params = new URLSearchParams({
      filter,
      limit: PAGE_SIZE,
      offset: offsetVal,
    });
    const res = await fetch(`/api/activity-feed?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to load activity');
    return res.json();
  };

  const { isLoading, isError, refetch } = useQuery({
    queryKey: ['activityFeed', activeFilter],
    queryFn: async () => {
      const events = await fetchFeed(activeFilter);
      setAllEvents(events);
      setOffset(PAGE_SIZE);
      setHasMore(events.length === PAGE_SIZE);
      return events;
    },
    enabled: !!user,
  });

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const moreEvents = await fetchFeed(activeFilter, offset);
      setAllEvents(prev => [...prev, ...moreEvents]);
      setOffset(prev => prev + PAGE_SIZE);
      setHasMore(moreEvents.length === PAGE_SIZE);
    } catch {
      // Silently fail
    }
    setLoadingMore(false);
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setOffset(0);
    setAllEvents([]);
  };

  if (isLoading) return <div className="min-h-screen p-6"><LoadingSpinner message="Loading activity..." /></div>;
  if (isError) return <div className="min-h-screen p-6"><ErrorCard message="Couldn't load activity" onRetry={refetch} /></div>;

  const filteredEvents = selectedChildId === "all"
    ? allEvents
    : allEvents.filter(e => e.child_id === selectedChildId);

  // Group events by date label
  const groupedEvents = [];
  let lastGroup = null;
  for (const event of filteredEvents) {
    const group = getDateGroup(event.created_date);
    if (group !== lastGroup) {
      groupedEvents.push({ type: 'header', label: group });
      lastGroup = group;
    }
    groupedEvents.push({ type: 'event', event });
  }

  // Compute weekly summary stats
  const totalWeeklyPoints = summary?.childStats?.reduce((sum, c) => sum + c.week_points, 0) || 0;
  const activeDays = summary?.activeDays ?? 0;
  const topCategories = summary?.topCategories?.slice(0, 3) || [];

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
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="font-display text-title font-semibold text-foreground flex items-center gap-3">
            <ActivityIcon className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            Activity
          </h1>
        </div>

        {/* Weekly Summary — primary view */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-semibold text-foreground mb-3">This Week</h2>
            {/* Two equal boxes, number and label centred in each. */}
            <div className="grid grid-cols-2 gap-4 mb-4 max-w-sm">
              <div className="bg-earn-soft rounded-md px-4 py-3 flex flex-col items-center justify-center text-center">
                <div className="text-title font-semibold text-earn tabular-nums">+{totalWeeklyPoints}</div>
                <div className="text-xs text-muted-foreground">{PERCY.POINTS} earned</div>
              </div>
              <div className="bg-star-soft rounded-md px-4 py-3 flex flex-col items-center justify-center text-center">
                <div className="text-title font-semibold text-foreground tabular-nums">{activeDays}</div>
                <div className="text-xs text-muted-foreground">active day{activeDays !== 1 ? 's' : ''}</div>
              </div>
            </div>
            {topCategories.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">Top categories</h3>
                <div className="space-y-1">
                  {topCategories.map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{cat.category}</span>
                      <span className="font-semibold text-earn tabular-nums">+{cat.total_points}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {totalWeeklyPoints === 0 && topCategories.length === 0 && (
              <p className="text-sm text-muted-foreground">No activity yet this week. Award some points to get started!</p>
            )}
          </CardContent>
        </Card>

        {/* Raw Feed — collapsed by default */}
        <div>
          <h2 className="mb-3">
            <button
              onClick={() => setFeedExpanded(!feedExpanded)}
              aria-expanded={feedExpanded}
              className="flex items-center gap-2 w-full min-h-11 text-left text-base font-semibold text-foreground rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ClipboardList className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              Activity log
              <span className="text-muted-foreground ml-auto">
                {feedExpanded ? <ChevronUp className="w-5 h-5" aria-hidden="true" /> : <ChevronDown className="w-5 h-5" aria-hidden="true" />}
              </span>
            </button>
          </h2>

          {feedExpanded && (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex gap-2">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'earned', label: 'Earned' },
                    { key: 'spent', label: 'Spent' },
                  ].map(({ key, label }) => (
                    <Button
                      key={key}
                      variant={activeFilter === key ? 'default' : 'outline'}
                      size="sm"
                      aria-pressed={activeFilter === key}
                      onClick={() => handleFilterChange(key)}
                    >
                      {label}
                    </Button>
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
                          <SelectItem key={child.id} value={child.id}>
                            {child.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Card>
                <CardContent className="p-0">
                  {groupedEvents.length === 0 ? (
                    <div className="py-12 flex flex-col items-center gap-3 text-center text-muted-foreground">
                      <Logo size={48} decorative />
                      No activity found
                    </div>
                  ) : (
                    <div>
                      {groupedEvents.map((item) => {
                        if (item.type === 'header') {
                          return (
                            <div key={`header-${item.label}`} className="px-4 py-2 bg-muted border-b border-border">
                              <span className="text-xs font-semibold text-muted-foreground">
                                {item.label}
                              </span>
                            </div>
                          );
                        }
                        return <NarrativeItem key={`${item.event.type}-${item.event.id}`} event={item.event} colour={childColour(item.event.child_id, children)} canCorrect={canCorrect(item.event)} onCorrect={() => setCorrectionTarget(item.event)} />;
                      })}
                    </div>
                  )}
                </CardContent>
                {hasMore && (
                  <div className="p-4 border-t border-border flex justify-center">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? 'Loading...' : 'Load More'}
                    </Button>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
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

function NarrativeItem({ event, colour, canCorrect, onCorrect }) {
  const isEarn = event.type === 'earn';
  const isSpend = event.type === 'spend';

  const isStarting = event.type === 'starting';
  const isCorrection = event.type === 'correction';
  const isUndo = event.type === 'undo';
  const isDeduct = !isEarn && !isSpend && !isStarting && !isCorrection && !isUndo && event.points < 0;
  // Earned in green; spends in muted ink; deductions, undo and corrections in
  // ink. Each number also carries its sign, so colour is never the only cue.
  const colorClass = isEarn
    ? 'text-earn'
    : isSpend
      ? 'text-spend'
      : 'text-negative';

  const action = isUndo ? 'undo:' : isEarn ? 'earned' : isSpend ? 'spent on' : isDeduct ? 'had an earlier adjustment for'
    : isStarting ? 'started with' : isCorrection ? 'had a one-off' : 'adjusted';
  // An undone award or spend and its undo row are both shown, struck through,
  // so the list still adds up to the balance.
  const undone = !!event.undone;

  // Use note as primary label when category is "Other"
  const displayLabel = event.label === 'Other' && event.note
    ? event.note
    : event.label;
  const displayNote = event.label === 'Other' && event.note
    ? null
    : event.note;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
      <ChildAvatar name={event.child_name} size="sm" colour={colour} />

      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <span className="font-semibold text-foreground">{event.child_name}</span>
          {' '}<span className="text-muted-foreground">{action}</span>{' '}
          <span className="font-medium text-foreground">
            {isSpend ? displayLabel : displayLabel}
          </span>
        </p>
        {displayNote && !isSpend && (
          <p className="text-xs text-subtle-foreground mt-0.5 truncate">{displayNote}</p>
        )}
        <p className="text-xs text-subtle-foreground mt-0.5">
          {format(new Date(event.created_date), "MMM d, h:mm a")}
          {undone && !isUndo && ' · undone'}
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
