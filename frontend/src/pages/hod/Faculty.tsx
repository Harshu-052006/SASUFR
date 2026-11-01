import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { apiFetch } from "../../lib/api";
import { GraduationCap, Search, CheckCircle2, Mail, BookOpen } from "lucide-react";

export function HODFaculty() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadFaculty = async () => {
      try {
        const data = await apiFetch("/hod/faculty");
        setFaculty(data || []);
      } catch (err) {
        console.error("Failed to load faculty", err);
      } finally {
        setLoading(false);
      }
    };
    loadFaculty();
  }, []);

  const filteredFaculty = faculty.filter(f => 
    (f.full_name?.toLowerCase() || "").includes(search.toLowerCase()) ||
    (f.email?.toLowerCase() || "").includes(search.toLowerCase()) ||
    (f.designation?.toLowerCase() || "").includes(search.toLowerCase())
  );

  return (
    <DashboardLayout title="Department Faculty Roster">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-foreground">Faculty Directory</h2>
            <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">
              Review all teaching staff, designations, and attendance session activity in your department.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 dark:text-muted-foreground absolute left-3 top-3.5" />
            <Input 
              placeholder="Search faculty..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 bg-white dark:bg-card border-slate-200/80 dark:border-border text-slate-900 dark:text-slate-100 shadow-sm"
            />
          </div>
        </div>

        <Card className="bg-white dark:bg-card border border-slate-200/80 dark:border-border shadow-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-foreground flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Department Teachers ({filteredFaculty.length})
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-muted-foreground">
              Teaching staff assigned to your department
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200/80 dark:border-border bg-slate-50/70 dark:bg-muted/20 hover:bg-transparent">
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Teacher Name</TableHead>
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Email Address</TableHead>
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Designation</TableHead>
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Sessions Conducted</TableHead>
                    <TableHead className="font-bold text-slate-700 dark:text-slate-300">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFaculty.map((teacher) => (
                    <TableRow key={teacher.id} className="border-b border-slate-100 dark:border-border/60 hover:bg-slate-50/60 dark:hover:bg-muted/30">
                      <TableCell className="font-medium text-slate-900 dark:text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                            {teacher.full_name?.charAt(0) || "T"}
                          </div>
                          <span className="font-semibold">{teacher.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-muted-foreground text-sm">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 opacity-60 text-slate-400" />
                          <span>{teacher.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-muted dark:text-foreground border border-slate-200 dark:border-border">
                          {teacher.designation || (teacher.role === 'hod' ? 'HOD' : 'Faculty')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
                          <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>{teacher.sessions_conducted || 0} Lectures</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredFaculty.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-slate-500 dark:text-muted-foreground">
                        No faculty found matching search.
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
