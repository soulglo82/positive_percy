import React, { useState } from 'react';
import { Child } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { getToken } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity as ActivityIcon, Filter, Plus, Minus, Gift } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import SectionHeader from "../components/SectionHeader";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorCard from "../components/ErrorCard";

const PAGE_SIZE = 50;

export default function Activity() {
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [allEvents, setAllEvents] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
            <ActivityIcon className="w-10 h-10 text-blue-600" />
            Recent Activity
          </h1>
          <p className="text-slate-600 mt-1">Track all earned and spent points</p>
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

        <SectionHeader icon="📋">Activity Feed</SectionHeader>
        <Card>
          <CardContent className="p-0">
            {filteredEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                No activity found
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredEvents.map((event) => (
                  <ActivityItem key={`${event.type}-${event.id}`} event={event} />
                ))}
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

function ActivityItem({ event }) {
  const isEarn = event.type === 'earn';
  const isSpend = event.type === 'spend';

  const icon = isEarn ? '⭐' : isSpend ? '🎁' : '⚙️';
  const colorClass = isEarn
    ? 'text-green-600'
    : isSpend
      ? 'text-orange-600'
      : 'text-slate-500';
  const bgClass = isEarn
    ? 'bg-green-100'
    : isSpend
      ? 'bg-orange-100'
      : 'bg-slate-100';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
    >
      <div className={`p-1.5 rounded-full ${bgClass} text-base`}>
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <h4 className="font-semibold text-slate-800">
              {event.child_name}
            </h4>
            <span className="text-sm text-slate-600 truncate">
              {event.label}
            </span>
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {format(new Date(event.created_date), "MMM d")}
            </span>
          </div>
          <span className={`font-bold text-sm ${colorClass} whitespace-nowrap`}>
            {event.points > 0 ? '+' : ''}{event.points} pts
          </span>
        </div>

        {event.note && (
          <p className="text-xs text-slate-500">
            {event.note}
          </p>
        )}
      </div>
    </motion.div>
  );
}
