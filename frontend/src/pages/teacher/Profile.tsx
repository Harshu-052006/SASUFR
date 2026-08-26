import { Profile as StudentProfile } from "../student/Profile";

export function Profile() {
  // Reuse the same profile component since the API endpoint is the same (/users/me)
  // and the layout supports dynamic data.
  return <StudentProfile />;
}
