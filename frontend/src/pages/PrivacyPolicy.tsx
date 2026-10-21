import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Eye, Database, FileText, CheckCircle2 } from "lucide-react";

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0B0F17] text-[#F8FAFC] selection:bg-[#6366F1] selection:text-white">
      {/* Header */}
      <header className="border-b border-[#2A3854]/40 bg-[#161F30]/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#38BDF8] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#38BDF8]" />
            <span className="font-bold text-sm tracking-wide">SASUFR Security & Privacy</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#38BDF8]/10 text-[#38BDF8] text-xs font-semibold mb-4 border border-[#38BDF8]/20">
            <Lock className="w-3.5 h-3.5" /> Institutional Biometric Compliance
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-4">
            Privacy & Biometric Data Policy
          </h1>
          <p className="text-[#94A3B8] max-w-2xl mx-auto text-sm leading-relaxed">
            The Smart Attendance System Using Face Recognition (SASUFR) prioritizes data minimization,
            field-level cryptographic protection, and transparent institutional governance.
          </p>
        </div>

        <div className="space-y-8">
          {/* Section 1 */}
          <div className="p-6 rounded-2xl bg-[#161F30]/40 border border-[#2A3854]/60 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#38BDF8]/10 text-[#38BDF8] flex items-center justify-center font-bold">
                <Database className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">1. Biometric Vectorization & Encryption at Rest</h2>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed mb-4">
              SASUFR processes high-resolution camera frames purely to extract 128-dimensional mathematical feature vectors using deep convolutional metric learning.
            </p>
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                <span><strong>No Raw Image Retention:</strong> Facial encodings are converted into 128-d floating point vectors and immediately encrypted using AES-256 (Fernet) keys before being stored in the database.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                <span><strong>Irreversible Math:</strong> 128-d facial embeddings cannot be reverse-engineered or reconstructed into human-recognizable facial photographs.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                <span><strong>In-Memory Search:</strong> Biometric comparisons occur via in-memory FAISS L2 Euclidean distance indexing without exposing biometric data to disk logs.</span>
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="p-6 rounded-2xl bg-[#161F30]/40 border border-[#2A3854]/60 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">2. Geolocation & Physical Attendance Verification</h2>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed mb-4">
              During self-service attendance mark requests, the application samples the device’s GPS location via the HTML5 Geolocation API.
            </p>
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                <span><strong>Ephemeral Haversine Calculation:</strong> GPS coordinates are validated against the institution's designated campus geofence boundary (e.g. 3.0 km radius).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                <span><strong>No Continuous Tracking:</strong> SASUFR does not perform background tracking or continuous location surveillance. Location data is queried solely at the instant of check-in.</span>
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="p-6 rounded-2xl bg-[#161F30]/40 border border-[#2A3854]/60 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center font-bold">
                <Eye className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">3. Role-Based Access Control (RBAC) & Logs</h2>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed mb-4">
              Attendance records, student identifiers, and administrative logs are guarded by cryptographically signed JWT sessions and strict role constraints:
            </p>
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                <span><strong>Student Access:</strong> Students can only view their own attendance history, percentage stats, and course timetable.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                <span><strong>Faculty Access:</strong> Teachers can initiate active lecture sessions for their assigned department, monitor scans, and execute manual overrides for medical exceptions.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] mt-0.5 shrink-0" />
                <span><strong>Admin Telemetry:</strong> System administrators oversee geofence radius configs, audit tamper attempts (e.g. duplicate face registrations or spoof alerts), and approve faculty accounts.</span>
              </li>
            </ul>
          </div>

          {/* Section 4 */}
          <div className="p-6 rounded-2xl bg-[#161F30]/40 border border-[#2A3854]/60 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">4. Data Retention & Student Rights</h2>
            </div>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Upon graduation, course withdrawal, or formal de-enrollment, a student's biometric vector is permanently purged from active memory and the MongoDB database upon administrative approval.
            </p>
          </div>
        </div>

        {/* Action Link */}
        <div className="mt-12 text-center">
          <Link
            to="/register"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#38BDF8] text-white font-semibold text-sm shadow-lg shadow-[#6366F1]/20 hover:opacity-95 transition-opacity"
          >
            Return to Registration
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-[#64748B] border-t border-[#2A3854]/40 bg-[#0B0F17]">
        &copy; {new Date().getFullYear()} SASUFR Biometric Identity & Attendance System. All rights reserved.
      </footer>
    </div>
  );
}
