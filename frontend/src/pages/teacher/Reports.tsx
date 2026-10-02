import { useState } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Loader2, Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

export function Reports() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState("excel");
  const [loading, setLoading] = useState(false);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates.")
      return;
    }
    
    setLoading(true);
    try {
      // API call to generate report
      // If the API returns a file download, apiFetch might try to parse JSON.
      // Assuming apiFetch handles blob or we construct a direct URL if it's a GET request.
      // Usually, it's a GET request like /teacher/reports/export?start_date=X&end_date=Y&format=Z
      // If it's authenticated with cookies, window.location.href might work, or fetch -> blob.
      
      const response = await fetch(`http://127.0.0.1:8000/teacher/reports/export?start_date=${startDate}&end_date=${endDate}&format=${format}`, {
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error("Failed to export report");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Attendance_Report_${startDate}_to_${endDate}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
    } catch (err: any) {
      toast.error(err.message || "Export failed.")
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Reports & Analytics">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="text-lg">Export Attendance Data</CardTitle>
            <CardDescription>Generate and download reports for a specific date range.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleExport} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Start Date</label>
                  <Input 
                    type="date" 
                    required 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">End Date</label>
                  <Input 
                    type="date" 
                    required 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Export Format</label>
                <div className="flex gap-4">
                  <label className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    format === 'excel' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input type="radio" name="format" value="excel" className="sr-only" checked={format === 'excel'} onChange={() => setFormat('excel')} />
                    <FileSpreadsheet className={`w-8 h-8 mb-2 ${format === 'excel' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="font-semibold text-sm">Excel (.xlsx)</span>
                  </label>
                  
                  <label className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    format === 'pdf' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input type="radio" name="format" value="pdf" className="sr-only" checked={format === 'pdf'} onChange={() => setFormat('pdf')} />
                    <FileText className={`w-8 h-8 mb-2 ${format === 'pdf' ? 'text-rose-600' : 'text-slate-400'}`} />
                    <span className="font-semibold text-sm">PDF (.pdf)</span>
                  </label>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-sm font-bold tracking-wide">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Download className="w-5 h-5 mr-2" />}
                Generate & Download Report
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
