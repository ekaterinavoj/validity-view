import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserX, Users, Building2, BookOpen } from "lucide-react";
import InactiveEmployeesReport from "./InactiveEmployeesReport";
import Employees from "./Employees";
import Departments from "./Departments";
import TrainingTypes from "./TrainingTypes";

export default function Other() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-foreground">Ostatní</h2>
      
      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 text-xs">
          <TabsTrigger value="employees">Školené osoby</TabsTrigger>
          <TabsTrigger value="training-types">Typy školení</TabsTrigger>
          <TabsTrigger value="departments">Střediska</TabsTrigger>
          <TabsTrigger value="inactive">Pozastavená</TabsTrigger>
        </TabsList>

        <TabsContent value="inactive"><InactiveEmployeesReport /></TabsContent>
        <TabsContent value="employees"><Employees /></TabsContent>
        <TabsContent value="departments"><Departments /></TabsContent>
        <TabsContent value="training-types"><TrainingTypes /></TabsContent>
      </Tabs>
    </div>
  );
}
