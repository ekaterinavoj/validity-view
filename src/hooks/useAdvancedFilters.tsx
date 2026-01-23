import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export interface FilterState {
  searchQuery: string;
  statusFilter: string;
  departmentFilter: string;
  facilityFilter: string;
  typeFilter: string;
  trainerFilter: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
}

const DEFAULT_FILTERS: FilterState = {
  searchQuery: "",
  statusFilter: "all",
  departmentFilter: "all",
  facilityFilter: "all",
  typeFilter: "all",
  trainerFilter: "all",
  dateFrom: undefined,
  dateTo: undefined,
};

export function useAdvancedFilters(storageKey: string = "training-filters") {
  const { toast } = useToast();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  // Load saved filters from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}-saved`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        const processed = parsed.map((filter: SavedFilter) => ({
          ...filter,
          filters: {
            ...filter.filters,
            dateFrom: filter.filters.dateFrom ? new Date(filter.filters.dateFrom) : undefined,
            dateTo: filter.filters.dateTo ? new Date(filter.filters.dateTo) : undefined,
          },
        }));
        setSavedFilters(processed);
      }
    } catch (error) {
      console.error("Error loading saved filters:", error);
    }
  }, [storageKey]);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}-saved`, JSON.stringify(savedFilters));
    } catch (error) {
      console.error("Error saving filters:", error);
    }
  }, [savedFilters, storageKey]);

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      filters.searchQuery !== "" ||
      filters.statusFilter !== "all" ||
      filters.departmentFilter !== "all" ||
      filters.facilityFilter !== "all" ||
      filters.typeFilter !== "all" ||
      filters.trainerFilter !== "all" ||
      filters.dateFrom !== undefined ||
      filters.dateTo !== undefined
    );
  }, [filters]);

  const saveCurrentFilters = (name: string) => {
    if (!name.trim()) {
      toast({
        title: "Chyba",
        description: "Zadejte název filtru",
        variant: "destructive",
      });
      return;
    }

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: name.trim(),
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };

    setSavedFilters((prev) => [...prev, newFilter]);
    toast({
      title: "Filtr uložen",
      description: `Filtr "${name}" byl úspěšně uložen`,
    });
  };

  const loadSavedFilter = (filterId: string) => {
    const saved = savedFilters.find((f) => f.id === filterId);
    if (saved) {
      setFilters(saved.filters);
      toast({
        title: "Filtr načten",
        description: `Filtr "${saved.name}" byl načten`,
      });
    }
  };

  const deleteSavedFilter = (filterId: string) => {
    const filter = savedFilters.find((f) => f.id === filterId);
    setSavedFilters((prev) => prev.filter((f) => f.id !== filterId));
    if (filter) {
      toast({
        title: "Filtr smazán",
        description: `Filtr "${filter.name}" byl smazán`,
      });
    }
  };

  return {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    saveCurrentFilters,
    loadSavedFilter,
    deleteSavedFilter,
    savedFilters,
  };
}
