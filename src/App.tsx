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
              path="/statistics"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Statistics />
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
            {/* Ostatní dropdown routes */}
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
            {/* Secondary navigation */}
            <Route
              path="/audit-log"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AuditLog />
                  </Layout>
                </ProtectedRoute>
              }
            />
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
            {/* Admin routes */}
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AdminSettings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/status"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SystemStatus />
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
