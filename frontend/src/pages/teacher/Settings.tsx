import { Settings as StudentSettings } from "../student/Settings";

export function Settings() {
  // Reuse the same settings component since the password change API is identical
  return <StudentSettings />;
}
