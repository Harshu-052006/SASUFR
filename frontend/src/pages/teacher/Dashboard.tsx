import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { apiFetch } from "../../lib/api";
import { 
  Loader2, Users, FileText, CheckCircle, Clock, AlertCircle, 
  Camera, Calendar, RefreshCw, ChevronRight 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { AnnouncementBanner } from "../../components/AnnouncementBanner";
import { toast } from "sonner";

export function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({ subject: "", room_id: "" });
  const [sessionLoading, setSessionLoading] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    try {
      const [statsRes, activeRes, attRes] = await Promise.all([
        apiFetch("/teacher/dashboard-stats").catch(() => null),
        apiFetch("/teacher/sessions/active").catch(() => []),
        apiFetch("/teacher/attendance/today").catch(() => [])
      ]);

      if (statsRes) setStats(statsRes);
      if (Array.isArray(activeRes) && activeRes.length > 0) {
        setActiveSession(activeRes[0]);
      } else {
        setActiveSession(null);
      }
      setTodayAttendance(Array.isArray(attRes) ? attRes : []);
    } catch (err) {
      console.error("Error fetching teacher dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionLoading(true);
    try {
      await apiFetch("/teacher/sessions/start", {
        method: "POST",
        body: JSON.stringify({
          subject: sessionForm.subject,
          room_id: sessionForm.room_id,
          class_name: sessionForm.room_id || "Classroom"
        })
      });
      setIsSessionModalOpen(false);
      setSessionForm({ subject: "", room_id: "" });
      toast.success("Live session started successfully");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to start session");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    if (!confirm("Are you sure you want to end this session?")) return;
    
    try {
      await apiFetch(`/teacher/sessions/${activeSession.id}/end`, { method: "POST" }).catch(() => {});
      toast.info("Session ended");
      fetchData();
    } catch (err) {
      // ignore
    }
  };

  const totalStudents = stats?.total_students ?? 0;
  const present = stats?.present ?? 0;
  const late = stats?.late ?? 0;
  const absent = stats?.absent ?? 0;
  const notMarked = stats?.not_marked ?? 0;
  const attendanceRate = totalStudents > 0 
    ? (((present + late) / totalStudents) * 100).toFixed(1) 
    : "0.0";

  if (loading) {
    return (
      <DashboardLayout title="Faculty Dashboard">
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Faculty Dashboard">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <AnnouncementBanner />
          <div className="self-end sm:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(false)}
              disabled={refreshing}
              className="gap-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh Live Data"}
            </Button>
          </div>
        </div>
        
        {/* Actions Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-card p-6 rounded-xl border shadow-sm gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Live Attendance Session</h2>
            <p className="text-slate-500 text-sm">Activate geofenced biometric marking for your lecture hall or classroom.</p>
          </div>
          {activeSession ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2.5 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-300 px-4 py-2 rounded-lg font-semibold border border-indigo-200 dark:border-indigo-800">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
                <span>Active: <strong>{activeSession.subject}</strong> ({activeSession.class_name || activeSession.room_id || "Classroom"})</span>
                {activeSession.room_code && (
                  <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded font-mono font-bold tracking-wider ml-1">
                    PIN: {activeSession.room_code}
                  </span>
                )}
              </div>
              <Button variant="destructive" onClick={handleEndSession}>End Session</Button>
            </div>
          ) : (
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold tracking-wide" 
              onClick={() => setIsSessionModalOpen(true)}
            >
              START LIVE SESSION
            </Button>
          )}
        </div>

        {/* Real Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Total Students</p>
                <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">{totalStudents}</h3>
                <p className="text-xs text-muted-foreground mt-1">Department roster</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Present Today</p>
                <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{present}</h3>
                <p className="text-xs text-muted-foreground mt-1">{attendanceRate}% attendance rate</p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Late Arrivals</p>
                <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400">{late}</h3>
                <p className="text-xs text-muted-foreground mt-1">Checked in past cutoff</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${stats?.attendance_finalized ? 'border-l-rose-500' : 'border-l-slate-400'} shadow-sm`}>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {stats?.attendance_finalized ? "Absent Today" : "Not Marked"}
                </p>
                <h3 className={`text-3xl font-black ${stats?.attendance_finalized ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {stats?.attendance_finalized ? absent : notMarked}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.attendance_finalized ? "Finalized absentees" : "Pending daily mark"}
                </p>
              </div>
              <div className={`p-3 ${stats?.attendance_finalized ? 'bg-rose-50 dark:bg-rose-950/50' : 'bg-slate-100 dark:bg-slate-800'} rounded-lg`}>
                <AlertCircle className={`w-6 h-6 ${stats?.attendance_finalized ? 'text-rose-500' : 'text-slate-400'}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Hub Navigation & Today's Attendance Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Quick Actions Panel */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Faculty Shortcuts</h3>
            
            <Link to="/teacher/mark-attendance" className="block">
              <Card className="hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-lg">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Mark Attendance</h4>
                      <p className="text-xs text-muted-foreground">Scan faces or mark manually</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link to="/teacher/view-attendance" className="block">
              <Card className="hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">View Attendance Logs</h4>
                      <p className="text-xs text-muted-foreground">Daily attendance logs & history</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link to="/teacher/students" className="block">
              <Card className="hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Department Students</h4>
                      <p className="text-xs text-muted-foreground">Review registered students</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>

            <Link to="/teacher/reports" className="block">
              <Card className="hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-lg">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Export Reports</h4>
                      <p className="text-xs text-muted-foreground">Download Excel & PDF sheets</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Today's Live Attendance Feed */}
          <Card className="lg:col-span-2 border-border shadow-sm flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold">Today's Department Attendance</CardTitle>
                <CardDescription>Live records for registered department students</CardDescription>
              </div>
              <Link to="/teacher/view-attendance" className="text-xs text-indigo-600 hover:underline font-medium">
                View all &rarr;
              </Link>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {todayAttendance.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 text-center text-muted-foreground min-h-[220px]">
                  <Clock className="w-10 h-10 mb-2 opacity-30 text-slate-400" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No attendance marked yet today</p>
                  <p className="text-xs text-muted-foreground mt-1">Start a session or open Mark Attendance to begin.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {todayAttendance.slice(0, 7).map((record: any, idx: number) => (
                    <div key={record.id || idx} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold text-xs">
                          {(record.student_name || record.full_name || "S").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {record.student_name || record.full_name || record.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {record.roll_number ? `Roll: ${record.roll_number}` : (record.method === 'face' ? '📷 Biometric' : '✍️ Manual')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          record.status === 'Present' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          record.status === 'Late' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                          'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {record.status || 'Not Marked'}
                        </span>
                        <div className="text-[0.68rem] text-muted-foreground mt-0.5 font-mono">
                          {record.check_in || (record.created_at ? new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>

      <Dialog open={isSessionModalOpen} onOpenChange={setIsSessionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Live Session</DialogTitle>
            <DialogDescription>
              Students within the designated area will be able to mark attendance via facial recognition.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStartSession} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Subject Name</label>
              <Input 
                required 
                placeholder="e.g. Data Structures" 
                value={sessionForm.subject} 
                onChange={e => setSessionForm({...sessionForm, subject: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Room ID</label>
              <Input 
                required 
                placeholder="e.g. Room 301" 
                value={sessionForm.room_id} 
                onChange={e => setSessionForm({...sessionForm, room_id: e.target.value})}
              />
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 mt-4" disabled={sessionLoading}>
              {sessionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Start Session
            </Button>
          </form>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
