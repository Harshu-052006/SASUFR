import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../layouts/AuthLayout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { apiFetch } from "../lib/api";
import { 
  Loader2, ArrowRight, Camera, ArrowLeft, 
  CheckCircle, AlertCircle, Shield, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

type Role = "student" | "teacher";

export function Register() {
  const navigate = useNavigate();
  
  // State Machine
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    requested_role: "student" as Role,
    full_name: "",
    email: "",
    roll_number: "",
    department: "",
    password: "",
    confirm_password: "",
    program: "",
    enrolled_subjects: "", // comma separated
    designation: "",
  });

  // Biometrics State
  const [isFaceAvailable, setIsFaceAvailable] = useState<boolean | null>(null);
  const [faceErrorMsg, setFaceErrorMsg] = useState("");
  const [streamActive, setStreamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  
  // OTP State
  const [otp, setOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // File input ref for Teacher ID Card
  const idCardRef = useRef<HTMLInputElement>(null);
  const [idCardImage, setIdCardImage] = useState<string | null>(null);

  useEffect(() => {
    // Check health for face recognition
    apiFetch("/health")
      .then((data: any) => {
        if (data.face_recognition_available === false) {
          setIsFaceAvailable(false);
          setFaceErrorMsg(
            data.face_recognition_error 
              ? `Face recognition is unavailable: ${data.face_recognition_error}`
              : "Face recognition is unavailable in this environment. Please contact the administrator."
          );
        } else {
          setIsFaceAvailable(true);
        }
      })
      .catch(() => {
        // If unreachable, assume true for UI flow, it will fail on submit
        setIsFaceAvailable(true);
      });
  }, []);

  useEffect(() => {
    // Cleanup camera stream on unmount
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    // OTP Countdown Timer
    let timer: ReturnType<typeof setInterval>;
    if (step === 3 && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    setNeedsVerification(false);
  };

  const handleIdCardUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setIdCardImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const nextToStep2 = () => {
    setError("");
    setNeedsVerification(false);
    
    if (!formData.full_name.trim() || !formData.email.trim() || !formData.roll_number.trim() || !formData.department || !formData.password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (formData.requested_role === "teacher" && !idCardImage) {
      setError("Please upload your faculty ID card.");
      return;
    }

    setStep(2);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  const startCamera = async () => {
    setError("");
    if (streamActive) {
      stopCamera();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStreamActive(true);
      setCapturedImage(null);
      
      const challenges = ["smile", "turn_left", "turn_right"];
      setChallenge(challenges[Math.floor(Math.random() * challenges.length)]);
    } catch (err) {
      console.error(err);
      setError("Camera access denied or device not found. Please check your browser permissions.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !streamActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const submitRegistration = async () => {
    setError("");
    setNeedsVerification(false);

    if (isFaceAvailable === false) {
      setError(faceErrorMsg);
      return;
    }

    if (!capturedImage) {
      setError("Please capture your face first.");
      return;
    }

    setLoading(true);
    
    const payload: any = {
      full_name: formData.full_name,
      roll_number: formData.roll_number,
      email: formData.email,
      department: formData.department,
      password: formData.password,
      face_image: capturedImage,
      liveness_challenge: challenge,
      requested_role: formData.requested_role
    };

    if (formData.requested_role === "student") {
      payload.program = formData.program;
      payload.enrolled_subjects = formData.enrolled_subjects 
        ? formData.enrolled_subjects.split(',').map(s => s.trim()).filter(Boolean)
        : [];
    } else {
      payload.designation = formData.designation;
      payload.id_card_image = idCardImage;
    }

    try {
      await apiFetch("/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      // Registration Success -> goto OTP
      setStep(3);
      setTimeLeft(120);
    } catch (err: any) {
      let errorMsg = "Registration failed";
      if (err.detail) {
        if (typeof err.detail === 'string') {
          errorMsg = err.detail;
          if (err.detail.includes("already registered")) {
            setNeedsVerification(true);
          }
        } else if (Array.isArray(err.detail)) {
          errorMsg = err.detail.map((e: any) => `${e.loc[e.loc.length-1]}: ${e.msg}`).join(', ');
        }
      } else if (err.message && err.message !== "[object Object]") {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError("");
    if (otp.length !== 6) {
      setError("Please enter a 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: formData.email, otp }),
      });
      navigate("/login");
    } catch (err: any) {
      toast.error(err.detail || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/resend-otp", {
        method: "POST",
        body: JSON.stringify({ email: formData.email }),
      });
      if (res.already_verified) {
        navigate("/login");
        return;
      }
      setTimeLeft(120);
    } catch (err: any) {
      toast.error(err.detail || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  const getChallengeText = (ch: string | null) => {
    if (ch === "smile") return "Please SMILE widely!";
    if (ch === "turn_left") return "Turn your head to the LEFT";
    if (ch === "turn_right") return "Turn your head to the RIGHT";
    return "";
  };

  const leftContent = (
    <div className="relative z-10">
      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 mt-20">
          <h2 className="text-[2.8rem] leading-[1.1] font-extrabold text-foreground tracking-[-0.04em] mb-4">Create<br/>Account</h2>
          <p className="text-muted-foreground text-[1.1rem] leading-[1.7] mb-8">Join the platform to enable secure, instant attendance tracking powered by AI.</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm font-bold"><CheckCircle className="w-5 h-5 text-[#06B6D4]" /> Seamless Registration</div>
            <div className="flex items-center gap-3 text-sm font-bold"><CheckCircle className="w-5 h-5 text-[#06B6D4]" /> Organization Sync</div>
            <div className="flex items-center gap-3 text-sm font-bold"><CheckCircle className="w-5 h-5 text-[#06B6D4]" /> Secure Storage</div>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 mt-20">
          <h2 className="text-[2.8rem] leading-[1.1] font-extrabold text-foreground tracking-[-0.04em] mb-4">Biometric<br/>Setup</h2>
          <p className="text-muted-foreground text-[1.1rem] leading-[1.7] mb-8">Position your face clearly in the frame. We use advanced face recognition for instant verification.</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm font-bold"><CheckCircle className="w-5 h-5 text-[#06B6D4]" /> Ensure good lighting</div>
            <div className="flex items-center gap-3 text-sm font-bold"><CheckCircle className="w-5 h-5 text-[#06B6D4]" /> Look straight ahead</div>
            <div className="flex items-center gap-3 text-sm font-bold"><CheckCircle className="w-5 h-5 text-[#06B6D4]" /> Follow liveness prompt</div>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 mt-20">
          <h2 className="text-[2.8rem] leading-[1.1] font-extrabold text-foreground tracking-[-0.04em] mb-4">Secure<br/>Verification</h2>
          <p className="text-muted-foreground text-[1.1rem] leading-[1.7] mb-8">Two-factor authentication adds an extra layer of security to your account.</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm font-bold"><CheckCircle className="w-5 h-5 text-[#06B6D4]" /> End-to-end encrypted</div>
            <div className="flex items-center gap-3 text-sm font-bold"><CheckCircle className="w-5 h-5 text-[#06B6D4]" /> Time-limited codes</div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AuthLayout leftContent={leftContent} maxWidthClass="max-w-md">
      <div className="flex flex-col justify-center">
        {/* Stepper */}
        <div className="flex items-center gap-3 mb-8 mx-auto sm:mx-0">
          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-extrabold ${step >= 1 ? (step > 1 ? 'bg-[#06B6D4]/10 border-[#06B6D4] text-[#06B6D4]' : 'bg-[#06B6D4] border-[#06B6D4] text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]') : 'border-border text-muted-foreground'}`}>1</div>
          <div className={`w-8 h-[1px] ${step >= 2 ? 'bg-[#06B6D4]' : 'bg-border'}`} />
          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-extrabold ${step >= 2 ? (step > 2 ? 'bg-[#06B6D4]/10 border-[#06B6D4] text-[#06B6D4]' : 'bg-[#06B6D4] border-[#06B6D4] text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]') : 'border-border text-muted-foreground'}`}>2</div>
          <div className={`w-8 h-[1px] ${step >= 3 ? 'bg-[#06B6D4]' : 'bg-border'}`} />
          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-extrabold ${step >= 3 ? 'bg-[#06B6D4] border-[#06B6D4] text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]' : 'border-border text-muted-foreground'}`}>3</div>
        </div>

        {error && (
          <div className="mb-6 p-4 text-[0.88rem] text-destructive bg-destructive/10 border border-destructive/20 rounded-md flex items-center justify-between gap-3">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
            {needsVerification && (
              <Button 
                variant="destructive"
                size="sm"
                onClick={() => {
                  setStep(3);
                  apiFetch("/resend-otp", { method: "POST", body: JSON.stringify({ email: formData.email }) }).catch(() => {});
                  setTimeLeft(120);
                }}
              >
                Verify Now
              </Button>
            )}
          </div>
        )}

        {step === 1 && (
          <form className="space-y-4 animate-in fade-in duration-500">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-muted-foreground uppercase tracking-[0.1em]">ROLE</label>
              <Select value={formData.requested_role} onValueChange={(val) => setFormData(prev => ({ ...prev, requested_role: val as Role }))}>
                <SelectTrigger className="h-11 bg-background">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Faculty / Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-muted-foreground uppercase tracking-[0.1em]">FULL NAME</label>
                <Input name="full_name" required placeholder="Enter your full name" value={formData.full_name} onChange={handleChange} className="h-11 bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-muted-foreground uppercase tracking-[0.1em]">EMAIL ADDRESS</label>
                <Input name="email" type="email" required placeholder="e.g. student@college.edu" value={formData.email} onChange={handleChange} className="h-11 bg-background" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-muted-foreground uppercase tracking-[0.1em]">ID NUMBER</label>
                <Input name="roll_number" required placeholder={formData.requested_role === 'student' ? 'e.g. CS21001' : 'e.g. EMP1042'} value={formData.roll_number} onChange={handleChange} className="h-11 bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-muted-foreground uppercase tracking-[0.1em]">DEPARTMENT</label>
                <Select required value={formData.department} onValueChange={(val) => setFormData(prev => ({ ...prev, department: val }))}>
                  <SelectTrigger className="h-11 bg-background">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Computer Science & Engineering">Computer Science & Engineering</SelectItem>
                    <SelectItem value="Electronics & Communication">Electronics & Communication</SelectItem>
                    <SelectItem value="Electrical & Electronics">Electrical & Electronics</SelectItem>
                    <SelectItem value="Information Technology">Information Technology</SelectItem>
                    <SelectItem value="Mechanical Engineering">Mechanical Engineering</SelectItem>
                    <SelectItem value="Civil Engineering">Civil Engineering</SelectItem>
                    <SelectItem value="AI & Data Science">AI & Data Science</SelectItem>
                    <SelectItem value="Computer Applications">Computer Applications</SelectItem>
                    
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.requested_role === "student" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none text-muted-foreground uppercase tracking-[0.1em]">PROGRAM (OPTIONAL)</label>
                  <Input name="program" placeholder="e.g. B.Tech" value={formData.program} onChange={handleChange} className="h-11 bg-background" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none text-muted-foreground uppercase tracking-[0.1em]">SUBJECTS (OPTIONAL)</label>
                  <Input name="enrolled_subjects" placeholder="CS101, CS102" value={formData.enrolled_subjects} onChange={handleChange} className="h-11 bg-background" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none text-muted-foreground uppercase tracking-[0.1em]">DESIGNATION (OPTIONAL)</label>
                  <Select value={formData.designation} onValueChange={(val) => setFormData(prev => ({ ...prev, designation: val }))}>
                    <SelectTrigger className="h-11 bg-background">
                      <SelectValue placeholder="Select Designation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Assistant Professor">Assistant Professor</SelectItem>
                      <SelectItem value="Associate Professor">Associate Professor</SelectItem>
                      <SelectItem value="Professor">Professor</SelectItem>
                      <SelectItem value="HOD">Head of Department (HOD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none text-muted-foreground uppercase tracking-[0.1em]">UPLOAD ID CARD</label>
                  <input type="file" ref={idCardRef} onChange={handleIdCardUpload} accept="image/*" className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-muted file:text-foreground hover:file:bg-muted/80 mt-1 cursor-pointer" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-muted-foreground uppercase tracking-[0.1em]">PASSWORD</label>
                <Input name="password" type="password" required placeholder="Min 6 characters" value={formData.password} onChange={handleChange} className="h-11 bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-muted-foreground uppercase tracking-[0.1em]">CONFIRM PASSWORD</label>
                <Input name="confirm_password" type="password" required placeholder="Confirm password" value={formData.confirm_password} onChange={handleChange} className="h-11 bg-background" />
              </div>
            </div>

            <div className="pt-6">
              <Button 
                type="button" 
                onClick={nextToStep2} 
                className="w-full h-12 bg-gradient-to-br from-[#06B6D4] to-[#6366F1] text-white font-extrabold uppercase tracking-wider shadow-[0_8px_24px_rgba(99,102,241,0.3)] hover:scale-[1.02] hover:shadow-[0_12px_32px_rgba(99,102,241,0.4)] transition-all border-none"
              >
                Continue to Biometrics <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: Biometrics */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col items-center">
            
            {isFaceAvailable === false ? (
              <div className="w-full p-8 text-center bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-bold text-lg">Face Recognition Unavailable</p>
                <p className="text-sm mt-2 opacity-80 max-w-sm mx-auto">{faceErrorMsg}</p>
              </div>
            ) : (
              <div className="w-full max-w-[500px] aspect-video bg-muted/50 rounded-md border border-border relative overflow-hidden flex items-center justify-center">
                {!streamActive && !capturedImage && (
                  <div className="text-center text-muted-foreground">
                    <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-bold uppercase tracking-[1px] text-[0.8rem]">Camera Offline</p>
                  </div>
                )}

                <video 
                  ref={videoRef} 
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${streamActive && !capturedImage ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                  style={{ transform: 'scaleX(-1)' }}
                  autoPlay playsInline muted 
                />
                
                {capturedImage && (
                  <img src={capturedImage} alt="Captured" className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                )}
                
                <canvas ref={canvasRef} className="hidden" />

                {streamActive && !capturedImage && (
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-[#06B6D4] shadow-[0_0_15px_#06B6D4] opacity-60 animate-[scan_3s_linear_infinite]" />
                )}

                {streamActive && !capturedImage && challenge && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-md text-foreground px-5 py-2 rounded-full border border-[#06B6D4]/50 shadow-2xl flex items-center font-bold tracking-wide text-sm">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse mr-3" />
                    {getChallengeText(challenge)}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 w-full pt-4">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="w-full sm:w-auto font-bold flex items-center justify-center">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              
              {isFaceAvailable !== false && (
                <>
                  <Button type="button" variant={streamActive ? "destructive" : "secondary"} onClick={startCamera} className="flex-1 font-bold">
                    {streamActive ? "Stop Camera" : (capturedImage ? "Retake Photo" : "Start Camera")}
                  </Button>
                  
                  <Button 
                    type="button" 
                    onClick={capturePhoto} 
                    disabled={!streamActive} 
                    className="flex-1 bg-gradient-to-r from-[#06B6D4] to-[#6366F1] text-white font-black tracking-[1px] shadow-[0_8px_24px_rgba(99,102,241,0.3)] hover:scale-[1.02] transition-all flex items-center justify-center uppercase border-none"
                  >
                    <Camera className="w-4 h-4 mr-2" /> Capture
                  </Button>
                </>
              )}
            </div>

            <Button 
              type="button" 
              onClick={submitRegistration} 
              disabled={loading || !capturedImage} 
              className="w-full mt-2 bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-black tracking-[1px] shadow-[0_8px_24px_rgba(16,185,129,0.3)] hover:scale-[1.02] hover:shadow-[0_12px_32px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center uppercase border-none"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Shield className="w-5 h-5 mr-2" />}
              {loading ? "Registering..." : "Submit Registration"}
            </Button>
          </div>
        )}

        {/* STEP 3: OTP */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 w-full max-w-[400px] mx-auto">
            <div className="text-center">
              <div className="w-20 h-20 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#10B981]/20">
                <Shield className="w-10 h-10 text-[#10B981]" />
              </div>
              <h3 className="text-2xl font-black text-foreground mb-2">Verify Your Email</h3>
              <p className="text-muted-foreground">
                We've sent a 6-digit verification code to<br/>
                <strong className="text-foreground">{formData.email}</strong>
              </p>
            </div>

            <div className="space-y-5 pt-4">
              <Input 
                type="text" 
                maxLength={6} 
                placeholder="••••••" 
                value={otp} 
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full h-16 text-center text-3xl font-black tracking-[0.5em] bg-background"
              />
              
              <div className="text-center">
                <p className="text-sm font-bold text-muted-foreground flex items-center justify-center">
                  Code expires in: 
                  <span className={`ml-2 font-mono text-lg ${timeLeft < 30 ? 'text-destructive' : 'text-[#06B6D4]'}`}>
                    {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </p>
              </div>

              <Button 
                type="button" 
                onClick={verifyOtp} 
                disabled={loading || otp.length !== 6 || timeLeft === 0} 
                className="w-full bg-gradient-to-r from-[#06B6D4] to-[#6366F1] text-white font-black tracking-[1px] shadow-[0_8px_24px_rgba(99,102,241,0.3)] hover:scale-[1.02] hover:shadow-[0_12px_32px_rgba(99,102,241,0.4)] transition-all flex items-center justify-center uppercase border-none"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null} Verify Account
              </Button>
              
              <div className="text-center pt-2">
                <button type="button" onClick={resendOtp} disabled={loading || timeLeft > 60} className="text-sm font-bold text-muted-foreground hover:text-[#06B6D4] transition-colors flex items-center justify-center mx-auto disabled:opacity-50">
                  <RefreshCw className="w-4 h-4 mr-2" /> Resend Code
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-8 pt-6 border-t border-border text-center text-[0.9rem] text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-[#06B6D4] hover:text-foreground transition-colors">Sign in here</Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
