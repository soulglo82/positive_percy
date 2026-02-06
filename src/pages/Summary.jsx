import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Award, Target, Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { motion } from "framer-motion";

export default function Summary() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => base44.entities.Child.list(),
    enabled: !!user,
  });

  const { data: allEvents = [] } = useQuery({
    queryKey: ['pointEvents'],
    queryFn: () => base44.entities.Point_Event.list('-created_date', 200),
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {children.map((child, index) => {
              const stats = getChildWeeklyStats(child.id, child.name);
              const progressPercent = Math.min((child.weekly_points / child.weekly_target) * 100, 100);
              const isOnTrack = child.weekly_points >= child.weekly_target;

              return (
                <motion.div
                  key={child.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <Card className="overflow-hidden border-2 hover:shadow-lg transition-all">
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
                        <div>
                          <h3 className="text-xl font-bold text-slate-800">{child.name}</h3>
                          <Badge className={isOnTrack ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                            {child.weekly_points} / {child.weekly_target} points
                          </Badge>
                        </div>
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
