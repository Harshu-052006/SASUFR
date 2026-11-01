import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { apiFetch } from "../../lib/api";
import { Loader2, Search, Check, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export function MarkAttendance() {
  const [students, setStudents] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [markingId, setMarkingId] = useState<string | number | null>(null);

  useEffect(() => {
    fetchInitialData();
    const interval = setInterval(fetchLiveFeed, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [studentsRes, activeRes] = await Promise.all([
        apiFetch("/teacher/department/students").catch(() => []),
        apiFetch("/teacher/sessions/active").catch(() => [])
      ]);
      setStudents(Array.isArray(studentsRes) ? studentsRes : []);
      if (Array.isArray(activeRes) && activeRes.length > 0) {
        setActiveSession(activeRes[0]);
      }
      await fetchLiveFeed();
    } catch (err) {
      console.error(err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveFeed = async () => {
    try {
      const data = await apiFetch("/teacher/attendance/today");
      setFeed(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setFeed([]);
    }
  };

  const handleManualMark = async (studentId: string | number, status: string) => {
    setMarkingId(studentId);

    // Optimistic UI update
    setFeed(prev => {
      const existingIdx = prev.findIndex(f => 
        (f.id !== undefined && f.id === studentId) || 
        (f.student_id !== undefined && f.student_id === studentId)
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { 
          ...copy[existingIdx], 
          status, 
          check_in: new Date().toISOString(),
          method: "manual"
        };
        return copy;
      }
      return [...prev, { 
        id: studentId, 
        student_id: studentId, 
        status, 
        check_in: new Date().toISOString(), 
        method: "manual" 
      }];
    });

    try {
      let coords: { latitude?: number; longitude?: number } = {};
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 2000, enableHighAccuracy: false });
          });
          coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        } catch {
          // Ignore location error on manual override
        }
      }

      await apiFetch(`/teacher/mark-attendance/manual/${studentId}`, {
        method: "POST",
        body: JSON.stringify({ status, ...coords })
      });
      toast.success(`Marked student as ${status}`);
      await fetchLiveFeed();
    } catch (err: any) {
      toast.error(err.message || "Failed to mark attendance manually");
      await fetchLiveFeed();
    } finally {
      setMarkingId(null);
    }
  };

  const studentList = Array.isArray(students) ? students : [];
  const filteredStudents = studentList.filter(s => 
    (s.full_name || "").toLowerCase().includes(search.toLowerCase()) || 
    (s.roll_number || "").toLowerCase().includes(search.toLowerCase())
  );

  // Marked records for live activity feed
  const markedFeed = feed.filter(f => f.status && f.status !== "Pending");

  return (
    <DashboardLayout title="Manual Override & Live Feed">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Live Feed */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-border shadow-sm h-[calc(100vh-140px)] flex flex-col">
            <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b py-4">
              <CardTitle className="text-lg flex items-center justify-between">
                Live Activity Feed
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              {!Array.isArray(markedFeed) || markedFeed.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No attendance records marked today.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {markedFeed.map((record, i) => (
                    <div key={record.id || i} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div>
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                          {record.full_name || record.student_name || record.email}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          {record.method === 'face' ? '📷 Biometric' : '✍️ Manual'}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          record.status === 'Present' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 
                          record.status === 'Late' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                          'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {record.status}
                        </span>
                        <div className="text-[0.65rem] text-slate-400 mt-1 font-mono">
                          {record.check_in ? (
                            new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          ) : (
                            record.created_at ? new Date(record.created_at).toLocaleTimeString() : "--:--"
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Student List */}
        <div className="lg:col-span-2 space-y-4">
          
          {!activeSession && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3 text-amber-800 dark:text-amber-300">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">No Active Session</h4>
                <p className="text-sm mt-1">You can still mark attendance manually, but students cannot use facial recognition right now.</p>
              </div>
            </div>
          )}

          <Card className="border-border shadow-sm">
            <div className="p-4 border-b flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name or roll number..." 
                  className="pl-9 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead>Student Details</TableHead>
                    <TableHead>Status Today</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                      </TableCell>
                    </TableRow>
                  ) : filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                        No students found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map(student => {
                      // Match student record accurately across id, student_id, roll_number, or email
                      const todayRecord = feed.find(f => 
                        (f.id !== undefined && f.id === student.id) || 
                        (f.student_id !== undefined && f.student_id === student.id) || 
                        (f.roll_number && student.roll_number && f.roll_number === student.roll_number) || 
                        (f.email && student.email && f.email === student.email)
                      );
                      const isMarked = !!(todayRecord && todayRecord.status && todayRecord.status !== "Pending");
                      const currentStatus = isMarked ? todayRecord.status : "Unmarked";
                      const isActionLoading = markingId === student.id;

                      return (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{student.full_name}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{student.roll_number} • {student.department}</div>
                          </TableCell>
                          <TableCell>
                            {isMarked ? (
                              <div className="flex flex-col items-start gap-1">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  currentStatus === 'Present' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                  currentStatus === 'Late' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                  'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                }`}>
                                  {currentStatus}
                                </span>
                                {todayRecord.check_in && (
                                  <span className="text-[0.68rem] text-muted-foreground font-mono">
                                    {new Date(todayRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                Unmarked
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button 
                              size="sm" 
                              variant={currentStatus === 'Present' ? "default" : "outline"}
                              className={currentStatus === 'Present' 
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white font-medium" 
                                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"}
                              disabled={isActionLoading}
                              onClick={() => handleManualMark(student.id, 'Present')}
                            >
                              {isActionLoading ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5 mr-1" />
                              )}
                              {currentStatus === 'Present' ? 'Present' : 'Mark Present'}
                            </Button>
                            <Button 
                              size="sm" 
                              variant={currentStatus === 'Absent' ? "default" : "outline"}
                              className={currentStatus === 'Absent' 
                                ? "bg-rose-600 hover:bg-rose-700 text-white font-medium" 
                                : "border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"}
                              disabled={isActionLoading}
                              onClick={() => handleManualMark(student.id, 'Absent')}
                            >
                              {isActionLoading ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              ) : (
                                <X className="w-3.5 h-3.5 mr-1" />
                              )}
                              {currentStatus === 'Absent' ? 'Absent' : 'Mark Absent'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
