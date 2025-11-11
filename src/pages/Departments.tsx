import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  facility: z.string().min(1, "Vyberte provozovnu"),
  code: z.string().min(1, "Zadejte číslo střediska"),
});

type FormValues = z.infer<typeof formSchema>;

const mockDepartments = [
  { id: "1", facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3", code: "2002000001" },
  { id: "2", facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3", code: "2002000002" },
  { id: "3", facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3", code: "2002000003" },
  { id: "4", facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3", code: "2002100001" },
  { id: "5", facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3", code: "2002100002" },
];

export default function Departments() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = (data: FormValues) => {
    console.log(data);
    toast({
      title: "Středisko vytvořeno",
      description: "Nové středisko bylo úspěšně přidáno.",
    });
    setDialogOpen(false);
    form.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">Editovat střediska</h2>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Přidat nové
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nové středisko</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="facility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provozovna *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Vyberte provozovnu" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="qlar-jenec-dc3">
                            Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Číslo střediska *</FormLabel>
                      <FormControl>
                        <Input placeholder="např. 2002000001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4 pt-4">
                  <Button type="submit">Uložit</Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Zrušit
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provozovna</TableHead>
              <TableHead>Název</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockDepartments.map((dept) => (
              <TableRow key={dept.id}>
                <TableCell className="text-sm">{dept.facility}</TableCell>
                <TableCell className="font-medium">{dept.code}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
