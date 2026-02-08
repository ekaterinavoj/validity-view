import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface FilterState {
  searchQuery: string;
  statusFilter: string;
  departmentFilter: string;
  facilityFilter: string;
  typeFilter: string;
  trainerFilter: string;
  responsibleFilter: string;
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
  responsibleFilter: "all",
  dateFrom: undefined,
  dateTo: undefined,
};

const getUserStorageKey = (baseKey: string, userId: string | null) => {
  return userId ? `${baseKey}_${userId}` : `${baseKey}_anonymous`;
};

export function useAdvancedFilters(storageKey: string = "training-filters") {
  const { toast } = useToast();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user ID on mount and auth changes
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id ?? null);
    };

    getCurrentUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load saved filters from localStorage (user-specific)
  useEffect(() => {
    if (userId === null) return; // Wait for auth to initialize
    
    try {
      const userKey = getUserStorageKey(`${storageKey}-saved`, userId);
      const saved = localStorage.getItem(userKey);
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
      } else {
        setSavedFilters([]);
      }
    } catch (error) {
      console.error("Error loading saved filters:", error);
    }
  }, [storageKey, userId]);

  // Save filters to localStorage whenever they change (user-specific)
  useEffect(() => {
    if (userId === null) return; // Wait for auth to initialize
    
    try {
      const userKey = getUserStorageKey(`${storageKey}-saved`, userId);
      localStorage.setItem(userKey, JSON.stringify(savedFilters));
    } catch (error) {
      console.error("Error saving filters:", error);
    }
  }, [savedFilters, storageKey, userId]);

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
      filters.responsibleFilter !== "all" ||
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
