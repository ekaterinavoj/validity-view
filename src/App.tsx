import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import ScheduledTrainings from "./pages/ScheduledTrainings";
import History from "./pages/History";
import Employees from "./pages/Employees";
import NewTraining from "./pages/NewTraining";
import TrainingTypes from "./pages/TrainingTypes";
import Departments from "./pages/Departments";
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
            <Route path="/" element={<ScheduledTrainings />} />
            <Route path="/history" element={<History />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/new-training" element={<NewTraining />} />
            <Route path="/training-types" element={<TrainingTypes />} />
            <Route path="/departments" element={<Departments />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
