import { useState, useMemo, useEffect, useRef } from "react";
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
  /** Filtr výsledku události (PLP/školení/lhůty). "all" = bez filtru. */
  resultFilter: string;
  /** Filtr pracovní kategorie zaměstnance (PLP). "all" = bez filtru. */
  workCategoryFilter: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
  /** Označený jako výchozí — automaticky se načte při otevření stránky. */
  isDefault?: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  searchQuery: "",
  statusFilter: "all",
  departmentFilter: "all",
  facilityFilter: "all",
  typeFilter: "all",
  trainerFilter: "all",
  responsibleFilter: "all",
  resultFilter: "all",
  workCategoryFilter: "all",
  dateFrom: undefined,
  dateTo: undefined,
};

const getUserStorageKey = (baseKey: string, userId: string | null) => {
  return userId ? `${baseKey}_${userId}` : `${baseKey}_anonymous`;
};

/**
 * Reconstruct date fields from JSON (strings → Date objects).
 */
const hydrateFilters = (raw: any): FilterState => ({
  ...DEFAULT_FILTERS,
  ...raw,
  dateFrom: raw?.dateFrom ? new Date(raw.dateFrom) : undefined,
  dateTo: raw?.dateTo ? new Date(raw.dateTo) : undefined,
});

export function useAdvancedFilters(storageKey: string = "training-filters") {
  const { toast } = useToast();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Get current user ID on mount and auth changes
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id ?? null);
    };

    getCurrentUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load saved filters + initial state on mount / user change.
  // Priority on first load: saved-default → last-used state → DEFAULT_FILTERS
  useEffect(() => {
    if (userId === null) return;

    try {
      const userKey = getUserStorageKey(`${storageKey}-saved`, userId);
      const lastStateKey = getUserStorageKey(`${storageKey}-last`, userId);

      const savedRaw = localStorage.getItem(userKey);
      const parsed: SavedFilter[] = savedRaw
        ? JSON.parse(savedRaw).map((filter: SavedFilter) => ({
            ...filter,
            filters: hydrateFilters(filter.filters),
          }))
        : [];
      setSavedFilters(parsed);

      // Only initialize filters once per user mount (avoid clobbering user input)
      if (!initializedRef.current) {
        const def = parsed.find((f) => f.isDefault);
        if (def) {
          setFilters(def.filters);
        } else {
          const lastRaw = localStorage.getItem(lastStateKey);
          if (lastRaw) {
            try {
              setFilters(hydrateFilters(JSON.parse(lastRaw)));
            } catch {
              /* ignore */
            }
          }
        }
        initializedRef.current = true;
      }
    } catch (error) {
      console.error("Error loading saved filters:", error);
    }
  }, [storageKey, userId]);

  // Persist saved filters list
  useEffect(() => {
    if (userId === null || !initializedRef.current) return;
    try {
      const userKey = getUserStorageKey(`${storageKey}-saved`, userId);
      localStorage.setItem(userKey, JSON.stringify(savedFilters));
    } catch (error) {
      console.error("Error saving filters:", error);
    }
  }, [savedFilters, storageKey, userId]);

  // Auto-persist last-used filter state (so it survives page reload)
  useEffect(() => {
    if (userId === null || !initializedRef.current) return;
    try {
      const lastStateKey = getUserStorageKey(`${storageKey}-last`, userId);
      localStorage.setItem(lastStateKey, JSON.stringify(filters));
    } catch (error) {
      console.error("Error persisting filter state:", error);
    }
  }, [filters, storageKey, userId]);

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
      filters.resultFilter !== "all" ||
      filters.workCategoryFilter !== "all" ||
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
      isDefault: false,
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

  /**
   * Toggle the "default" flag on a saved filter. Only one filter can be
   * default at a time per page; setting a new default unsets any previous one.
   */
  const setDefaultFilter = (filterId: string | null) => {
    setSavedFilters((prev) =>
      prev.map((f) => ({
        ...f,
        isDefault: filterId !== null && f.id === filterId ? !f.isDefault : false,
      })),
    );
    if (filterId) {
      const target = savedFilters.find((f) => f.id === filterId);
      if (target) {
        toast({
          title: target.isDefault ? "Výchozí filtr zrušen" : "Výchozí filtr nastaven",
          description: target.isDefault
            ? `"${target.name}" už není výchozí.`
            : `"${target.name}" se nyní automaticky načte při otevření stránky.`,
        });
      }
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
    setDefaultFilter,
    savedFilters,
  };
}
