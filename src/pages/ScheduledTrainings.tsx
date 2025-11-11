import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Training } from "@/types/training";
import { Edit, Trash2, Plus } from "lucide-react";

// Mock data
const mockTrainings: Training[] = [
  {
    id: "1",
    status: "valid",
    date: "2025-12-15",
    type: "BOZP - Základní",
    employeeNumber: "12345",
    employeeName: "Jan Novák",
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
    department: "Výroba",
    lastTrainingDate: "2024-12-15",
    trainer: "Petr Svoboda",
    company: "BOZP Servis s.r.o.",
    requester: "Marie Procházková",
    period: 365,
    reminderTemplate: "Standardní",
    calendar: "Ano",
    note: "Pravidelné školení",
  },
  {
    id: "2",
    status: "warning",
    date: "2025-01-20",
    type: "Práce ve výškách",
    employeeNumber: "12346",
    employeeName: "Petr Dvořák",
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
    department: "Údržba",
    lastTrainingDate: "2023-01-20",
    trainer: "Tomáš Černý",
    company: "Výškové práce s.r.o.",
    requester: "Marie Procházková",
    period: 730,
    reminderTemplate: "Urgentní",
    calendar: "Ano",
    note: "Prodloužená perioda",
  },
  {
    id: "3",
    status: "expired",
    date: "2024-11-01",
    type: "Řidičský průkaz VZV",
    employeeNumber: "12347",
    employeeName: "Jana Svobodová",
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
    department: "Logistika",
    lastTrainingDate: "2019-11-01",
    trainer: "Jiří Malý",
    company: "VZV Školení s.r.o.",
    requester: "Marie Procházková",
    period: 1825,
    reminderTemplate: "Standardní",
    calendar: "Ne",
    note: "Nutné obnovit",
  },
];

export default function ScheduledTrainings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">Naplánovaná školení</h2>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nové školení
        </Button>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stav</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Typ školení</TableHead>
                <TableHead>Osobní číslo</TableHead>
                <TableHead>Jméno</TableHead>
                <TableHead>Provozovna</TableHead>
                <TableHead>Středisko</TableHead>
                <TableHead>Poslední školení</TableHead>
                <TableHead>Školitel</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Zadavatel</TableHead>
                <TableHead>Perioda (dny)</TableHead>
                <TableHead>Poznámka</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTrainings.map((training) => (
                <TableRow key={training.id}>
                  <TableCell>
                    <StatusBadge status={training.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(training.date).toLocaleDateString("cs-CZ")}
                  </TableCell>
                  <TableCell className="font-medium">{training.type}</TableCell>
                  <TableCell>{training.employeeNumber}</TableCell>
                  <TableCell className="whitespace-nowrap">{training.employeeName}</TableCell>
                  <TableCell className="max-w-xs truncate" title={training.facility}>
                    {training.facility}
                  </TableCell>
                  <TableCell>{training.department}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(training.lastTrainingDate).toLocaleDateString("cs-CZ")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{training.trainer}</TableCell>
                  <TableCell className="whitespace-nowrap">{training.company}</TableCell>
                  <TableCell className="whitespace-nowrap">{training.requester}</TableCell>
                  <TableCell className="text-center">{training.period}</TableCell>
                  <TableCell className="max-w-xs truncate" title={training.note}>
                    {training.note}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-status-valid" />
          <span>Platné školení (v termínu)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-status-warning" />
          <span>Brzy vyprší (méně než měsíc)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-status-expired" />
          <span>Prošlé (po datu platnosti)</span>
        </div>
      </div>
    </div>
  );
}
