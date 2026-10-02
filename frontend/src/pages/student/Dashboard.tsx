import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { apiFetch } from "../../lib/api";
import { 
  Camera, MapPin, MapPinOff, AlertTriangle, 
  CheckCircle2, Clock, Calendar as CalendarIcon, FileText, Loader2, Radio, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { AnnouncementBanner } from "../../components/AnnouncementBanner";

export function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & Camera State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [camStatus, setCamStatus] = useState<"idle" | "requesting" | "ready" | "error" | "processing">("idle");
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [selectedSession, setSelectedSession] = useState<any>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchActiveSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, ttRes] = await Promise.all([
        apiFetch("/student/stats").catch(() => null),
        apiFetch("/timetable/today").catch(() => [])
      ]);
      setStats(statsRes);
      setTimetable(ttRes || []);
      await fetchActiveSessions();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      const sessions = await apiFetch("/timetable/active-sessions");
      setActiveSessions(sessions || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Stop camera when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      stopCamera();
    }
  }, [isModalOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startVerification = async () => {
    setErrorMsg("");
    
    // 1. Get Location
    setGeoStatus("requesting");
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setGeoStatus("ready");
    } catch (err: any) {
      setGeoStatus("error");
      setErrorMsg("GPS Location denied or unavailable. Attendance requires location. Please enable location access.");
      return; // Stop if no location
    }

    // 2. Get Camera
    setCamStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCamStatus("ready");
    } catch (err) {
      setCamStatus("error");
      setErrorMsg("Camera access denied or unavailable. Please allow camera access.");
    }
  };

  const handleOpenModal = (session: any) => {
    setSelectedSession(session);
    setIsModalOpen(true);
    setCamStatus("idle");
    setGeoStatus("idle");
    setErrorMsg("");
    setLocation(null);
    startVerification();
  };

  const captureFaceAndSubmit = async () => {
    if (!videoRef.current || !location || !selectedSession) return;
    
    setCamStatus("processing");
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const imageBase64 = canvas.toDataURL("image/jpeg");

    try {
      const response = await apiFetch("/student/attendance/self-mark", {
        method: "POST",
        body: JSON.stringify({
          session_id: selectedSession.id,
          image: imageBase64,
          latitude: location.lat,
          longitude: location.lon
        })
      });
      
      const timeStr = response.check_in 
        ? new Date(response.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
      const subject = response.subject || selectedSession.subject || 'Class';
      
      toast.success(`Attendance marked for ${subject} at ${timeStr}`);
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to mark attendance.");
      setCamStatus("ready");
    }
  };

  // Derived stats
  const present = stats?.history?.filter((h: any) => h.status === "Present" || h.status === "Late").length || 0;
  const absent = stats?.history?.filter((h: any) => h.status === "Absent").length || 0;
  const total = present + absent;
  const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : "0.0";

  return (
    <DashboardLayout title="Student Overview">
      <div className="max-w-7xl mx-auto space-y-8">
        <AnnouncementBanner />
        
        {/* Active Sessions Banner */}
        {activeSessions.length > 0 && (
          <div className="grid gap-4">
            {activeSessions.map((session) => (
              <div key={session.id} className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm shadow-indigo-500/20">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 animate-pulse" />
                <div>
                  <h3 className="text-indigo-600 dark:text-indigo-400 font-bold text-lg flex items-center gap-2">
                    <Radio className="animate-pulse w-5 h-5" /> LIVE CLASS DETECTED
                  </h3>
                  <p className="text-foreground mt-1">
                    Subject: <strong>{session.subject}</strong> | Room: <strong>{session.room_id}</strong>
                  </p>
                </div>
                <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold tracking-wider w-full sm:w-auto" onClick={() => handleOpenModal(session)}>
                  SCAN BIOMETRICS NOW
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-indigo-600 shadow-sm flex flex-col items-center justify-center p-6 bg-card">
             <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Overall Attendance</div>
             <div className="relative w-32 h-32 flex items-center justify-center rounded-full border-8 border-muted">
                <div 
                  className="absolute inset-0 rounded-full border-8 border-indigo-600" 
                  style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%)`, opacity: total > 0 ? 1 : 0.2 }}
                />
                <span className="text-3xl font-black">{percentage}%</span>
             </div>
          </Card>
          <Card className="border-l-4 border-l-emerald-500 shadow-sm flex flex-col p-6 bg-card justify-center">
             <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Attended Days</div>
             <div className="text-5xl font-black text-emerald-600 dark:text-emerald-500">{present}</div>
          </Card>
          <Card className="border-l-4 border-l-rose-500 shadow-sm flex flex-col p-6 bg-card justify-center">
             <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Absent Days</div>
             <div className="text-5xl font-black text-rose-600 dark:text-rose-500">{absent}</div>
          </Card>
          <Card className="border-l-4 border-l-indigo-400 shadow-sm flex flex-col p-6 bg-card justify-center">
             <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Avg Check-in</div>
             <div className="text-4xl font-black text-foreground">--:--</div>
          </Card>
        </div>

        {/* Timetable / History */}
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle>Daily Timetable Feed</CardTitle>
            <CardDescription>Real-time sync of today's classes</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground"><Loader2 className="animate-spin h-6 w-6" /></div>
            ) : timetable.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">No classes scheduled for today.</div>
            ) : (
              <div className="space-y-4">
                {timetable.map((tt: any, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <div className="font-bold text-lg">{tt.subject}</div>
                      <div className="text-sm text-muted-foreground">{tt.teacher_name}</div>
                    </div>
                    <div className="text-sm font-medium mt-2 sm:mt-0">
                      {tt.start_time} - {tt.end_time}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Verification Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" /> Verify Identity
            </DialogTitle>
            <DialogDescription>
              Geofencing and biometric verification required.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center bg-black rounded-lg overflow-hidden relative aspect-video mt-2 border">
            {(camStatus === "ready" || camStatus === "processing") ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-white/70">
                {(geoStatus === "error" || camStatus === "error") ? (
                  <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
                ) : (
                  <MapPin className="w-12 h-12 text-indigo-500 animate-bounce mb-2" />
                )}
                
                <h4 className="font-bold tracking-widest mb-1 text-sm">
                  {geoStatus === "requesting" ? "ACQUIRING GPS LOCK" : 
                   camStatus === "requesting" ? "STARTING CAMERA" : "VERIFICATION FAILED"}
                </h4>
              </div>
            )}
            
            {camStatus === "processing" && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-10">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
              </div>
            )}
          </div>
          
          <div className="text-center">
            {errorMsg ? (
              <div className="text-sm text-rose-600 dark:text-rose-400 font-medium mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 rounded-md">
                {errorMsg}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                Please look directly at the camera.
              </p>
            )}
            
            {(geoStatus === "error" || camStatus === "error") ? (
              <Button onClick={startVerification} variant="outline" className="w-full">
                Retry Access
              </Button>
            ) : (
              <Button 
                onClick={captureFaceAndSubmit} 
                disabled={camStatus !== "ready"} 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {camStatus === "processing" ? "Processing..." : "Scan Face & Mark Present"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
