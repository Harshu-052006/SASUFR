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
  Camera, MapPin, Loader2, Radio, AlertCircle
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
  const [roomCode, setRoomCode] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [selectedSession, setSelectedSession] = useState<any>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchActiveSessions, 15000);
    return () => clearInterval(interval);
  }, []);

  // Synchronize video stream to video element whenever modal or status updates
  useEffect(() => {
    if (isModalOpen && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [isModalOpen, camStatus]);

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
      const [studentSessions, timetableSessions] = await Promise.all([
        apiFetch("/student/sessions/active").catch(() => []),
        apiFetch("/timetable/active-sessions").catch(() => [])
      ]);
      const combined = [...(studentSessions || [])];
      const seen = new Set(combined.map((s: any) => String(s.id)));
      for (const s of (timetableSessions || [])) {
        if (!seen.has(String(s.id))) {
          seen.add(String(s.id));
          combined.push(s);
        }
      }
      setActiveSessions(combined);
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
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startVerification = async () => {
    setErrorMsg("");
    
    // 1. Try to get Location (optional during dev if GPS blocked)
    setGeoStatus("requesting");
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 });
      });
      setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setGeoStatus("ready");
    } catch (err: any) {
      console.warn("Location unavailable:", err);
      setGeoStatus("idle");
    }

    // 2. Start Camera
    setCamStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCamStatus("ready");
    } catch (err) {
      console.error("Camera error:", err);
      setCamStatus("error");
      setErrorMsg("Camera access denied or unavailable. Please allow camera access in your browser.");
    }
  };

  const handleOpenModal = (session: any) => {
    setSelectedSession(session);
    setRoomCode(session.room_code || "");
    setIsModalOpen(true);
    setCamStatus("idle");
    setGeoStatus("idle");
    setErrorMsg("");
    setLocation(null);
    startVerification();
  };

  const captureFaceAndSubmit = async () => {
    const video = videoRef.current;
    if (!video || !selectedSession) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("Camera preview is still initializing. Please wait a second and try again.");
      setErrorMsg("Camera preview not ready yet. Please ensure your webcam is enabled.");
      return;
    }
    
    setCamStatus("processing");
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCamStatus("ready");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.9);

    if (!imageBase64 || imageBase64.length < 500) {
      toast.error("Failed to capture video frame.");
      setErrorMsg("Camera frame was empty. Please check your webcam.");
      setCamStatus("ready");
      return;
    }

    try {
      const response = await apiFetch("/student/attendance/self-mark", {
        method: "POST",
        body: JSON.stringify({
          session_id: selectedSession.id,
          room_code: roomCode.trim() || selectedSession.room_code || "",
          image: imageBase64,
          latitude: location?.lat ?? null,
          longitude: location?.lon ?? null
        })
      });
      
      const timeStr = response.check_in 
        ? new Date(response.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
      const subject = response.subject || selectedSession.subject || 'Class';
      
      toast.success(response.message || `Attendance marked for ${subject} at ${timeStr}`);
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to mark attendance.");
      setErrorMsg(err.message || "Attendance verification failed.");
      setCamStatus("ready");
    }
  };

  // Derived stats
  const historyList = Array.isArray(stats?.history) ? stats.history : [];
  const present = historyList.filter((h: any) => h.status === "Present" || h.status === "Late").length;
  const absent = historyList.filter((h: any) => h.status === "Absent").length;
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
                <div className="space-y-1">
                  <h3 className="text-indigo-600 dark:text-indigo-400 font-bold text-lg flex items-center gap-2">
                    <Radio className="animate-pulse w-5 h-5 text-rose-500" /> LIVE CLASS DETECTED
                  </h3>
                  <p className="text-foreground text-base">
                    Subject: <strong>{session.subject}</strong>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Room / Class: <strong>{session.class_name || session.room_id || "Classroom"}</strong>
                    {session.teacher_name && <span> | Faculty: <strong>{session.teacher_name}</strong></span>}
                  </p>
                </div>
                <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold tracking-wider w-full sm:w-auto shadow-md" onClick={() => handleOpenModal(session)}>
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
              Biometric face recognition and session verification for {selectedSession?.subject || "Live Session"}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Lecture Session PIN / Room Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit PIN"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="w-full px-3 py-2 text-center text-lg tracking-widest font-mono font-bold border rounded-lg uppercase bg-background focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="flex flex-col items-center justify-center bg-black rounded-lg overflow-hidden relative aspect-video border">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${
                  camStatus === "ready" || camStatus === "processing" ? "opacity-100" : "opacity-0 absolute pointer-events-none"
                }`}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    videoRef.current.play().catch(() => {});
                  }
                }}
              />
              <canvas ref={canvasRef} className="hidden" />

              {camStatus !== "ready" && camStatus !== "processing" && (
                <div className="flex flex-col items-center justify-center p-6 text-center text-white/70">
                  {camStatus === "error" ? (
                    <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
                  ) : (
                    <MapPin className="w-12 h-12 text-indigo-500 animate-bounce mb-2" />
                  )}
                  
                  <h4 className="font-bold tracking-widest mb-1 text-sm">
                    {camStatus === "requesting" ? "STARTING CAMERA" : 
                     geoStatus === "requesting" ? "CHECKING LOCATION" : "INITIALIZING CAMERA..."}
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
                <div className="text-sm text-rose-600 dark:text-rose-400 font-medium mb-3 p-3 bg-rose-50 dark:bg-rose-950/50 rounded-md">
                  {errorMsg}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">
                  Please look directly into the camera and click below.
                </p>
              )}
              
              {camStatus === "error" ? (
                <Button onClick={startVerification} variant="outline" className="w-full">
                  Retry Camera Access
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
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
