import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserX, Users, Upload, Building2, BookOpen } from "lucide-react";
import InactiveEmployeesReport from "./InactiveEmployeesReport";
import Employees from "./Employees";
import BulkImportPage from "./BulkImportPage";
import Departments from "./Departments";
import TrainingTypes from "./TrainingTypes";

export default function Other() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-foreground">Ostatní</h2>
      
      <Tabs defaultValue="inactive" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="inactive" className="flex items-center gap-2">
            <UserX className="w-4 h-4" />
            Pozastavená školení
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Školené osoby
          </TabsTrigger>
          <TabsTrigger value="bulk-import" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Hromadný import
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Střediska
          </TabsTrigger>
          <TabsTrigger value="training-types" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Typy školení
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inactive" className="space-y-6">
          <InactiveEmployeesReport />
        </TabsContent>

        <TabsContent value="employees" className="space-y-6">
          <Employees />
        </TabsContent>

        <TabsContent value="bulk-import" className="space-y-6">
          <BulkImportPage />
        </TabsContent>

        <TabsContent value="departments" className="space-y-6">
          <Departments />
        </TabsContent>

        <TabsContent value="training-types" className="space-y-6">
          <TrainingTypes />
        </TabsContent>
      </Tabs>
    </div>
  );
}
