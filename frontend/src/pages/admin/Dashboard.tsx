import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { 
  Users, 
  UserCheck, 
  UserX, 
  UserMinus, 
  Clock, 
  RefreshCw, 
  Loader2, 
  Building2, 
  GraduationCap, 
  Plus, 
  Shield, 
  AlertCircle, 
  X 
} from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { AnnouncementBanner } from "../../components/AnnouncementBanner";
import { apiFetch } from "../../lib/api";

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State for Department + HOD Creation
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({
    department_name: "",
    department_code: "",
    hod_full_name: "",
    hod_email: "",
    hod_roll_number: "",
    hod_password: "Password123"
  });
  const [deptSubmitting, setDeptSubmitting] = useState(false);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [statsRes, weeklyRes, logsRes, deptsRes] = await Promise.all([
        apiFetch("/admin/stats").catch(() => null),
        apiFetch("/admin/reports/weekly?days=6").catch(() => null),
        apiFetch("/admin/logs?limit=8").catch(() => []),
        apiFetch("/admin/departments").catch(() => [])
      ]);

      if (statsRes) {
        setStats(statsRes);
      }
      if (Array.isArray(deptsRes)) {
        setDepartments(deptsRes);
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

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.department_name.trim()) {
      toast.error("Department Name is required");
      return;
    }
    if (!deptForm.hod_full_name.trim()) {
      toast.error("HOD Full Name is mandatory. Every department must have an assigned HOD.");
      return;
    }
    if (!deptForm.hod_email.trim()) {
      toast.error("HOD Institutional Email is mandatory.");
      return;
    }

    setDeptSubmitting(true);
    try {
      const res = await apiFetch("/admin/departments", {
        method: "POST",
        body: JSON.stringify({
          department_name: deptForm.department_name.trim(),
          department_code: deptForm.department_code.trim() || undefined,
          create_new_hod: true,
          hod_full_name: deptForm.hod_full_name.trim(),
          hod_email: deptForm.hod_email.trim().toLowerCase(),
          hod_roll_number: deptForm.hod_roll_number.trim() || undefined,
          hod_password: deptForm.hod_password || "Password123"
        })
      });
      toast.success(res.message || "Department and HOD created successfully!");
      setShowDeptModal(false);
      setDeptForm({
        department_name: "",
        department_code: "",
        hod_full_name: "",
        hod_email: "",
        hod_roll_number: "",
        hod_password: "Password123"
      });
      fetchData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to create department");
    } finally {
      setDeptSubmitting(false);
    }
  };

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

            {/* Department Governance & Academic Leadership (1 Department = 1 HOD) */}
            <Card className="border-border shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Building2 className="w-5 h-5 text-primary" />
                    Department Governance & Academic Leadership
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Institutional oversight of department units and assigned Heads of Department (Strict Policy: 1 Department = 1 HOD).
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setShowDeptModal(true)} 
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create Department & HOD
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs uppercase font-semibold text-muted-foreground border-b border-border">
                      <tr>
                        <th className="px-6 py-3.5">Department</th>
                        <th className="px-6 py-3.5">Head of Department (HOD)</th>
                        <th className="px-6 py-3.5 text-center">Faculty</th>
                        <th className="px-6 py-3.5 text-center">Students</th>
                        <th className="px-6 py-3.5 text-right">Leadership Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {departments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm">
                            No departments configured. Click &quot;Create Department & HOD&quot; to initialize one.
                          </td>
                        </tr>
                      ) : (
                        departments.map((dept, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-primary shrink-0" />
                                <span>{dept.department}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {dept.hod ? (
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                    {dept.hod.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("") || "HD"}
                                  </div>
                                  <div>
                                    <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                      {dept.hod.full_name}
                                      <span className="text-[0.65rem] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded font-semibold border border-blue-200 dark:border-blue-900">
                                        HOD
                                      </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                      <span>{dept.hod.email}</span>
                                      {dept.hod.roll_number && (
                                        <span className="font-mono text-[0.7rem] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                          {dept.hod.roll_number}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
                                  <AlertCircle className="w-3 h-3" />
                                  Vacant (HOD Appointment Required)
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center font-medium">
                              <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs">
                                {dept.faculty_count} {dept.faculty_count === 1 ? "teacher" : "teachers"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-medium">
                              <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs">
                                {dept.student_count} {dept.student_count === 1 ? "student" : "students"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {dept.has_hod ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <GraduationCap className="w-3.5 h-3.5" />
                                  Active HOD
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  Incomplete
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Modal: Create Department with Mandatory HOD Appointment */}
            {showDeptModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                <div className="bg-card w-full max-w-xl rounded-xl border border-border shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
                  <button 
                    onClick={() => setShowDeptModal(false)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Create Department & Appoint HOD
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Strict rule: Every department must have exactly one active Head of Department.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 mb-5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Mandatory Institutional Validation:</strong> No department can exist without an appointed HOD. Providing the HOD credentials below will register the new department and provision the HOD account atomically in one step.
                    </div>
                  </div>

                  <form onSubmit={handleCreateDepartment} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Department Name <span className="text-rose-500">*</span>
                        </label>
                        <Input
                          required
                          placeholder="e.g. Artificial Intelligence & Data Science"
                          value={deptForm.department_name}
                          onChange={(e) => setDeptForm({ ...deptForm, department_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Code (Optional)
                        </label>
                        <Input
                          placeholder="e.g. AIDS"
                          value={deptForm.department_code}
                          onChange={(e) => setDeptForm({ ...deptForm, department_code: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="border-t border-border/60 pt-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-primary" />
                        Head of Department (HOD) Credentials
                      </h3>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            HOD Full Name <span className="text-rose-500">*</span>
                          </label>
                          <Input
                            required
                            placeholder="e.g. Dr. Ramesh Sharma"
                            value={deptForm.hod_full_name}
                            onChange={(e) => setDeptForm({ ...deptForm, hod_full_name: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              HOD Email Address <span className="text-rose-500">*</span>
                            </label>
                            <Input
                              required
                              type="email"
                              placeholder="e.g. hod.aids@mit.asia"
                              value={deptForm.hod_email}
                              onChange={(e) => setDeptForm({ ...deptForm, hod_email: e.target.value })}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Employee / Roll ID
                            </label>
                            <Input
                              placeholder="e.g. HOD-AIDS01"
                              value={deptForm.hod_roll_number}
                              onChange={(e) => setDeptForm({ ...deptForm, hod_roll_number: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Initial Account Password
                          </label>
                          <Input
                            type="text"
                            placeholder="Password123"
                            value={deptForm.hod_password}
                            onChange={(e) => setDeptForm({ ...deptForm, hod_password: e.target.value })}
                          />
                          <p className="text-[0.7rem] text-muted-foreground">Default is &quot;Password123&quot;. HOD can change this upon initial login.</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowDeptModal(false)}
                        disabled={deptSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        className="gap-2 bg-primary hover:bg-primary/90"
                        disabled={deptSubmitting}
                      >
                        {deptSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating Department...
                          </>
                        ) : (
                          <>
                            <Building2 className="w-4 h-4" />
                            Create Department & Appoint HOD
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
