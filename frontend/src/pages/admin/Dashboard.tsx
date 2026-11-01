import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Users, UserCheck, UserX, UserMinus, Clock, RefreshCw, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { AnnouncementBanner } from "../../components/AnnouncementBanner";
import { apiFetch } from "../../lib/api";

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [statsRes, weeklyRes, logsRes] = await Promise.all([
        apiFetch("/admin/stats").catch(() => null),
        apiFetch("/admin/reports/weekly?days=6").catch(() => null),
        apiFetch("/admin/logs?limit=8").catch(() => [])
      ]);

      if (statsRes) {
        setStats(statsRes);
      }

      if (weeklyRes && Array.isArray(weeklyRes.labels) && Array.isArray(weeklyRes.counts)) {
        const formatted = weeklyRes.labels.map((dateStr: string, idx: number) => {
          let dayName = dateStr;
          try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
              const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              dayName = d.toLocaleDateString("en-US", { weekday: "short" });
            }
          } catch {
            // fallback to original string
          }
          return {
            name: dayName,
            date: dateStr,
            attendance: weeklyRes.counts[idx] || 0
          };
        });
        setChartData(formatted);
      } else {
        setChartData([]);
      }

      setRecentLogs(Array.isArray(logsRes) ? logsRes : []);
    } catch (err) {
      console.error("Failed to load real admin dashboard data:", err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh stats and live scans every 15 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const totalStudents = stats?.total_students ?? 0;
  const presentToday = stats?.present_today ?? 0;
  const absentToday = stats?.absent_today ?? 0;
  const lateToday = stats?.late_today ?? 0;

  const attendanceRate = stats?.attendance_percentage !== undefined
    ? Number(stats.attendance_percentage).toFixed(1)
    : (totalStudents > 0 ? ((presentToday / totalStudents) * 100).toFixed(1) : "0.0");

  const absentRate = totalStudents > 0
    ? ((absentToday / totalStudents) * 100).toFixed(1)
    : "0.0";

  const lateRate = totalStudents > 0
    ? ((lateToday / totalStudents) * 100).toFixed(1)
    : "0.0";

  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <AnnouncementBanner />
          <div className="self-end sm:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="gap-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh Live Data"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalStudents.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Enrolled students</p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Present Today</CardTitle>
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {presentToday.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{attendanceRate}% Attendance Rate</p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Absent Today</CardTitle>
                  <UserX className="h-4 w-4 text-rose-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                    {absentToday.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{absentRate}% Absenteeism Rate</p>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Late Arrivals</CardTitle>
                  <UserMinus className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {lateToday.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{lateRate}% Late Rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts & Details Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Main Chart */}
              <Card className="col-span-1 lg:col-span-2 border-border shadow-sm">
                <CardHeader>
                  <CardTitle>Attendance Trends</CardTitle>
                  <CardDescription>Number of students present over the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    {chartData.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                        No trend data available.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            allowDecimals={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          />
                          <RechartsTooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))',
                              borderColor: 'hsl(var(--border))',
                              borderRadius: '8px',
                              color: 'hsl(var(--foreground))'
                            }}
                            itemStyle={{ color: 'hsl(var(--primary))' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="attendance" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorAttendance)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity List */}
              <Card className="col-span-1 border-border shadow-sm flex flex-col">
                <CardHeader>
                  <CardTitle>Recent Scans</CardTitle>
                  <CardDescription>Latest face recognition logs</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto">
                  {recentLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-12 text-center text-muted-foreground min-h-[220px]">
                      <Clock className="w-10 h-10 mb-2 opacity-30 text-slate-400" />
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No attendance scans today</p>
                      <p className="text-xs text-muted-foreground mt-1">Live recognition logs will appear here when students check in.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentLogs.map((log: any, i: number) => (
                        <div key={log.id || i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">
                              {log.user_name || "Unknown Student"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {log.roll_number ? `ID: ${log.roll_number}` : (log.department || "Student")}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                              log.status === 'Present' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                              log.status === 'Late' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                              'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}>
                              {log.status || 'Present'}
                            </span>
                            <div className="text-[0.68rem] text-muted-foreground font-mono mt-0.5">
                              {log.timestamp || "--:--"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
