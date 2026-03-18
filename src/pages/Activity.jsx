import React, { useState } from 'react';
import { Child } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { getToken } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity as ActivityIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, isToday, isYesterday, startOfWeek, isSameWeek, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, addMonths } from "date-fns";
import { motion } from "framer-motion";
import { PERCY, formatPoints } from "@/constants/terminology";
import SectionHeader from "../components/SectionHeader";
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
  const [selectedChildId, setSelectedChildId] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [allEvents, setAllEvents] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
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

  // Calendar data: aggregate points per day per child for the selected month
  const { data: calendarData = [] } = useQuery({
    queryKey: ['calendarData', calendarMonth.toISOString().slice(0, 7)],
    queryFn: async () => {
      const token = getToken();
      const monthStart = startOfMonth(calendarMonth).toISOString();
      const monthEnd = endOfMonth(calendarMonth).toISOString();
      const res = await fetch(`/api/activity-feed?filter=earned&limit=500&offset=0`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const events = await res.json();
      // Aggregate by date
      const byDate = {};
      for (const e of events) {
        const day = format(new Date(e.created_date), 'yyyy-MM-dd');
        const monthKey = format(calendarMonth, 'yyyy-MM');
        if (day.startsWith(monthKey)) {
          byDate[day] = (byDate[day] || 0) + (e.points > 0 ? e.points : 0);
        }
      }
      return byDate;
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

  if (isLoading) return <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6"><LoadingSpinner message="Loading activity..." /></div>;
  if (isError) return <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6"><ErrorCard message="Couldn't load activity" onRetry={refetch} /></div>;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
            <ActivityIcon className="w-10 h-10 text-blue-600" />
            Recent Activity
          </h1>
          <p className="text-slate-600 mt-1">Track all earned and spent {PERCY.POINTS_COMPACT.toLowerCase()}</p>
        </div>

        <SectionHeader icon="🔍">Filter</SectionHeader>
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
              onClick={() => handleFilterChange(key)}
              className={activeFilter === key
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : ''
              }
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Child Filter */}
        {children.length > 1 && (
          <div className="max-w-xs">
            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
              <SelectTrigger>
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

        {/* Calendar Heatmap */}
        <SectionHeader icon="📅">Monthly Overview</SectionHeader>
        <CalendarHeatmap
          month={calendarMonth}
          data={calendarData}
          onPrevMonth={() => setCalendarMonth(subMonths(calendarMonth, 1))}
          onNextMonth={() => setCalendarMonth(addMonths(calendarMonth, 1))}
        />

        <SectionHeader icon="📋">Activity Feed</SectionHeader>
        <Card>
          <CardContent className="p-0">
            {groupedEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                No activity found
              </div>
            ) : (
              <div>
                {groupedEvents.map((item, i) => {
                  if (item.type === 'header') {
                    return (
                      <div key={`header-${item.label}`} className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {item.label}
                        </span>
                      </div>
                    );
                  }
                  return <NarrativeItem key={`${item.event.type}-${item.event.id}`} event={item.event} />;
                })}
              </div>
            )}
          </CardContent>
          {hasMore && (
            <div className="p-4 border-t flex justify-center">
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
      </div>
    </div>
  );
}

function NarrativeItem({ event }) {
  const isEarn = event.type === 'earn';
  const isSpend = event.type === 'spend';

  const icon = isEarn ? '⭐' : isSpend ? '🎁' : '⚙️';
  const colorClass = isEarn
    ? 'text-green-600'
    : isSpend
      ? 'text-orange-600'
      : 'text-slate-500';

  // Narrative line format
  const action = isEarn ? 'earned' : isSpend ? 'spent' : 'adjusted';

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0">
      <span className="text-lg mt-0.5 shrink-0">{icon}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 leading-snug">
              {icon} {event.child_name} {action}{' '}
              <span className={colorClass}>
                {formatPoints(Math.abs(event.points), { compact: true, showSign: isEarn })}
              </span>
            </p>
            {(event.label || event.note) && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {event.label}{event.note ? ` — ${event.note}` : ''}
              </p>
            )}
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap shrink-0 mt-0.5">
            {format(new Date(event.created_date), "h:mm a")}
          </span>
        </div>
      </div>
    </div>
  );
}

function CalendarHeatmap({ month, data, onPrevMonth, onNextMonth }) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate max for color scaling
  const values = Object.values(data || {}).filter(v => v > 0);
  const maxPoints = values.length > 0 ? Math.max(...values) : 1;

  // Pad start for alignment (week starts on Monday)
  const startDayOfWeek = (getDay(monthStart) + 6) % 7; // 0=Mon
  const paddedDays = Array(startDayOfWeek).fill(null).concat(days);

  const getIntensity = (day) => {
    if (!day) return 0;
    const key = format(day, 'yyyy-MM-dd');
    const val = (data || {})[key] || 0;
    if (val === 0) return 0;
    return Math.max(0.2, val / maxPoints);
  };

  const getColorClass = (intensity) => {
    if (intensity === 0) return 'bg-slate-100';
    if (intensity < 0.3) return 'bg-green-200';
    if (intensity < 0.6) return 'bg-green-400';
    return 'bg-green-600';
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={onPrevMonth} aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-sm font-semibold text-slate-700">
            {format(month, 'MMMM yyyy')}
          </h3>
          <Button variant="ghost" size="sm" onClick={onNextMonth} aria-label="Next month">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-xs text-slate-400 text-center font-medium">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Activity calendar for ${format(month, 'MMMM yyyy')}`}>
          {paddedDays.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} className="aspect-square" />;
            const intensity = getIntensity(day);
            const key = format(day, 'yyyy-MM-dd');
            const pointsForDay = (data || {})[key] || 0;
            return (
              <div
                key={key}
                className={`aspect-square rounded-sm flex items-center justify-center text-xs ${getColorClass(intensity)} ${
                  isToday(day) ? 'ring-2 ring-purple-400' : ''
                }`}
                role="gridcell"
                aria-label={`${format(day, 'MMMM d')}: ${pointsForDay} ${PERCY.POINTS_COMPACT.toLowerCase()}`}
                title={`${format(day, 'MMM d')}: ${pointsForDay} ${PERCY.POINTS_COMPACT.toLowerCase()}`}
              >
                <span className={`${intensity > 0.5 ? 'text-white' : 'text-slate-500'} text-[10px]`}>
                  {format(day, 'd')}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1 mt-3 text-xs text-slate-400">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-slate-100" />
          <div className="w-3 h-3 rounded-sm bg-green-200" />
          <div className="w-3 h-3 rounded-sm bg-green-400" />
          <div className="w-3 h-3 rounded-sm bg-green-600" />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
