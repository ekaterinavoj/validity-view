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
  name: z.string().min(1, "Zadejte název typu školení"),
  periodValue: z.string().min(1, "Zadejte periodicitu"),
  periodUnit: z.enum(["days", "months", "years"]),
});

type FormValues = z.infer<typeof formSchema>;

const mockTrainingTypes = [
  { id: "1", facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3", name: "ATEX" },
  { id: "2", facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3", name: "ATEX webinář ENG, GE" },
  { id: "3", facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3", name: "Auditor kvality" },
  { id: "4", facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3", name: "Compliance training" },
  { id: "5", facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3", name: "HSE - REA/RR" },
];

export default function TrainingTypes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      periodValue: "2",
      periodUnit: "years",
    },
  });

  const onSubmit = (data: FormValues) => {
    console.log(data);
    toast({
      title: "Typ školení vytvořen",
      description: "Nový typ školení byl úspěšně přidán.",
    });
    setDialogOpen(false);
    form.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">Typy školení</h2>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Přidat nový typ
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nový typ školení</DialogTitle>
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Název typu události *</FormLabel>
                      <FormControl>
                        <Input placeholder="např. ATEX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Periodicita *</FormLabel>
                  <div className="flex gap-2 items-center">
                    <FormField
                      control={form.control}
                      name="periodValue"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="periodUnit"
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="days">Dní</SelectItem>
                              <SelectItem value="months">Měsíců</SelectItem>
                              <SelectItem value="years">Roků</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

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
            {mockTrainingTypes.map((type) => (
              <TableRow key={type.id}>
                <TableCell className="text-sm">{type.facility}</TableCell>
                <TableCell className="font-medium">{type.name}</TableCell>
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
