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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Search, X, Calendar as CalendarIcon, Save, Star, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useState } from "react";
import { FilterState, SavedFilter } from "@/hooks/useAdvancedFilters";

interface AdvancedFiltersProps {
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClearFilters: () => void;
  onSaveFilters: (name: string) => void;
  onLoadFilter: (filterId: string) => void;
  onDeleteFilter: (filterId: string) => void;
  savedFilters: SavedFilter[];
  hasActiveFilters: boolean;
  departments: string[];
  trainingTypes: string[];
  trainers: string[];
  resultCount?: number;
  totalCount?: number;
}

export function AdvancedFilters({
  filters,
  onFilterChange,
  onClearFilters,
  onSaveFilters,
  onLoadFilter,
  onDeleteFilter,
  savedFilters,
  hasActiveFilters,
  departments,
  trainingTypes,
  trainers,
  resultCount,
  totalCount,
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
            {savedFilters.map((saved) => (
              <Badge
                key={saved.id}
                variant="secondary"
                className="cursor-pointer hover:bg-accent group flex items-center gap-1"
              >
                <span onClick={() => onLoadFilter(saved.id)}>{saved.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFilter(saved.id);
                  }}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {/* Search */}
          <div className="lg:col-span-2">
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

          {/* Trainer Filter */}
          <Select
            value={filters.trainerFilter}
            onValueChange={(value) => onFilterChange("trainerFilter", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Školitel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všichni školitelé</SelectItem>
              {trainers.map((trainer) => (
                <SelectItem key={trainer} value={trainer}>
                  {trainer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Datum od:
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? (
                    format(filters.dateFrom, "dd.MM.yyyy", { locale: cs })
                  ) : (
                    <span>Vyberte datum</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => onFilterChange("dateFrom", date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Datum do:
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? (
                    format(filters.dateTo, "dd.MM.yyyy", { locale: cs })
                  ) : (
                    <span>Vyberte datum</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => onFilterChange("dateTo", date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
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
