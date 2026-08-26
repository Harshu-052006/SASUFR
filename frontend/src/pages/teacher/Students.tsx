import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { apiFetch } from "../../lib/api";
import { Loader2, Search } from "lucide-react";

export function Students() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      // Assuming teacher can fetch all students or a filtered list
      const data = await apiFetch("/admin/students"); 
      setStudents(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    (s.full_name || "").toLowerCase().includes(search.toLowerCase()) || 
    (s.roll_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.department || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout title="Student Directory">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <Card className="border-border shadow-sm">
          <div className="p-4 border-b flex items-center gap-4">
             <div className="relative flex-1 max-w-md">
               <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input 
                 placeholder="Search by name, roll number or department..." 
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
                  <TableHead>Student Name</TableHead>
                  <TableHead>Roll Number</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No students found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map(student => (
                    <TableRow key={student.id}>
                      <TableCell className="font-semibold text-slate-800">{student.full_name}</TableCell>
                      <TableCell className="font-mono text-sm">{student.roll_number}</TableCell>
                      <TableCell>{student.department}</TableCell>
                      <TableCell className="text-slate-500">{student.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          Active
                        </span>
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
