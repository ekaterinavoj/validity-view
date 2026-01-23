import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Edit, Plus, Trash2, Loader2, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  name: z.string().min(1, "Zadejte název provozovny"),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

// Generate a simple code from name (lowercase, no diacritics, hyphens)
const generateCodeFromName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
};

type FormValues = z.infer<typeof formSchema>;

interface Facility {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function Facilities() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [facilityToDelete, setFacilityToDelete] = useState<Facility | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      is_active: true,
    },
  });

  const loadFacilities = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("facilities")
        .select("*")
        .order("name");

      if (error) throw error;
      setFacilities(data || []);
    } catch (error) {
      console.error("Chyba při načítání provozoven:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst provozovny.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFacilities();
  }, []);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const facilityData = {
        code: generateCodeFromName(data.name),
        name: data.name,
        description: data.description || null,
        is_active: data.is_active,
      };

      if (editingFacility) {
        const { error } = await supabase
          .from("facilities")
          .update(facilityData)
          .eq("id", editingFacility.id);

        if (error) throw error;

        toast({
          title: "Provozovna aktualizována",
          description: "Provozovna byla úspěšně upravena.",
        });
      } else {
        const { error } = await supabase
          .from("facilities")
          .insert([facilityData]);

        if (error) throw error;

        toast({
          title: "Provozovna vytvořena",
          description: "Nová provozovna byla úspěšně přidána.",
        });
      }

      setDialogOpen(false);
      setEditingFacility(null);
      form.reset();
      loadFacilities();
    } catch (error: any) {
      console.error("Chyba při ukládání provozovny:", error);
      toast({
        title: "Chyba",
        description: error.message?.includes("duplicate") 
          ? "Provozovna s tímto kódem již existuje."
          : "Nepodařilo se uložit provozovnu.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (facility: Facility) => {
    setEditingFacility(facility);
    form.reset({
      name: facility.name,
      description: facility.description || "",
      is_active: facility.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!facilityToDelete) return;

    try {
      const { error } = await supabase
        .from("facilities")
        .delete()
        .eq("id", facilityToDelete.id);

      if (error) throw error;

      toast({
        title: "Provozovna smazána",
        description: "Provozovna byla úspěšně odstraněna.",
      });

      loadFacilities();
    } catch (error) {
      console.error("Chyba při mazání provozovny:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat provozovnu.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setFacilityToDelete(null);
    }
  };

  const openDeleteDialog = (facility: Facility) => {
    setFacilityToDelete(facility);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingFacility(null);
      form.reset();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold text-foreground">Provozovny</h2>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Přidat provozovnu
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFacility ? "Upravit provozovnu" : "Nová provozovna"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Název provozovny *</FormLabel>
                      <FormControl>
                        <Input placeholder="např. Qlar Czech s.r.o. - závod Jeneč" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Popis</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Volitelný popis provozovny..."
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Aktivní</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Neaktivní provozovny se nezobrazují při výběru
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex gap-4 pt-4">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isSubmitting ? "Ukládá se..." : "Uložit"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => handleDialogClose(false)}
                    disabled={isSubmitting}
                  >
                    Zrušit
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Žádné provozovny nenalezeny. Přidejte novou provozovnu.
                  </TableCell>
                </TableRow>
              ) : (
                facilities.map((facility) => (
                  <TableRow key={facility.id}>
                    <TableCell className="font-medium">{facility.name}</TableCell>
                    <TableCell className="max-w-xs truncate" title={facility.description || ""}>
                      {facility.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={facility.is_active ? "default" : "secondary"}>
                        {facility.is_active ? "Aktivní" : "Neaktivní"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(facility)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openDeleteDialog(facility)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opravdu chcete smazat tuto provozovnu?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná. Provozovna "{facilityToDelete?.name}" bude trvale odstraněna z databáze.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
