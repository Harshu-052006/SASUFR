import { useState, useEffect } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { apiFetch } from "../../lib/api";

export function Reports() {
  const [stats, setStats] = useState<any>(null);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
    fetchFaculty();
    fetchLocations();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await apiFetch("/admin/stats");
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFaculty = async () => {
    try {
      const data = await apiFetch("/admin/reports/faculty?days=30");
      setFaculty(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLocations = async () => {
    try {
      const data = await apiFetch("/admin/locations");
      setLocations(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <DashboardLayout title="Reports & Analytics">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Stat Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_users || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_students || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faculty</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_teachers || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Devices/Cameras</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.active_cameras || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Faculty Attendance (30 Days)</CardTitle>
              <CardDescription>Top faculty by attendance percentage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {faculty.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{f.full_name}</p>
                      <p className="text-xs text-muted-foreground">{f.department}</p>
                    </div>
                    <div className="font-bold">{f.attendance_percentage}%</div>
                  </div>
                ))}
                {faculty.length === 0 && <p className="text-sm text-muted-foreground">No data available.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monitoring Locations</CardTitle>
              <CardDescription>Status of active geofenced areas.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {locations.map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="text-sm font-medium">{loc.name}</p>
                      <p className="text-xs text-muted-foreground">Lat: {loc.lat}, Lon: {loc.lon}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${loc.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {loc.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
