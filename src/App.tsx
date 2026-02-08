import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
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
import AuditLog from "./pages/AuditLog";
import Profile from "./pages/Profile";
import AdminSettings from "./pages/AdminSettings";
import SystemStatus from "./pages/SystemStatus";
import UserManagement from "./pages/UserManagement";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Deadline module pages
import ScheduledDeadlines from "./pages/ScheduledDeadlines";
import DeadlineHistory from "./pages/DeadlineHistory";
import NewDeadline from "./pages/NewDeadline";
import EditDeadline from "./pages/EditDeadline";
import Equipment from "./pages/Equipment";
import DeadlineTypes from "./pages/DeadlineTypes";
import ResponsibilityGroups from "./pages/ResponsibilityGroups";

const queryClient = new QueryClient();

const ProtectedLayout = ({ children, requiredRoles }: { children: React.ReactNode; requiredRoles?: Array<"admin" | "manager" | "user"> }) => (
  <ProtectedRoute requiredRoles={requiredRoles}>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            
            {/* ============ TRAININGS MODULE ============ */}
            <Route path="/" element={<ProtectedLayout><ScheduledTrainings /></ProtectedLayout>} />
            <Route path="/trainings" element={<ProtectedLayout><ScheduledTrainings /></ProtectedLayout>} />
            <Route path="/trainings/scheduled" element={<ProtectedLayout><ScheduledTrainings /></ProtectedLayout>} />
            <Route path="/trainings/history" element={<ProtectedLayout><History /></ProtectedLayout>} />
            <Route path="/trainings/new" element={<ProtectedLayout><NewTraining /></ProtectedLayout>} />
            <Route path="/trainings/edit/:id" element={<ProtectedLayout><EditTraining /></ProtectedLayout>} />
            {/* Legacy routes for backwards compatibility */}
            <Route path="/scheduled-trainings" element={<ProtectedLayout><ScheduledTrainings /></ProtectedLayout>} />
            <Route path="/history" element={<ProtectedLayout><History /></ProtectedLayout>} />
            <Route path="/new-training" element={<ProtectedLayout><NewTraining /></ProtectedLayout>} />
            <Route path="/edit-training/:id" element={<ProtectedLayout><EditTraining /></ProtectedLayout>} />
            
            {/* ============ DEADLINES MODULE ============ */}
            <Route path="/deadlines" element={<ProtectedLayout><ScheduledDeadlines /></ProtectedLayout>} />
            <Route path="/deadlines/scheduled" element={<ProtectedLayout><ScheduledDeadlines /></ProtectedLayout>} />
            <Route path="/deadlines/history" element={<ProtectedLayout><DeadlineHistory /></ProtectedLayout>} />
            <Route path="/deadlines/new" element={<ProtectedLayout><NewDeadline /></ProtectedLayout>} />
            <Route path="/deadlines/edit/:id" element={<ProtectedLayout><EditDeadline /></ProtectedLayout>} />
            <Route path="/deadlines/equipment" element={<ProtectedLayout><Equipment /></ProtectedLayout>} />
            <Route path="/deadlines/types" element={<ProtectedLayout><DeadlineTypes /></ProtectedLayout>} />
            <Route path="/deadlines/groups" element={<ProtectedLayout requiredRoles={["admin", "manager"]}><ResponsibilityGroups /></ProtectedLayout>} />
            
            {/* ============ SHARED / SETTINGS ============ */}
            <Route path="/statistics" element={<ProtectedLayout><Statistics /></ProtectedLayout>} />
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
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
