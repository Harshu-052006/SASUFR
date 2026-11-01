import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "./components/theme-provider";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Otp } from "./pages/Otp";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";

// Admin
import { AdminDashboard } from "./pages/admin/Dashboard";
import { Students } from "./pages/admin/Students";
import { Reports as AdminReports } from "./pages/admin/Reports";
import { Settings as AdminSettings } from "./pages/admin/Settings";
import { Profile as AdminProfile } from "./pages/admin/Profile";
import { Security as AdminSecurity } from "./pages/admin/Security";
import { Timetables as AdminTimetables } from "./pages/admin/Timetables";

// Student
import { Dashboard as StudentDashboard } from "./pages/student/Dashboard";  
import { Profile as StudentProfile } from "./pages/student/Profile";
import { Settings as StudentSettings } from "./pages/student/Settings";

// Teacher
import { Dashboard as TeacherDashboard } from "./pages/teacher/Dashboard";
import { MarkAttendance as TeacherMarkAttendance } from "./pages/teacher/MarkAttendance";
import { Students as TeacherStudents } from "./pages/teacher/Students";
import { ViewAttendance as TeacherViewAttendance } from "./pages/teacher/ViewAttendance";
import { Reports as TeacherReports } from "./pages/teacher/Reports";
import { Profile as TeacherProfile } from "./pages/teacher/Profile";
import { Settings as TeacherSettings } from "./pages/teacher/Settings";

import { NotFound } from "./pages/NotFound";

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <Toaster 
        theme="dark" 
        position="bottom-right"
        toastOptions={{
          className: "bg-[#161F30] border-[#2A3854] text-[#F8FAFC] font-sans shadow-[0_8px_30px_rgb(0,0,0,0.4)]",
          classNames: {
            success: "text-[#10B981] border-[#10B981]/20 bg-[#10B981]/10",
            error: "text-[#EF4444] border-[#EF4444]/20 bg-[#EF4444]/10",
          }
        }} 
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/otp" element={<Otp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/students" element={<Students />} />
          <Route path="/admin/timetables" element={<AdminTimetables />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/security" element={<AdminSecurity />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/profile" element={<AdminProfile />} />
          
          {/* Student Routes */}
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/profile" element={<StudentProfile />} />
          <Route path="/student/settings" element={<StudentSettings />} />

          {/* Teacher Routes */}
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/mark-attendance" element={<TeacherMarkAttendance />} />
          <Route path="/teacher/students" element={<TeacherStudents />} />
          <Route path="/teacher/attendance" element={<TeacherViewAttendance />} />
          <Route path="/teacher/view-attendance" element={<TeacherViewAttendance />} />
          <Route path="/teacher/reports" element={<TeacherReports />} />
          <Route path="/teacher/profile" element={<TeacherProfile />} />
          <Route path="/teacher/settings" element={<TeacherSettings />} />

          {/* Catch-all 404 route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
