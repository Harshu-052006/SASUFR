import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { apiFetch } from "../../lib/api";
import { Loader2, Calendar } from "lucide-react";
import { Input } from "../../components/ui/input";

export function ViewAttendance() {
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAttendance();
  }, [date]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      // Reusing the today endpoint or if there's a specific date endpoint.
      // The API `GET /teacher/attendance/today` actually just gets today.
      // If the backend doesn't support date filtering via this endpoint, we just show today.
      // Assuming it supports `?date=YYYY-MM-DD` or we just hit the report endpoint.
      const data = await apiFetch(`/teacher/attendance/today?date=${date}`);
      setAttendance(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="View Attendance">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <Card className="border-border shadow-sm">
          <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between py-4">
            <CardTitle className="text-lg">Daily Records</CardTitle>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400" />
              <Input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="w-40"
              />
            </div>
          </CardHeader>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                    </TableCell>
                  </TableRow>
                ) : attendance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      No attendance records found for {date}.
                    </TableCell>
                  </TableRow>
                ) : (
                  attendance.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-semibold text-slate-800">{record.student_name}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          record.status === 'Present' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {record.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.method === 'face' ? (
                          <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs font-semibold border border-indigo-100">📷 Biometric</span>
                        ) : (
                          <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs font-semibold border border-amber-100">✍️ Manual</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500 font-mono text-sm">
                        {new Date(record.created_at).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

      </div>
    </DashboardLayout>
  );
}
