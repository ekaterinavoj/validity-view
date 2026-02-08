import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * Redirects to the first accessible module for the current user.
 * Falls back to /trainings if user is admin or has no module access configured.
 */
export const ModuleRedirect = () => {
  const { loading, rolesLoaded, hasModuleAccess, isAdmin } = useAuth();

  // Wait for auth and roles to load
  if (loading || !rolesLoaded) {
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

  // Fallback if no module access (shouldn't happen)
  return <Navigate to="/trainings" replace />;
};
