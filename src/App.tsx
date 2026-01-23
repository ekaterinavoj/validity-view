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
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ScheduledTrainings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <Layout>
                    <History />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/new-training"
              element={
                <ProtectedRoute>
                  <Layout>
                    <NewTraining />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-training/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <EditTraining />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/statistics"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Statistics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* Ostatní dropdown routes - accessible to all approved users */}
            <Route
              path="/employees"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Employees />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/training-types"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TrainingTypes />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/departments"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Departments />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inactive"
              element={
                <ProtectedRoute>
                  <Layout>
                    <InactiveEmployeesReport />
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* Audit log - admin and manager only */}
            <Route
              path="/audit-log"
              element={
                <ProtectedRoute requiredRoles={["admin", "manager"]}>
                  <Layout>
                    <AuditLog />
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* Profile - all approved users */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* Admin-only routes */}
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <Layout>
                    <AdminSettings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/status"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <Layout>
                    <SystemStatus />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/user-management"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <Layout>
                    <UserManagement />
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
