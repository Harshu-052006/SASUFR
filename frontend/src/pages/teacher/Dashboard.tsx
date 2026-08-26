import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { apiFetch } from "../../lib/api";
import { Loader2, Users, FileText, CheckCircle, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { AnnouncementBanner } from "../../components/AnnouncementBanner";

export function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({ subject: "", room_id: "" });
  const [sessionLoading, setSessionLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, activeRes] = await Promise.all([
        apiFetch("/teacher/dashboard-stats").catch(() => null),
        apiFetch("/teacher/sessions/active").catch(() => [])
      ]);
      setStats(statsRes);
      if (activeRes && activeRes.length > 0) {
        setActiveSession(activeRes[0]);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionLoading(true);
    try {
      await apiFetch("/teacher/sessions/start", {
        method: "POST",
        body: JSON.stringify(sessionForm)
      });
      setIsSessionModalOpen(false);
      setSessionForm({ subject: "", room_id: "" });
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to start session");
    } finally {
      setSessionLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    if (!confirm("Are you sure you want to end this session?")) return;
    
    // In legacy, we just clear the active session or hit an end endpoint. 
    // Wait, let's assume there's a POST /teacher/sessions/end or we just let it expire.
    // If not, we will just refetch.
    try {
      await apiFetch(`/teacher/sessions/${activeSession.id}/end`, { method: "POST" }).catch(() => {});
      fetchData();
    } catch (err) {
      // ignore
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Teacher Dashboard">
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Teacher Dashboard">
      <div className="max-w-7xl mx-auto space-y-6">
        <AnnouncementBanner />
        
        {/* Actions Row */}
        <div className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Class Sessions</h2>
            <p className="text-slate-500 text-sm">Manage live attendance sessions for geofenced marking.</p>
          </div>
          {activeSession ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg font-semibold border border-indigo-100">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
                Active: {activeSession.subject} ({activeSession.room_id})
              </div>
              <Button variant="destructive" onClick={handleEndSession}>End Session</Button>
            </div>
          ) : (
            <Button className="bg-indigo-600 hover:bg-indigo-700 font-bold tracking-wide" onClick={() => setIsSessionModalOpen(true)}>
              START NEW SESSION
            </Button>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total Students</p>
                <h3 className="text-3xl font-black text-slate-800">{stats?.total_students || 0}</h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg"><Users className="w-6 h-6 text-blue-500" /></div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Classes Today</p>
                <h3 className="text-3xl font-black text-slate-800">{stats?.classes_today || 0}</h3>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg"><Clock className="w-6 h-6 text-emerald-500" /></div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Avg Attendance</p>
                <h3 className="text-3xl font-black text-slate-800">{stats?.average_attendance || "0"}%</h3>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg"><CheckCircle className="w-6 h-6 text-indigo-500" /></div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Pending Reports</p>
                <h3 className="text-3xl font-black text-slate-800">{stats?.pending_reports || 0}</h3>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg"><FileText className="w-6 h-6 text-amber-500" /></div>
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
