import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { apiFetch } from "../lib/api";
import { 
  GraduationCap, Loader2, ArrowRight, Camera, ArrowLeft, 
  CheckCircle, AlertCircle, Shield, RefreshCw
} from "lucide-react";

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
      setError(err.detail || "Invalid verification code.");
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
      setError(err.detail || "Failed to resend code.");
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

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[900px] flex flex-col md:flex-row bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Left Sidebar */}
        <div className="md:w-1/3 bg-indigo-600 p-8 text-white flex flex-col justify-between">
          <div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            
            {step === 1 && (
              <>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Create Account</h2>
                <p className="text-indigo-100 text-sm mb-8 leading-relaxed">
                  Join the platform to enable secure, instant attendance tracking powered by AI.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center text-sm font-medium"><CheckCircle className="w-5 h-5 mr-3 text-indigo-200" /> Seamless Registration</div>
                  <div className="flex items-center text-sm font-medium"><CheckCircle className="w-5 h-5 mr-3 text-indigo-200" /> Organization Sync</div>
                  <div className="flex items-center text-sm font-medium"><CheckCircle className="w-5 h-5 mr-3 text-indigo-200" /> Secure Storage</div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Biometric Setup</h2>
                <p className="text-indigo-100 text-sm mb-8 leading-relaxed">
                  Position your face clearly in the frame. We use advanced face recognition for instant verification.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center text-sm font-medium"><CheckCircle className="w-5 h-5 mr-3 text-indigo-200" /> Ensure good lighting</div>
                  <div className="flex items-center text-sm font-medium"><CheckCircle className="w-5 h-5 mr-3 text-indigo-200" /> Look straight ahead</div>
                  <div className="flex items-center text-sm font-medium"><CheckCircle className="w-5 h-5 mr-3 text-indigo-200" /> Follow liveness prompt</div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Secure Verification</h2>
                <p className="text-indigo-100 text-sm mb-8 leading-relaxed">
                  Two-factor authentication adds an extra layer of security to your account.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center text-sm font-medium"><CheckCircle className="w-5 h-5 mr-3 text-indigo-200" /> End-to-end encrypted</div>
                  <div className="flex items-center text-sm font-medium"><CheckCircle className="w-5 h-5 mr-3 text-indigo-200" /> Time-limited codes</div>
                </div>
              </>
            )}
          </div>
          
          <div className="mt-12 pt-8 border-t border-indigo-500/50">
            <div className="flex space-x-2">
              <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? 'bg-white' : 'bg-indigo-400'}`} />
              <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? 'bg-white' : 'bg-indigo-400'}`} />
              <div className={`h-1.5 flex-1 rounded-full ${step >= 3 ? 'bg-white' : 'bg-indigo-400'}`} />
            </div>
            <p className="text-xs font-medium text-indigo-200 mt-3 uppercase tracking-wider">Step {step} of 3</p>
          </div>
        </div>

        {/* Right Content */}
        <div className="md:w-2/3 p-8">
          {error && (
            <div className="mb-6 p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span>{error}</span>
              </div>
              {needsVerification && (
                <Button 
                  type="button"
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white shrink-0" 
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

          {/* STEP 1: Account Info */}
          {step === 1 && (
            <form className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
              <h3 className="text-xl font-bold text-slate-800 mb-6">Basic Information</h3>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Role</label>
                <select 
                  name="requested_role" 
                  value={formData.requested_role} 
                  onChange={handleChange}
                  className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Faculty / Staff</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Full Name <span className="text-rose-500">*</span></label>
                  <Input name="full_name" required placeholder="Enter your full name" value={formData.full_name} onChange={handleChange} className="h-11 bg-slate-50 border-slate-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Email Address <span className="text-rose-500">*</span></label>
                  <Input name="email" type="email" required placeholder="e.g., student@university.edu.in" value={formData.email} onChange={handleChange} className="h-11 bg-slate-50 border-slate-200" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Roll / Employee Number <span className="text-rose-500">*</span></label>
                  <Input name="roll_number" required placeholder={formData.requested_role === 'student' ? 'e.g., CS21001' : 'e.g., EMP1042'} value={formData.roll_number} onChange={handleChange} className="h-11 bg-slate-50 border-slate-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Department <span className="text-rose-500">*</span></label>
                  <select 
                    name="department" 
                    required 
                    value={formData.department} 
                    onChange={handleChange}
                    className="flex h-11 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  >
                    <option value="" disabled>Select Department</option>
                    <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                    <option value="Electronics & Communication">Electronics & Communication</option>
                    <option value="Electrical & Electronics">Electrical & Electronics</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                    <option value="Civil Engineering">Civil Engineering</option>
                    <option value="AI & Data Science">AI & Data Science</option>
                  </select>
                </div>
              </div>

              {formData.requested_role === "student" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Program (Optional)</label>
                    <Input name="program" placeholder="e.g., B.Tech" value={formData.program} onChange={handleChange} className="h-11 bg-white border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Enrolled Subjects (Optional)</label>
                    <Input name="enrolled_subjects" placeholder="CS101, CS102" value={formData.enrolled_subjects} onChange={handleChange} className="h-11 bg-white border-slate-200" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Designation (Optional)</label>
                    <select name="designation" value={formData.designation} onChange={handleChange} className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Select Designation</option>
                      <option value="Assistant Professor">Assistant Professor</option>
                      <option value="Associate Professor">Associate Professor</option>
                      <option value="Professor">Professor</option>
                      <option value="HOD">Head of Department (HOD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Upload ID Card <span className="text-rose-500">*</span></label>
                    <input type="file" ref={idCardRef} onChange={handleIdCardUpload} accept="image/*" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mt-1" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Password <span className="text-rose-500">*</span></label>
                  <Input name="password" type="password" required placeholder="Min 6 characters" value={formData.password} onChange={handleChange} className="h-11 bg-slate-50 border-slate-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Confirm Password <span className="text-rose-500">*</span></label>
                  <Input name="confirm_password" type="password" required placeholder="Confirm password" value={formData.confirm_password} onChange={handleChange} className="h-11 bg-slate-50 border-slate-200" />
                </div>
              </div>

              <div className="pt-6">
                <Button type="button" onClick={nextToStep2} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 text-[15px] font-semibold tracking-wide shadow-md">
                  Continue to Biometrics
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 2: Biometrics */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Biometric Capture</h3>
                <p className="text-slate-500 text-sm mt-1">Please position your face within the frame and follow the prompt.</p>
              </div>

              {isFaceAvailable === false ? (
                <div className="p-8 text-center bg-rose-50 border-2 border-dashed border-rose-200 rounded-2xl text-rose-700">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-semibold text-lg">Face Recognition Unavailable</p>
                  <p className="text-sm mt-2 opacity-80 max-w-sm mx-auto">{faceErrorMsg}</p>
                </div>
              ) : (
                <div className="relative overflow-hidden bg-slate-100 rounded-2xl border-2 border-slate-200 aspect-video flex flex-col items-center justify-center">
                  
                  {!streamActive && !capturedImage && (
                    <div className="text-center p-6 text-slate-400">
                      <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p className="font-medium text-slate-500">Camera is off</p>
                      <p className="text-sm mt-1">Click below to start video feed</p>
                    </div>
                  )}

                  <video 
                    ref={videoRef} 
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${streamActive && !capturedImage ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                    style={{ transform: 'scaleX(-1)' }}
                    autoPlay 
                    playsInline 
                    muted 
                  />
                  
                  {capturedImage && (
                    <img 
                      src={capturedImage} 
                      alt="Captured face" 
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  )}

                  <canvas ref={canvasRef} className="hidden" />

                  {/* Liveness Overlay */}
                  {streamActive && !capturedImage && challenge && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md text-white px-6 py-3 rounded-full border border-indigo-500 shadow-2xl animate-in fade-in slide-in-from-top-4">
                      <div className="flex items-center font-bold tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-3" />
                        {getChallengeText(challenge)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setStep(1)} 
                  className="h-12 flex-1 border-slate-200"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                
                {isFaceAvailable !== false && (
                  <>
                    <Button 
                      type="button" 
                      onClick={startCamera} 
                      variant={streamActive ? "destructive" : "secondary"}
                      className="h-12 flex-1"
                    >
                      {streamActive ? "Stop Camera" : (capturedImage ? "Retake Photo" : "Start Camera")}
                    </Button>
                    
                    <Button 
                      type="button" 
                      onClick={capturePhoto} 
                      disabled={!streamActive}
                      className="h-12 flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4 mr-2" /> Capture Frame
                    </Button>
                  </>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Button 
                  type="button" 
                  onClick={submitRegistration} 
                  disabled={loading || !capturedImage}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-[15px] font-semibold tracking-wide shadow-md"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Shield className="w-5 h-5 mr-2" />}
                  {loading ? "Registering..." : "Submit Registration"}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: OTP */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Verify Your Email</h3>
                <p className="text-slate-500">
                  We've sent a 6-digit verification code to<br/>
                  <strong className="text-slate-900">{formData.email}</strong>
                </p>
              </div>

              <div className="max-w-xs mx-auto space-y-5 pt-4">
                <div className="relative">
                  <Input 
                    type="text" 
                    maxLength={6} 
                    placeholder="• • • • • •" 
                    value={otp} 
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="h-16 text-center text-3xl font-bold tracking-[0.5em] bg-slate-50 border-slate-200"
                  />
                </div>
                
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-500 flex items-center justify-center">
                    Code expires in: 
                    <span className={`ml-2 font-bold ${timeLeft < 30 ? 'text-rose-600' : 'text-indigo-600'}`}>
                      {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                  </p>
                </div>

                <Button 
                  type="button" 
                  onClick={verifyOtp} 
                  disabled={loading || otp.length !== 6 || timeLeft === 0}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 text-[15px] font-semibold"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                  Verify Account
                </Button>
                
                <div className="text-center pt-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={resendOtp}
                    disabled={loading || timeLeft > 60}
                    className="text-sm text-slate-500 hover:text-indigo-600"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" /> Resend Code
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {step === 1 && (
            <p className="text-center text-sm text-slate-500 mt-8 pb-4 border-t border-slate-100 pt-6">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
                Sign in
              </Link>
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
