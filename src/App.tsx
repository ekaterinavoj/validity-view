import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./components/ThemeProvider";
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
import ChangePassword from "./pages/ChangePassword";
import AuditLog from "./pages/AuditLog";
import Profile from "./pages/Profile";
import AdminSettings from "./pages/AdminSettings";
import SystemStatus from "./pages/SystemStatus";
import UserManagement from "./pages/UserManagement";
import NotFound from "./pages/NotFound";
import NoAccess from "./pages/NoAccess";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ModuleRedirect } from "./components/ModuleRedirect";

// Deadline module pages
import ScheduledDeadlines from "./pages/ScheduledDeadlines";
import DeadlineHistory from "./pages/DeadlineHistory";
import NewDeadline from "./pages/NewDeadline";
import EditDeadline from "./pages/EditDeadline";
import Equipment from "./pages/Equipment";
import DeadlineTypes from "./pages/DeadlineTypes";
import ResponsibilityGroups from "./pages/ResponsibilityGroups";

// PLP module pages (Medical examinations)
import ScheduledExaminations from "./pages/ScheduledExaminations";
import NewMedicalExamination from "./pages/NewMedicalExamination";
import EditMedicalExamination from "./pages/EditMedicalExamination";
import MedicalExaminationTypes from "./pages/MedicalExaminationTypes";
import MedicalExaminationHistory from "./pages/MedicalExaminationHistory";

const queryClient = new QueryClient();

const ProtectedLayout = ({ 
  children, 
  requiredRoles,
  requiredModule 
}: { 
  children: React.ReactNode; 
  requiredRoles?: Array<"admin" | "manager" | "user">;
  requiredModule?: "trainings" | "deadlines" | "plp";
}) => (
  <ProtectedRoute requiredRoles={requiredRoles} requiredModule={requiredModule}>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        
        <BrowserRouter>
          <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            
            {/* ============ TRAININGS MODULE ============ */}
            <Route path="/" element={<ProtectedRoute><ModuleRedirect /></ProtectedRoute>} />
            <Route path="/trainings" element={<ProtectedLayout requiredModule="trainings"><ScheduledTrainings /></ProtectedLayout>} />
            <Route path="/trainings/scheduled" element={<ProtectedLayout requiredModule="trainings"><ScheduledTrainings /></ProtectedLayout>} />
            <Route path="/trainings/history" element={<ProtectedLayout requiredRoles={["admin", "manager"]} requiredModule="trainings"><History /></ProtectedLayout>} />
            <Route path="/trainings/new" element={<ProtectedLayout requiredModule="trainings"><NewTraining /></ProtectedLayout>} />
            <Route path="/trainings/edit/:id" element={<ProtectedLayout requiredModule="trainings"><EditTraining /></ProtectedLayout>} />
            {/* Legacy routes for backwards compatibility */}
            <Route path="/scheduled-trainings" element={<ProtectedLayout requiredModule="trainings"><ScheduledTrainings /></ProtectedLayout>} />
            <Route path="/history" element={<ProtectedLayout requiredRoles={["admin", "manager"]} requiredModule="trainings"><History /></ProtectedLayout>} />
            <Route path="/new-training" element={<ProtectedLayout requiredModule="trainings"><NewTraining /></ProtectedLayout>} />
            <Route path="/edit-training/:id" element={<ProtectedLayout requiredModule="trainings"><EditTraining /></ProtectedLayout>} />
            
            {/* ============ DEADLINES MODULE ============ */}
            <Route path="/deadlines" element={<ProtectedLayout requiredModule="deadlines"><ScheduledDeadlines /></ProtectedLayout>} />
            <Route path="/deadlines/scheduled" element={<ProtectedLayout requiredModule="deadlines"><ScheduledDeadlines /></ProtectedLayout>} />
            <Route path="/deadlines/history" element={<ProtectedLayout requiredRoles={["admin", "manager"]} requiredModule="deadlines"><DeadlineHistory /></ProtectedLayout>} />
            <Route path="/deadlines/new" element={<ProtectedLayout requiredModule="deadlines"><NewDeadline /></ProtectedLayout>} />
            <Route path="/deadlines/edit/:id" element={<ProtectedLayout requiredModule="deadlines"><EditDeadline /></ProtectedLayout>} />
            <Route path="/deadlines/equipment" element={<ProtectedLayout requiredModule="deadlines"><Equipment /></ProtectedLayout>} />
            <Route path="/deadlines/types" element={<ProtectedLayout requiredModule="deadlines"><DeadlineTypes /></ProtectedLayout>} />
            <Route path="/deadlines/groups" element={<ProtectedLayout requiredRoles={["admin", "manager"]} requiredModule="deadlines"><ResponsibilityGroups /></ProtectedLayout>} />
            
            
            {/* ============ PLP MODULE (Medical Examinations) ============ */}
            <Route path="/plp" element={<ProtectedLayout requiredModule="plp"><ScheduledExaminations /></ProtectedLayout>} />
            <Route path="/plp/scheduled" element={<ProtectedLayout requiredModule="plp"><ScheduledExaminations /></ProtectedLayout>} />
            <Route path="/plp/new" element={<ProtectedLayout requiredModule="plp"><NewMedicalExamination /></ProtectedLayout>} />
            <Route path="/plp/edit/:id" element={<ProtectedLayout requiredModule="plp"><EditMedicalExamination /></ProtectedLayout>} />
            <Route path="/plp/types" element={<ProtectedLayout requiredModule="plp"><MedicalExaminationTypes /></ProtectedLayout>} />
            <Route path="/plp/history" element={<ProtectedLayout requiredRoles={["admin", "manager"]} requiredModule="plp"><MedicalExaminationHistory /></ProtectedLayout>} />
            
            {/* ============ SHARED / SETTINGS ============ */}
            <Route path="/statistics" element={<ProtectedLayout requiredRoles={["admin", "manager"]}><Statistics /></ProtectedLayout>} />
            <Route path="/employees" element={<ProtectedLayout><Employees /></ProtectedLayout>} />
            <Route path="/training-types" element={<ProtectedLayout><TrainingTypes /></ProtectedLayout>} />
            <Route path="/departments" element={<ProtectedLayout><Departments /></ProtectedLayout>} />
            <Route path="/facilities" element={<ProtectedLayout><Facilities /></ProtectedLayout>} />
            <Route path="/inactive" element={<ProtectedLayout><InactiveEmployeesReport /></ProtectedLayout>} />
            
            {/* Audit log - admin only */}
            <Route path="/audit-log" element={<ProtectedLayout requiredRoles={["admin"]}><AuditLog /></ProtectedLayout>} />
            {/* Profile - all approved users */}
            <Route path="/profile" element={<ProtectedLayout><Profile /></ProtectedLayout>} />
            {/* Admin-only routes */}
            <Route path="/admin/settings" element={<ProtectedLayout requiredRoles={["admin"]}><AdminSettings /></ProtectedLayout>} />
            <Route path="/admin/status" element={<ProtectedLayout requiredRoles={["admin"]}><SystemStatus /></ProtectedLayout>} />
            <Route path="/user-management" element={<ProtectedLayout requiredRoles={["admin"]}><UserManagement /></ProtectedLayout>} />
            <Route path="/no-access" element={<ProtectedRoute><NoAccess /></ProtectedRoute>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
