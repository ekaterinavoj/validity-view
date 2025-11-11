import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ScheduledTrainings from "./pages/ScheduledTrainings";
import History from "./pages/History";
import NewTraining from "./pages/NewTraining";
import EditTraining from "./pages/EditTraining";
import Settings from "./pages/Settings";
import Other from "./pages/Other";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scheduled-trainings" element={<ScheduledTrainings />} />
            <Route path="/history" element={<History />} />
            <Route path="/new-training" element={<NewTraining />} />
            <Route path="/edit-training/:id" element={<EditTraining />} />
            <Route path="/other" element={<Other />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
