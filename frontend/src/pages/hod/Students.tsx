import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { apiFetch } from "../../lib/api";
import { Users, Search, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";

export function HODStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "defaulters">("all");

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const data = await apiFetch("/hod/students");
        setStudents(data || []);
      } catch (err) {
        console.error("Failed to load students", err);
      } finally {
        setLoading(false);
      }
    };
    loadStudents();
  }, []);

  const defaultersCount = students.filter(s => s.attendance_rate < 75).length;

  const filteredStudents = students.filter(s => {
    const matchesSearch = 
      (s.full_name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (s.roll_number?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (s.email?.toLowerCase() || "").includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filter === "defaulters") return s.attendance_rate < 75;
    return true;
  });

  return (
    <DashboardLayout title="Department Student Attendance Oversight">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-foreground">Student Attendance & Defaulters</h2>
            <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">
              Monitor individual attendance rates across all lectures and identify defaulters below 75%.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 dark:text-muted-foreground absolute left-3 top-3.5" />
              <Input 
                placeholder="Search students..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 bg-white dark:bg-card border-slate-200/80 dark:border-border text-slate-900 dark:text-slate-100 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-border pb-3">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              filter === "all"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-700 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted"
            }`}
          >
            All Students ({students.length})
          </button>
          <button
            onClick={() => setFilter("defaulters")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              filter === "defaulters"
                ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                : "bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-700 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Defaulters &lt; 75% ({defaultersCount})
          </button>
        </div>

        <Card className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {filter === "defaulters" ? "Attendance Defaulters Alert List" : "Enrolled Students Roster"}
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-muted-foreground">
              Showing {filteredStudents.length} students in your department
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200/80 dark:border-border bg-slate-50/70 dark:bg-muted/20 hover:bg-transparent">
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Roll Number</TableHead>
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Student Name</TableHead>
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Email</TableHead>
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Attended / Total</TableHead>
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Attendance Rate</TableHead>
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const isGood = student.attendance_rate >= 75;
                    const isWarning = student.attendance_rate >= 60 && student.attendance_rate < 75;
                    const isCritical = student.attendance_rate < 60;

                    return (
                      <TableRow key={student.id} className="border-b border-slate-100 dark:border-border/60 hover:bg-slate-50/60 dark:hover:bg-muted/30">
                        <TableCell className="font-mono text-sm font-bold text-slate-900 dark:text-foreground">
                          {student.roll_number}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900 dark:text-foreground">
                          {student.full_name}
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-muted-foreground text-sm">
                          {student.email}
                        </TableCell>
                        <TableCell className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {student.attended_sessions} / {student.total_sessions}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  isGood ? "bg-emerald-500" : (isWarning ? "bg-amber-500" : "bg-red-500")
                                }`}
                                style={{ width: `${Math.min(student.attendance_rate, 100)}%` }}
                              />
                            </div>
                            <span className={`text-sm font-black ${
                              isGood ? "text-emerald-600 dark:text-emerald-400" : (isWarning ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400")
                            }`}>
                              {student.attendance_rate}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isGood && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              Regular
                            </span>
                          )}
                          {isWarning && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                              <AlertCircle className="w-3 h-3" />
                              Warning
                            </span>
                          )}
                          {isCritical && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20">
                              <AlertTriangle className="w-3 h-3" />
                              Critical
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredStudents.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500 dark:text-muted-foreground">
                        {filter === "defaulters" 
                          ? "🎉 Excellent! No defaulters below 75% in this department."
                          : "No students found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
