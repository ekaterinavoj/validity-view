import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Stethoscope,
  Wrench,
  ArrowRight,
  Settings2,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";
import { useUserPreferences, type DashboardQuickLink } from "@/hooks/useUserPreferences";
import { QuickLinksManagerDialog } from "@/components/QuickLinksManagerDialog";

interface ModuleStats {
  expired: number;
  today: number;
  upcoming30: number;
  total: number;
}

const EMPTY: ModuleStats = { expired: 0, today: 0, upcoming30: 0, total: 0 };

function classify(rows: { date: string | null }[]): ModuleStats {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  let expired = 0;
  let todayCount = 0;
  let upcoming30 = 0;
  for (const r of rows) {
    if (!r.date) continue;
    const d = new Date(r.date);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() < today.getTime()) expired++;
    else if (d.getTime() === today.getTime()) todayCount++;
    else if (d.getTime() <= in30.getTime()) upcoming30++;
  }
  return { expired, today: todayCount, upcoming30, total: rows.length };
}

export default function Dashboard() {
  const {
    loading,
    rolesLoaded,
    moduleAccessLoaded,
    hasModuleAccess,
    isAdmin,
    profile,
  } = useAuth();
  const [trainings, setTrainings] = useState<ModuleStats>(EMPTY);
  const [deadlines, setDeadlines] = useState<ModuleStats>(EMPTY);
  const [plp, setPlp] = useState<ModuleStats>(EMPTY);
  const [statsLoading, setStatsLoading] = useState(true);
  const [quickLinksDialogOpen, setQuickLinksDialogOpen] = useState(false);
  const { preferences, updatePreference, isLoaded: prefsLoaded } = useUserPreferences();

  const canT = hasModuleAccess("trainings");
  const canD = hasModuleAccess("deadlines");
  const canP = hasModuleAccess("plp");

  // Výchozí systémové odkazy – závisí na rolích/oprávněních.
  // Pokud uživatel nemá vlastní (preference je prázdné pole), použijí se tyto.
  const defaultQuickLinks = useMemo<DashboardQuickLink[]>(() => {
    const items: DashboardQuickLink[] = [];
    if (canT) items.push({ id: "sys-new-training", label: "+ Nové školení", path: "/trainings/new" });
    if (canD) items.push({ id: "sys-new-deadline", label: "+ Nová tech. událost", path: "/deadlines/new" });
    if (canP && isAdmin) items.push({ id: "sys-new-plp", label: "+ Nová PLP", path: "/plp/new" });
    items.push({ id: "sys-documents", label: "Dokumenty", path: "/documents" });
    items.push({ id: "sys-guides", label: "Návody", path: "/guides" });
    items.push({ id: "sys-permissions", label: "Moje oprávnění", path: "/profile?tab=permissions" });
    return items;
  }, [canT, canD, canP, isAdmin]);

  // Pokud uživatel nikdy neupravoval, použij výchozí. Jinak jeho vlastní.
  const effectiveQuickLinks =
    prefsLoaded && preferences.dashboardQuickLinks.length > 0
      ? preferences.dashboardQuickLinks
      : defaultQuickLinks;

  const isExternal = (path: string) => /^https?:\/\//i.test(path);

  useEffect(() => {
    if (loading || !rolesLoaded || !moduleAccessLoaded) return;
    let mounted = true;
    (async () => {
      setStatsLoading(true);
      try {
        const [tRes, dRes, pRes] = await Promise.all([
          canT
            ? supabase.from("trainings").select("next_training_date").is("deleted_at", null)
            : Promise.resolve({ data: [] as any[] }),
          canD
            ? supabase.from("deadlines").select("next_check_date").is("deleted_at", null)
            : Promise.resolve({ data: [] as any[] }),
          canP
            ? supabase
                .from("medical_examinations")
                .select("next_examination_date")
                .is("deleted_at", null)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        if (!mounted) return;
        setTrainings(
          classify(((tRes as any).data ?? []).map((r: any) => ({ date: r.next_training_date })))
        );
        setDeadlines(
          classify(((dRes as any).data ?? []).map((r: any) => ({ date: r.next_check_date })))
        );
        setPlp(
          classify(
            ((pRes as any).data ?? []).map((r: any) => ({ date: r.next_examination_date }))
          )
        );
      } catch (e) {
        console.error("Dashboard load error", e);
      } finally {
        if (mounted) setStatsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loading, rolesLoaded, moduleAccessLoaded, canT, canD, canP]);

  if (loading || !rolesLoaded || !moduleAccessLoaded) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No module access at all → redirect to no-access page
  if (!canT && !canD && !canP && !isAdmin) {
    return <Navigate to="/no-access" replace />;
  }

  const accessibleCount = [canT, canD, canP].filter(Boolean).length;
  const gridCols =
    accessibleCount === 1 ? "grid-cols-1" : accessibleCount === 2 ? "md:grid-cols-2" : "md:grid-cols-3";

  const ModuleCard = ({
    title,
    icon: Icon,
    stats,
    listPath,
    historyPath,
    color,
    accent,
  }: {
    title: string;
    icon: any;
    stats: ModuleStats;
    listPath: string;
    historyPath?: string;
    color: string;
    accent: string;
  }) => (
    <Card className="overflow-hidden">
      <CardHeader className={`${accent} pb-3`}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className={`w-5 h-5 ${color}`} />
            {title}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {stats.total} aktivních
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Link
            to={listPath}
            className="flex flex-col items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors p-3"
          >
            <span className="text-2xl font-bold text-destructive">{stats.expired}</span>
            <span className="text-[11px] text-muted-foreground text-center mt-1">Prošlé</span>
          </Link>
          <Link
            to={listPath}
            className="flex flex-col items-center justify-center rounded-md border border-warning/30 bg-warning/5 hover:bg-warning/10 transition-colors p-3"
          >
            <span className="text-2xl font-bold text-warning">{stats.today}</span>
            <span className="text-[11px] text-muted-foreground text-center mt-1">Dnes</span>
          </Link>
          <Link
            to={listPath}
            className="flex flex-col items-center justify-center rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors p-3"
          >
            <span className="text-2xl font-bold text-primary">{stats.upcoming30}</span>
            <span className="text-[11px] text-muted-foreground text-center mt-1">Do 30 dnů</span>
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="default" className="flex-1 min-w-[120px]">
            <Link to={listPath}>
              Otevřít přehled
              <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </Button>
          {historyPath && (
            <Button asChild size="sm" variant="outline">
              <Link to={historyPath}>Historie</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return "Dobré ráno";
    if (h < 17) return "Dobrý den";
    return "Dobrý večer";
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {greeting}
          {profile?.first_name ? `, ${profile.first_name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          Souhrnný přehled vašich aktivních modulů ke dni{" "}
          {new Date().toLocaleDateString("cs-CZ")}.
        </p>
      </div>

      {statsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
            {canT && (
              <ModuleCard
                title="Školení"
                icon={GraduationCap}
                stats={trainings}
                listPath="/trainings"
                historyPath={isAdmin ? "/trainings/history" : undefined}
                color="text-primary"
                accent="bg-primary/5"
              />
            )}
            {canD && (
              <ModuleCard
                title="Technické události"
                icon={Wrench}
                stats={deadlines}
                listPath="/deadlines"
                historyPath={isAdmin ? "/deadlines/history" : undefined}
                color="text-primary"
                accent="bg-primary/5"
              />
            )}
            {canP && (
              <ModuleCard
                title="PLP"
                icon={Stethoscope}
                stats={plp}
                listPath="/plp"
                historyPath={isAdmin ? "/plp/history" : undefined}
                color="text-primary"
                accent="bg-primary/5"
              />
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="w-4 h-4 text-primary" />
                Rychlé odkazy
              </CardTitle>
              <CardDescription>Nejčastěji používané akce a sekce.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {canT && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/trainings/new">+ Nové školení</Link>
                  </Button>
                )}
                {canD && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/deadlines/new">+ Nová tech. událost</Link>
                  </Button>
                )}
                {canP && isAdmin && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/plp/new">+ Nová PLP</Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link to="/documents">Dokumenty</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/guides">Návody</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/profile?tab=permissions">Moje oprávnění</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {trainings.expired + deadlines.expired + plp.expired === 0 && (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="flex items-center gap-3 py-4">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <p className="text-sm">
                  Žádné prošlé záznamy ve vašich modulech – vše je v pořádku.
                </p>
              </CardContent>
            </Card>
          )}

          {trainings.expired + deadlines.expired + plp.expired > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                <p className="text-sm">
                  Máte celkem{" "}
                  <strong>
                    {trainings.expired + deadlines.expired + plp.expired}
                  </strong>{" "}
                  prošlých záznamů. Doporučujeme je zkontrolovat co nejdříve.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
