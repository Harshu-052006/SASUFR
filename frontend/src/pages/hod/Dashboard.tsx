import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { apiFetch } from "../../lib/api";
import { 
  Users, 
  GraduationCap, 
  Clock, 
  Radio, 
  Megaphone, 
  CheckCircle2, 
  Send, 
  ArrowUpRight,
  TrendingUp,
  X
} from "lucide-react";
import { toast } from "sonner";
import { AnnouncementBanner } from "../../components/AnnouncementBanner";
import { Link } from "react-router-dom";

export function HODDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Broadcast Announcement Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastPriority, setBroadcastPriority] = useState("Normal");
  const [broadcastDuration, setBroadcastDuration] = useState("24");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, sessionsRes, annRes] = await Promise.all([
        apiFetch("/hod/stats").catch(() => null),
        apiFetch("/hod/live-sessions").catch(() => []),
        apiFetch("/hod/announcements").catch(() => [])
      ]);
      setStats(statsRes);
      setLiveSessions(sessionsRes || []);
      setAnnouncements(annRes || []);
    } catch (err) {
      console.error("Failed to load HOD dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) {
      toast.error("Please enter an announcement message");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch("/hod/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: broadcastTitle.trim() || "Department Announcement",
          message: broadcastMessage.trim(),
          priority: broadcastPriority,
          duration_hours: parseInt(broadcastDuration) || 24
        })
      });
      toast.success("Department announcement broadcasted successfully!");
      setShowBroadcastModal(false);
      setBroadcastTitle("");
      setBroadcastMessage("");
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to broadcast announcement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExpireAnnouncement = async (id: number) => {
    try {
      await apiFetch(`/hod/announcements/${id}/expire`, { method: "PATCH" });
      toast.success("Announcement expired");
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to expire announcement");
    }
  };

  return (
    <DashboardLayout title="HOD Command Center">
      <div className="space-y-6">
        <AnnouncementBanner />

        {/* Executive Header Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 border border-blue-200/80 dark:border-blue-500/20 p-6 sm:p-8 backdrop-blur-xl shadow-sm dark:shadow-none">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400 text-xs font-bold mb-2.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse"></span>
                Head of Department
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {stats?.department ? `${stats.department} Department` : "Department Command Center"}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-sm mt-1.5 max-w-2xl leading-relaxed">
                Welcome back, <strong>{stats?.hod_name || "HOD"}</strong>. Real-time departmental attendance monitoring, faculty oversight, and official broadcast console.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setShowBroadcastModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 font-semibold gap-2 h-11 px-5 rounded-xl transition-all"
              >
                <Megaphone className="w-4 h-4" />
                Broadcast Announcement
              </Button>
            </div>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Department Faculty</CardTitle>
              <div className="p-2.5 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-xl">
                <GraduationCap className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900 dark:text-slate-100">{loading ? "..." : (stats?.total_faculty ?? 0)}</div>
              <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Active teachers & professors
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Enrolled Students</CardTitle>
              <div className="p-2.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-xl">
                <Users className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900 dark:text-slate-100">{loading ? "..." : (stats?.total_students ?? 0)}</div>
              <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1.5 flex items-center gap-1">
                In {stats?.department || "department"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Dept. Attendance Rate</CardTitle>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {loading ? "..." : `${stats?.department_attendance_rate ?? 0}%`}
              </div>
              <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1.5">
                Average across all lectures
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Active Live Sessions</CardTitle>
              <div className="p-2.5 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 rounded-xl">
                <Radio className="h-5 w-5 animate-pulse" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
                {loading ? "..." : (stats?.active_sessions_count ?? 0)}
              </div>
              <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1.5">
                Lectures in progress right now
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Live Department Sessions & Recent Announcements */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Live Sessions (2 Cols) */}
          <Card className="lg:col-span-2 bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Active Department Lectures
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Classes currently underway in {stats?.department || "your department"}
                </CardDescription>
              </div>
              <Link to="/hod/reports" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                View All Reports <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              {liveSessions.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 dark:border-border rounded-xl">
                  <Clock className="w-10 h-10 text-slate-400 dark:text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-muted-foreground">No active sessions right now</p>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground/80 mt-1">
                    When faculty in {stats?.department || "your department"} start an attendance session, it will show live here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {liveSessions.map((session) => (
                    <div 
                      key={session.id}
                      className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/50 hover:bg-blue-50/80 dark:border-blue-500/20 dark:bg-blue-500/5 dark:hover:bg-blue-500/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-slate-900 dark:text-foreground">{session.subject}</span>
                          <span className="px-2.5 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 font-bold">
                            Live Now
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          <span>Faculty: <strong className="text-slate-900 dark:text-foreground">{session.teacher_name || "Faculty"}</strong></span>
                          <span>Started: {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {session.room_code && <span>Room: {session.room_code}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">{session.present_count || 0} Attended</div>
                          <div className="text-xs text-slate-600 dark:text-slate-300 font-mono font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            PIN: {session.room_code || session.id}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Department Announcements Quick Hub (1 Col) */}
          <Card className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  HOD Notices
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">Published department alerts</CardDescription>
              </div>
              <Link to="/hod/announcements" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                Manage
              </Link>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 dark:border-border rounded-xl">
                  <Megaphone className="w-8 h-8 text-slate-400 dark:text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">No notices published yet</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 text-xs"
                    onClick={() => setShowBroadcastModal(true)}
                  >
                    Create First Notice
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.slice(0, 3).map((ann) => (
                    <div 
                      key={ann.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        ann.is_active 
                          ? "bg-blue-50/70 border-blue-200 dark:bg-blue-500/5 dark:border-blue-500/20" 
                          : "bg-slate-50 border-slate-200 dark:bg-muted/30 dark:border-border opacity-70"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-foreground truncate max-w-[150px]">
                          {ann.title || "Announcement"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ann.is_active 
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" 
                            : "bg-slate-200 text-slate-600 dark:bg-muted dark:text-muted-foreground"
                        }`}>
                          {ann.is_active ? "Active" : "Expired"}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-muted-foreground line-clamp-2 leading-relaxed">{ann.message}</p>
                      {ann.is_active && (
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => handleExpireAnnouncement(ann.id)}
                            className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                          >
                            Expire Now
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button 
                    variant="ghost" 
                    className="w-full text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground"
                    asChild
                  >
                    <Link to="/hod/announcements">View All {announcements.length} Notices →</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            to="/hod/faculty"
            className="p-5 rounded-xl border border-slate-200/80 dark:border-border bg-white dark:bg-card hover:border-blue-400 dark:hover:border-blue-500/40 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-foreground">Department Faculty</h3>
                <p className="text-xs text-slate-500 dark:text-muted-foreground">View faculty list, lectures & statuses</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
          </Link>

          <Link 
            to="/hod/students"
            className="p-5 rounded-xl border border-slate-200/80 dark:border-border bg-white dark:bg-card hover:border-indigo-400 dark:hover:border-indigo-500/40 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-foreground">Students & Defaulters</h3>
                <p className="text-xs text-slate-500 dark:text-muted-foreground">Attendance breakdown & &lt;75% alerts</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
          </Link>

          <Link 
            to="/hod/announcements"
            className="p-5 rounded-xl border border-slate-200/80 dark:border-border bg-white dark:bg-card hover:border-purple-400 dark:hover:border-purple-500/40 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
                <Megaphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-foreground">Announcement Hub</h3>
                <p className="text-xs text-slate-500 dark:text-muted-foreground">Broadcast priority department notices</p>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
          </Link>
        </div>
      </div>

      {/* Broadcast Announcement Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-border flex items-center justify-between bg-slate-50/80 dark:bg-[#161F30]/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-lg">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-foreground">Broadcast Department Notice</h3>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground">Will appear instantly on all student & faculty dashboards</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBroadcastModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-muted-foreground dark:hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBroadcast} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Notice Title</label>
                <Input 
                  placeholder="e.g. Schedule Change for Lab Session"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="bg-white dark:bg-background border-slate-300 dark:border-input text-slate-900 dark:text-slate-100 h-11"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Priority</label>
                  <select 
                    value={broadcastPriority}
                    onChange={(e) => setBroadcastPriority(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-input bg-white dark:bg-background text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Normal">Normal (Blue)</option>
                    <option value="Urgent">Urgent (Red)</option>
                    <option value="Exam">Exam / Deadline (Purple)</option>
                    <option value="Event">Event / Holiday (Green)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Active Duration</label>
                  <select 
                    value={broadcastDuration}
                    onChange={(e) => setBroadcastDuration(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-input bg-white dark:bg-background text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="12">12 Hours</option>
                    <option value="24">24 Hours (1 Day)</option>
                    <option value="72">3 Days</option>
                    <option value="168">7 Days (1 Week)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Message Content</label>
                <textarea 
                  rows={4}
                  placeholder="Write clear notice details for students and teachers of your department..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-input bg-white dark:bg-background text-slate-900 dark:text-slate-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowBroadcastModal(false)}
                  className="border-slate-300 dark:border-input"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2 shadow-md shadow-blue-500/20"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Publishing..." : "Broadcast Notice"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
