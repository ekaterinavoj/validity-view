import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import Statistics from "./pages/Statistics";
import ScheduledTrainings from "./pages/ScheduledTrainings";
import History from "./pages/History";
import NewTraining from "./pages/NewTraining";
import EditTraining from "./pages/EditTraining";
import Employees from "./pages/Employees";
import TrainingTypes from "./pages/TrainingTypes";
import Departments from "./pages/Departments";
import Facilities from "./pages/Facilities";
import InactiveEmployeesReport from "./pages/InactiveEmployeesReport";
import Auth from "./pages/Auth";
import AuditLog from "./pages/AuditLog";
import Profile from "./pages/Profile";
import AdminSettings from "./pages/AdminSettings";
import SystemStatus from "./pages/SystemStatus";
import UserManagement from "./pages/UserManagement";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const ProtectedLayout = ({ children, requiredRoles }: { children: React.ReactNode; requiredRoles?: Array<"admin" | "manager" | "user"> }) => (
  <ProtectedRoute requiredRoles={requiredRoles}>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            {/* Primary navigation - accessible to all approved users */}
            <Route path="/" element={<ProtectedLayout><ScheduledTrainings /></ProtectedLayout>} />
            <Route path="/scheduled-trainings" element={<ProtectedLayout><ScheduledTrainings /></ProtectedLayout>} />
            <Route path="/history" element={<ProtectedLayout><History /></ProtectedLayout>} />
            <Route path="/new-training" element={<ProtectedLayout><NewTraining /></ProtectedLayout>} />
            <Route path="/edit-training/:id" element={<ProtectedLayout><EditTraining /></ProtectedLayout>} />
            <Route path="/statistics" element={<ProtectedLayout><Statistics /></ProtectedLayout>} />
            {/* Ostatní dropdown routes - accessible to all approved users */}
            <Route path="/employees" element={<ProtectedLayout><Employees /></ProtectedLayout>} />
            <Route path="/training-types" element={<ProtectedLayout><TrainingTypes /></ProtectedLayout>} />
            <Route path="/departments" element={<ProtectedLayout><Departments /></ProtectedLayout>} />
            <Route path="/facilities" element={<ProtectedLayout><Facilities /></ProtectedLayout>} />
            <Route path="/inactive" element={<ProtectedLayout><InactiveEmployeesReport /></ProtectedLayout>} />
            {/* Audit log - admin and manager only */}
            <Route path="/audit-log" element={<ProtectedLayout requiredRoles={["admin", "manager"]}><AuditLog /></ProtectedLayout>} />
            {/* Profile - all approved users */}
            <Route path="/profile" element={<ProtectedLayout><Profile /></ProtectedLayout>} />
            {/* Admin-only routes */}
            <Route path="/admin/settings" element={<ProtectedLayout requiredRoles={["admin"]}><AdminSettings /></ProtectedLayout>} />
            <Route path="/admin/status" element={<ProtectedLayout requiredRoles={["admin"]}><SystemStatus /></ProtectedLayout>} />
            <Route path="/user-management" element={<ProtectedLayout requiredRoles={["admin"]}><UserManagement /></ProtectedLayout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
