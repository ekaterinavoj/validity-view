import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Badge } from "@/components/ui/badge";
import { Search, X, Save, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatDisplayDate } from "@/lib/dateFormat";
import { FilterState, SavedFilter } from "@/hooks/useAdvancedFilters";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ResponsiblePerson {
  id: string;
  name: string;
}

interface AdvancedFiltersProps {
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClearFilters: () => void;
  onSaveFilters: (name: string) => void;
  onLoadFilter: (filterId: string) => void;
  onDeleteFilter: (filterId: string) => void;
  /** Toggle a saved filter as the user's default (auto-loaded on page open). */
  onSetDefaultFilter?: (filterId: string | null) => void;
  savedFilters: SavedFilter[];
  hasActiveFilters: boolean;
  departments: string[];
  facilities: string[];
  trainingTypes: string[];
  trainers: string[];
  responsiblePersons?: ResponsiblePerson[];
  resultCount?: number;
  totalCount?: number;
  /** Label for trainers/doctors/performers filter - defaults to "školitelé" */
  trainerLabel?: "trainers" | "doctors" | "performers";
  /** Pokud zadáno, zobrazí filtr výsledku ({ value, label }[]) */
  resultOptions?: { value: string; label: string }[];
  /** Pokud zadáno, zobrazí filtr pracovní kategorie zaměstnance */
  workCategoryOptions?: { value: string; label: string }[];
}

export function AdvancedFilters({
  filters,
  onFilterChange,
  onClearFilters,
  onSaveFilters,
  onLoadFilter,
  onDeleteFilter,
  onSetDefaultFilter,
  savedFilters,
  hasActiveFilters,
  departments,
  facilities,
  trainingTypes,
  trainers,
  responsiblePersons,
  resultCount,
  totalCount,
  trainerLabel = "trainers",
  resultOptions,
  workCategoryOptions,
}: AdvancedFiltersProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState("");

  const handleSaveFilter = () => {
    onSaveFilters(filterName);
    setFilterName("");
    setSaveDialogOpen(false);
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-4 border-b border-border">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Star className="w-4 h-4" />
              Oblíbené filtry:
            </span>
            <TooltipProvider>
              {savedFilters.map((saved) => (
                <Badge
                  key={saved.id}
                  variant={saved.isDefault ? "default" : "secondary"}
                  className="cursor-pointer hover:bg-accent group flex items-center gap-1"
                >
                  <span onClick={() => onLoadFilter(saved.id)}>
                    {saved.isDefault && "★ "}
                    {saved.name}
                  </span>
                  {onSetDefaultFilter && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetDefaultFilter(saved.id);
                          }}
                          className="ml-1 hover:text-primary"
                          aria-label={saved.isDefault ? "Zrušit jako výchozí" : "Nastavit jako výchozí"}
                        >
                          <Star className={`w-3 h-3 ${saved.isDefault ? "fill-current" : ""}`} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {saved.isDefault
                          ? "Zrušit jako výchozí filtr"
                          : "Nastavit jako výchozí (automaticky se načte)"}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFilter(saved.id);
                        }}
                        className="ml-1 hover:text-destructive"
                        aria-label="Smazat filtr"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Smazat filtr</TooltipContent>
                  </Tooltip>
                </Badge>
              ))}
            </TooltipProvider>
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {/* Search */}
          <div className="lg:col-span-2 xl:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Hledat podle jména, osobního čísla..."
                value={filters.searchQuery}
                onChange={(e) => onFilterChange("searchQuery", e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Status Filter */}
          <Select
            value={filters.statusFilter}
            onValueChange={(value) => onFilterChange("statusFilter", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Stav" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny stavy</SelectItem>
              <SelectItem value="valid">Platné</SelectItem>
              <SelectItem value="warning">Brzy vyprší</SelectItem>
              <SelectItem value="expired">Prošlé</SelectItem>
            </SelectContent>
          </Select>

          {/* Facility Filter */}
          <Select
            value={filters.facilityFilter}
            onValueChange={(value) => onFilterChange("facilityFilter", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Provozovna" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny provozovny</SelectItem>
              {facilities.map((facility) => (
                <SelectItem key={facility} value={facility}>
                  {facility}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Department Filter */}
          <Select
            value={filters.departmentFilter}
            onValueChange={(value) => onFilterChange("departmentFilter", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Středisko" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechna střediska</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Training Type Filter */}
          <Select
            value={filters.typeFilter}
            onValueChange={(value) => onFilterChange("typeFilter", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Typ školení" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny typy</SelectItem>
              {trainingTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Trainer/Doctor Filter */}
          <Select
            value={filters.trainerFilter}
            onValueChange={(value) => onFilterChange("trainerFilter", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={trainerLabel === "doctors" ? "Lékař" : trainerLabel === "performers" ? "Kontrolor" : "Školitel"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{trainerLabel === "doctors" ? "Všichni lékaři" : trainerLabel === "performers" ? "Všichni kontroloři" : "Všichni školitelé"}</SelectItem>
              {trainers.map((trainer) => (
                <SelectItem key={trainer} value={trainer}>
                  {trainer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Responsible Person Filter - only show when responsiblePersons are provided */}
          {responsiblePersons && responsiblePersons.length > 0 && (
            <Select
              value={filters.responsibleFilter}
              onValueChange={(value) => onFilterChange("responsibleFilter", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Odpovědná osoba" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny odpovědné osoby</SelectItem>
                {responsiblePersons.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Result Filter (volitelně, např. pro PLP) */}
          {resultOptions && resultOptions.length > 0 && (
            <Select
              value={filters.resultFilter}
              onValueChange={(value) => onFilterChange("resultFilter", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Výsledek" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny výsledky</SelectItem>
                {resultOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Work Category Filter (volitelně, např. pro PLP) */}
          {workCategoryOptions && workCategoryOptions.length > 0 && (
            <Select
              value={filters.workCategoryFilter}
              onValueChange={(value) => onFilterChange("workCategoryFilter", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kategorie práce" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny kategorie</SelectItem>
                {workCategoryOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Date Range */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Datum od:
            </label>
            <DateInput
              value={filters.dateFrom}
              onChange={(date) => onFilterChange("dateFrom", date)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Datum do:
            </label>
            <DateInput
              value={filters.dateTo}
              onChange={(date) => onFilterChange("dateTo", date)}
            />
          </div>
        </div>

        {/* Actions */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-4">
              {resultCount !== undefined && totalCount !== undefined && (
                <p className="text-sm text-muted-foreground">
                  Zobrazeno {resultCount} z {totalCount} záznamů
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Save className="w-4 h-4 mr-2" />
                    Uložit filtr
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Uložit filtr</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Input
                      placeholder="Název filtru..."
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveFilter();
                        }
                      }}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                      Zrušit
                    </Button>
                    <Button onClick={handleSaveFilter}>Uložit</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="sm" onClick={onClearFilters}>
                <X className="w-4 h-4 mr-2" />
                Vymazat filtry
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
