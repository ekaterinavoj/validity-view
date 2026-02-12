import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * Redirects to the first accessible module for the current user.
 * Falls back to /no-access only if user truly has zero module access.
 */
export const ModuleRedirect = () => {
  const { loading, rolesLoaded, moduleAccessLoaded, hasModuleAccess, isAdmin } = useAuth();

  // Wait for auth, roles AND module access to fully load
  if (loading || !rolesLoaded || !moduleAccessLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Admins have access to everything, default to trainings
  if (isAdmin) {
    return <Navigate to="/trainings" replace />;
  }

  // Redirect to first accessible module
  if (hasModuleAccess("trainings")) {
    return <Navigate to="/trainings" replace />;
  }
  if (hasModuleAccess("deadlines")) {
    return <Navigate to="/deadlines" replace />;
  }
  if (hasModuleAccess("plp")) {
    return <Navigate to="/plp" replace />;
  }

  // No module access — show no-access page
  return <Navigate to="/no-access" replace />;
};
