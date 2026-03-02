import React, { useState } from 'react';
import { Child, Point_Event } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Award, Target, Calendar, ChevronDown, ChevronUp, Plus, Minus, Heart } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorCard from "../components/ErrorCard";

export default function Summary() {
  const { user } = useAuth();
  const [expandedChildId, setExpandedChildId] = useState(null);

  const { data: children = [], isLoading: childrenLoading, isError: childrenError, refetch: childrenRefetch } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
  });

  const { data: allEvents = [] } = useQuery({
    queryKey: ['pointEvents'],
    queryFn: () => Point_Event.list('-created_date', 200),
  });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const weeklyEvents = allEvents.filter(event => {
    const eventDate = new Date(event.created_date);
    return eventDate >= weekStart && eventDate <= weekEnd;
  });

  const getTotalWeeklyPoints = () => {
    return weeklyEvents.reduce((sum, event) => sum + (event.points > 0 ? event.points : 0), 0);
  };

  const getChildWeeklyStats = (childId, childName) => {
    const childEvents = weeklyEvents.filter(e => e.child_id === childId);
    const positivePoints = childEvents.reduce((sum, e) => sum + (e.points > 0 ? e.points : 0), 0);
    const negativePoints = Math.abs(childEvents.reduce((sum, e) => sum + (e.points < 0 ? e.points : 0), 0));
    const netPoints = positivePoints - negativePoints;
    const totalEvents = childEvents.length;

    const categoryBreakdown = {};
    childEvents.forEach(event => {
      if (!categoryBreakdown[event.category]) {
        categoryBreakdown[event.category] = { count: 0, points: 0 };
      }
      categoryBreakdown[event.category].count++;
      categoryBreakdown[event.category].points += event.points;
    });

    return {
      positivePoints,
      negativePoints,
      netPoints,
      totalEvents,
      categoryBreakdown: Object.entries(categoryBreakdown)
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 3),
    };
  };

  const getTopCategories = () => {
    const categoryTotals = {};
    weeklyEvents.forEach(event => {
      if (event.points > 0) {
        categoryTotals[event.category] = (categoryTotals[event.category] || 0) + event.points;
      }
    });
    return Object.entries(categoryTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
  };

  const getChildRatio = (childId) => {
    const childEvents = weeklyEvents.filter(e => e.child_id === childId);
    const positiveCount = childEvents.filter(e => e.points > 0).length;
    const negativeCount = childEvents.filter(e => e.points < 0).length;
    if (negativeCount === 0) return { ratio: positiveCount > 0 ? positiveCount : null, positiveCount, negativeCount };
    return { ratio: Math.round((positiveCount / negativeCount) * 10) / 10, positiveCount, negativeCount };
  };

  const getRatioColor = (ratio) => {
    if (ratio === null) return 'text-slate-400';
    if (ratio >= 5) return 'text-green-600';
    if (ratio >= 3) return 'text-amber-600';
    return 'text-rose-600';
  };

  const getRatioBg = (ratio) => {
    if (ratio === null) return 'bg-slate-50';
    if (ratio >= 5) return 'bg-green-50';
    if (ratio >= 3) return 'bg-amber-50';
    return 'bg-rose-50';
  };

  const getRatioMessage = (ratio) => {
    if (ratio === null) return 'No activity yet';
    if (ratio >= 5) return 'Great balance!';
    if (ratio >= 3) return 'Could use more positives';
    return 'Try to add more positive reinforcement';
  };

  const totalWeeklyPoints = getTotalWeeklyPoints();
  const totalWeeklyTarget = children.reduce((sum, child) => sum + child.weekly_target, 0);
  const childrenOnTrack = children.filter(child => child.weekly_points >= child.weekly_target).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
            <Award className="w-10 h-10 text-indigo-600" />
            Weekly Summary
          </h1>
          <p className="text-slate-600 mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </p>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Total Points Earned</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{totalWeeklyPoints}</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Weekly Target</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{totalWeeklyTarget}</div>
                <p className="text-xs text-slate-500 mt-1">
                  {Math.round((totalWeeklyPoints / totalWeeklyTarget) * 100)}% achieved
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Children On Track</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-indigo-600">
                  {childrenOnTrack} / {children.length}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Total Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600">{weeklyEvents.length}</div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Positivity Health (FEAT-002) */}
        {children.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-500" />
                Positivity Health
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Research shows a 5:1 ratio of positive to negative interactions works best
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {children.map((child) => {
                  const { ratio, positiveCount, negativeCount } = getChildRatio(child.id);
                  return (
                    <div key={child.id} className={`rounded-xl p-4 ${getRatioBg(ratio)}`}>
                      <div className="flex items-center gap-3 mb-2">
                        {child.avatar_url ? (
                          <img src={child.avatar_url} alt={child.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                            {child.name.charAt(0)}
                          </div>
                        )}
                        <span className="font-semibold text-slate-800">{child.name}</span>
                      </div>
                      <div className={`text-2xl font-bold ${getRatioColor(ratio)}`}>
                        {ratio === null ? '--' : `${ratio}:1`}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {positiveCount} positive / {negativeCount} adjustments
                      </div>
                      <div className={`text-xs font-medium mt-2 ${getRatioColor(ratio)}`}>
                        {getRatioMessage(ratio)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Top Categories This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getTopCategories().length === 0 ? (
              <p className="text-slate-500 text-center py-4">No activities this week</p>
            ) : (
              <div className="space-y-3">
                {getTopCategories().map(([category, points], index) => (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        ['bg-green-100 text-green-600', 'bg-blue-100 text-blue-600', 'bg-purple-100 text-purple-600', 'bg-orange-100 text-orange-600', 'bg-pink-100 text-pink-600'][index]
                      }`}>
                        {index + 1}
                      </div>
                      <span className="font-medium text-slate-800">{category}</span>
                    </div>
                    <Badge className="bg-green-100 text-green-700 border-0">
                      +{points} points
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Individual Child Progress */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-purple-600" />
            Individual Progress
          </h2>
          <p className="text-sm text-slate-500 mb-4">Tap a child to see their full point history</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {children.map((child, index) => {
              const stats = getChildWeeklyStats(child.id, child.name);
              const progressPercent = Math.min((child.weekly_points / child.weekly_target) * 100, 100);
              const isOnTrack = child.weekly_points >= child.weekly_target;
              const isExpanded = expandedChildId === child.id;
              const childEvents = weeklyEvents
                .filter(e => e.child_id === child.id)
                .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

              return (
                <motion.div
                  key={child.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <Card
                    className={`overflow-hidden border-2 hover:shadow-lg transition-all cursor-pointer ${isExpanded ? 'border-purple-300 shadow-lg' : ''}`}
                    onClick={() => setExpandedChildId(isExpanded ? null : child.id)}
                  >
                    <div className={`h-2 ${isOnTrack ? 'bg-green-400' : 'bg-purple-400'}`} />
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4 mb-4">
                        {child.avatar_url ? (
                          <img
                            src={child.avatar_url}
                            alt={child.name}
                            className="w-16 h-16 rounded-full object-cover border-4 border-purple-100"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-2xl font-bold">
                            {child.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-slate-800">{child.name}</h3>
                          <Badge className={isOnTrack ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                            {child.weekly_points} / {child.weekly_target} points
                          </Badge>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${isOnTrack ? 'bg-green-500' : 'bg-purple-500'}`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">+{stats.positivePoints}</div>
                          <div className="text-xs text-slate-500">Earned</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-rose-600">-{stats.negativePoints}</div>
                          <div className="text-xs text-slate-500">Removed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-slate-800">{stats.totalEvents}</div>
                          <div className="text-xs text-slate-500">Activities</div>
                        </div>
                      </div>

                      {/* Top Categories */}
                      {stats.categoryBreakdown.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-2">Top Activities:</p>
                          <div className="flex flex-wrap gap-2">
                            {stats.categoryBreakdown.map(([category, data]) => (
                              <Badge key={category} variant="outline" className="text-xs">
                                {category} ({data.count})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Expanded: Point History */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-4 border-t border-slate-200">
                              <p className="text-sm font-semibold text-slate-700 mb-3">Point History (This Week)</p>
                              {childEvents.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-3">No activity this week</p>
                              ) : (
                                <div className="space-y-2">
                                  {childEvents.map((event) => {
                                    const isPositive = event.points > 0;
                                    return (
                                      <div key={event.id} className={`flex items-start gap-3 p-3 rounded-lg ${isPositive ? 'bg-green-50' : 'bg-rose-50'}`}>
                                        <div className={`p-1.5 rounded-full mt-0.5 ${isPositive ? 'bg-green-200' : 'bg-rose-200'}`}>
                                          {isPositive ? <Plus className="w-3 h-3 text-green-700" /> : <Minus className="w-3 h-3 text-rose-700" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-2">
                                            <Badge variant="outline" className="text-xs">{event.category}</Badge>
                                            <span className={`font-bold text-sm ${isPositive ? 'text-green-600' : 'text-rose-600'}`}>
                                              {isPositive ? '+' : ''}{event.points}
                                            </span>
                                          </div>
                                          {event.note && (
                                            <p className="text-sm text-slate-600 mt-1">{event.note}</p>
                                          )}
                                          <p className="text-xs text-slate-400 mt-1">
                                            {format(new Date(event.created_date), "EEE, MMM d 'at' h:mm a")}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
