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

  useEffect(() => {
    fetchInitialData();
    const interval = setInterval(fetchLiveFeed, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [studentsRes, activeRes] = await Promise.all([
        apiFetch("/admin/students").catch(() => []), // Teacher probably uses admin/students or teacher/students
        apiFetch("/teacher/sessions/active").catch(() => [])
      ]);
      setStudents(studentsRes);
      if (activeRes && activeRes.length > 0) {
        setActiveSession(activeRes[0]);
      }
      await fetchLiveFeed();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveFeed = async () => {
    try {
      const data = await apiFetch("/teacher/attendance/today");
      setFeed(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualMark = async (studentId: string, status: string) => {
    try {
      await apiFetch(`/teacher/mark-attendance/manual/${studentId}`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
      fetchLiveFeed();
    } catch (err: any) {
      toast.error(err.message || "Failed to mark attendance manually")
    }
  };

  const filteredStudents = students.filter(s => 
    (s.full_name || "").toLowerCase().includes(search.toLowerCase()) || 
    (s.roll_number || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout title="Manual Override & Live Feed">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Live Feed */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-border shadow-sm h-[calc(100vh-140px)] flex flex-col">
            <CardHeader className="bg-slate-50 border-b py-4">
              <CardTitle className="text-lg flex items-center justify-between">
                Live Activity Feed
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              {feed.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No attendance records today.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {feed.map((record, i) => (
                    <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="font-bold text-sm text-slate-800">{record.student_name}</div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                           {record.method === 'face' ? '📷 Biometric' : '✍️ Manual'}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          record.status === 'Present' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {record.status}
                        </span>
                        <div className="text-[0.65rem] text-slate-400 mt-1">{new Date(record.created_at).toLocaleTimeString()}</div>
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
             <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 text-amber-800">
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
                   className="pl-9 bg-slate-50 border-slate-200"
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                 />
               </div>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
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
                      const todayRecord = feed.find(f => f.student_id === student.id);
                      return (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div className="font-semibold text-slate-800">{student.full_name}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{student.roll_number} • {student.department}</div>
                          </TableCell>
                          <TableCell>
                            {todayRecord ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                todayRecord.status === 'Present' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {todayRecord.status}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">Unmarked</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                              onClick={() => handleManualMark(student.id, 'Present')}
                            >
                              <Check className="w-4 h-4 mr-1" /> Mark Present
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="border-rose-200 text-rose-600 hover:bg-rose-50"
                              onClick={() => handleManualMark(student.id, 'Absent')}
                            >
                              <X className="w-4 h-4 mr-1" /> Mark Absent
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
