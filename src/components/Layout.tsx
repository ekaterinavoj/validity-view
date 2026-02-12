import { useState, useEffect } from "react";
import companyLogo from "@/assets/company-logo.jpg";
import { NavLink } from "./NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Calendar, History, PlusCircle, BarChart3, ChevronDown, LogOut, User, FileText, Activity, Users, BookOpen, Building2, UserX, Settings, Bell, Mail, UserCheck, Database, Menu, X, GraduationCap, Wrench, Clock, Cog, UsersRound, Stethoscope } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";
import { getModuleFromPath } from "@/lib/routeModuleMap";

interface LayoutProps {
  children: React.ReactNode;
}
export const Layout = ({
  children
}: LayoutProps) => {
  const {
    profile,
    roles,
    isAdmin,
    isManager,
    hasModuleAccess,
    signOut
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check module access
  const canAccessTrainings = hasModuleAccess("trainings");
  const canAccessDeadlines = hasModuleAccess("deadlines");
  const canAccessPlp = hasModuleAccess("plp");

  // Determine current module from URL (null = global page)
  const currentModule = getModuleFromPath(location.pathname);
  const isDeadlineRoute = currentModule === "deadlines";
  const isPlpRoute = currentModule === "plp";
  const isTrainingRoute = currentModule === "trainings";
  const isGlobalPage = currentModule === null;

  // Get last selected module from localStorage, default to first accessible module
  const [lastSelectedModule, setLastSelectedModule] = useState<"trainings" | "deadlines" | "plp">(() => {
    const saved = localStorage.getItem("last-selected-module");
    // Return saved if user has access to it
    if (saved === "deadlines" && canAccessDeadlines) return "deadlines";
    if (saved === "plp" && canAccessPlp) return "plp";
    if (saved === "trainings" && canAccessTrainings) return "trainings";
    // Fallback to first accessible module
    if (canAccessTrainings) return "trainings";
    if (canAccessDeadlines) return "deadlines";
    if (canAccessPlp) return "plp";
    return "trainings";
  });

  // Update last selected module when navigating to module-specific routes
  useEffect(() => {
    if (isDeadlineRoute) {
      localStorage.setItem("last-selected-module", "deadlines");
      setLastSelectedModule("deadlines");
    } else if (isPlpRoute) {
      localStorage.setItem("last-selected-module", "plp");
      setLastSelectedModule("plp");
    } else if (isTrainingRoute) {
      localStorage.setItem("last-selected-module", "trainings");
      setLastSelectedModule("trainings");
    }
  }, [isDeadlineRoute, isTrainingRoute, isPlpRoute]);

  // For mode switcher display - use last selected module on global pages
  const isDeadlineMode = isGlobalPage ? lastSelectedModule === "deadlines" : isDeadlineRoute;
  const isPlpMode = isGlobalPage ? lastSelectedModule === "plp" : isPlpRoute;
  const isTrainingMode = !isDeadlineMode && !isPlpMode;
  const getRoleBadge = () => {
    if (roles.includes("admin")) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-role-admin/20 text-role-admin-foreground dark:text-role-admin">Admin</span>;
    }
    if (roles.includes("manager")) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-role-manager/20 text-role-manager-foreground dark:text-role-manager">Manažer</span>;
    }
    return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-role-user/20 text-role-user-foreground dark:text-role-user">Uživatel</span>;
  };

  // Training mode "Ostatní" dropdown active state (employees moved to global)
  const isTrainingOstatniActive = ["/training-types", "/departments", "/inactive"].some(path => location.pathname === path);

  // Deadline mode "Ostatní" dropdown active state (facilities removed - now global)
  const isDeadlineOstatniActive = ["/deadlines/equipment", "/deadlines/types", "/deadlines/groups"].some(path => location.pathname === path);

  // System/Data dropdown active state (includes facilities and employees)
  const isSystemDataActive = location.pathname === "/facilities" || location.pathname === "/employees";
  const closeMobileMenu = () => setMobileMenuOpen(false);

  // Always navigate when clicking a module tab (even if already active)
  const handleModeSwitch = (value: string) => {
    if (value === "trainings" && canAccessTrainings) {
      navigate("/trainings");
    } else if (value === "deadlines" && canAccessDeadlines) {
      navigate("/deadlines");
    } else if (value === "plp" && canAccessPlp) {
      navigate("/plp");
    }
  };

  // Count accessible modules for grid layout
  const accessibleModulesCount = [canAccessTrainings, canAccessDeadlines, canAccessPlp].filter(Boolean).length;
  return <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={companyLogo} alt="Engel Gematex" className="h-14 w-auto" />
              
              {/* Mode Switcher Tabs - Only show accessible modules */}
              {accessibleModulesCount > 0 && (
                <Tabs value={isPlpMode ? "plp" : isDeadlineMode ? "deadlines" : "trainings"} onValueChange={handleModeSwitch}>
                  <TabsList className={cn(
                    "grid",
                    accessibleModulesCount === 1 && "w-[140px] grid-cols-1",
                    accessibleModulesCount === 2 && "w-[280px] grid-cols-2",
                    accessibleModulesCount === 3 && "w-[380px] grid-cols-3"
                  )}>
                    {canAccessTrainings && (
                      <TabsTrigger value="trainings" className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" />
                        Školení
                      </TabsTrigger>
                    )}
                    {canAccessDeadlines && (
                      <TabsTrigger value="deadlines" className="flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        Tech. události
                      </TabsTrigger>
                    )}
                    {canAccessPlp && (
                      <TabsTrigger value="plp" className="flex items-center gap-2">
                        <Stethoscope className="w-4 h-4" />
                        PLP
                      </TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>
              )}
            </div>
            
            {profile && <div className="flex items-center gap-2">
                <NotificationBell />
                <Link to="/profile" className="hidden sm:flex items-center gap-3 text-sm hover:bg-accent rounded-lg px-3 py-2 transition-colors">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div className="flex flex-col items-end">
                    <span className="font-medium text-foreground">
                      {profile.first_name} {profile.last_name}
                    </span>
                    <div className="flex items-center gap-2">
                      {profile.position && <span className="text-xs text-muted-foreground">
                          {profile.position}
                        </span>}
                      {getRoleBadge()}
                    </div>
                  </div>
                </Link>
                <Button variant="outline" size="sm" onClick={signOut} className="hidden sm:flex gap-2">
                  <LogOut className="w-4 h-4" />
                  Odhlásit se
                </Button>

                <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              </div>}
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-6">
        {/* Desktop Navigation */}
        <nav className="hidden lg:block mb-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {isTrainingMode ? <>
                  {/* Training Mode Navigation */}
                  <NavLink to="/trainings" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors" activeClassName="text-foreground bg-card border-b-2 border-primary">
                    <Calendar className="w-4 h-4" />
                    Naplánovaná
                  </NavLink>
                  
                  {(isAdmin || isManager) && (
                    <NavLink to="/trainings/history" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors" activeClassName="text-foreground bg-card border-b-2 border-primary">
                      <History className="w-4 h-4" />
                      Historie
                    </NavLink>
                  )}

                  {/* Tlačítko pro vytvoření školení - jen admin a manažer */}
                  {(isAdmin || isManager) && (
                    <Link to="/trainings/new">
                      <Button size="sm" className="ml-2 gap-2">
                        <PlusCircle className="w-4 h-4" />
                        Nové školení
                      </Button>
                    </Link>
                  )}

                  {/* Dropdown Ostatní - jen admin a manažer */}
                  {(isAdmin || isManager) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors ml-1", isTrainingOstatniActive && "text-foreground bg-card border-b-2 border-primary")}>
                          Ostatní
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48 bg-popover z-50">
                        <DropdownMenuItem asChild>
                          <Link to="/training-types" className="flex items-center gap-2 cursor-pointer">
                            <BookOpen className="w-4 h-4" />
                            Typy školení
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/departments" className="flex items-center gap-2 cursor-pointer">
                            <Building2 className="w-4 h-4" />
                            Střediska
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/inactive" className="flex items-center gap-2 cursor-pointer">
                            <UserX className="w-4 h-4" />
                            Pozastavená
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </> : isDeadlineMode ? <>
                  {/* Deadline Mode Navigation */}
                  <NavLink to="/deadlines" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors" activeClassName="text-foreground bg-card border-b-2 border-primary">
                    <Calendar className="w-4 h-4" />
                    Naplánované
                  </NavLink>
                  
                  {(isAdmin || isManager) && (
                    <NavLink to="/deadlines/history" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors" activeClassName="text-foreground bg-card border-b-2 border-primary">
                      <History className="w-4 h-4" />
                      Historie
                    </NavLink>
                  )}

                  {/* Tlačítko pro vytvoření události - jen admin a manažer */}
                  {(isAdmin || isManager) && (
                    <Link to="/deadlines/new">
                      <Button size="sm" className="ml-2 gap-2">
                        <PlusCircle className="w-4 h-4" />
                        Nová událost
                      </Button>
                    </Link>
                  )}

                  {/* Dropdown Ostatní - jen admin a manažer */}
                  {(isAdmin || isManager) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors ml-1", isDeadlineOstatniActive && "text-foreground bg-card border-b-2 border-primary")}>
                          Ostatní
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 bg-popover z-50">
                        <DropdownMenuItem asChild>
                          <Link to="/deadlines/equipment" className="flex items-center gap-2 cursor-pointer">
                            <Cog className="w-4 h-4" />
                            Zařízení
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/deadlines/types" className="flex items-center gap-2 cursor-pointer">
                            <Clock className="w-4 h-4" />
                            Typy událostí
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/deadlines/groups" className="flex items-center gap-2 cursor-pointer">
                            <UsersRound className="w-4 h-4" />
                            Skupiny odpovědných osob
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </> : <>
                  {/* PLP Mode Navigation */}
                  <NavLink to="/plp" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors" activeClassName="text-foreground bg-card border-b-2 border-primary">
                    <Calendar className="w-4 h-4" />
                    Naplánované
                  </NavLink>

                  {/* Historie prohlídek - jen admin a manažer */}
                  {(isAdmin || isManager) && (
                    <NavLink to="/plp/history" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors" activeClassName="text-foreground bg-card border-b-2 border-primary">
                      <History className="w-4 h-4" />
                      Historie
                    </NavLink>
                  )}

                  {/* Tlačítko pro vytvoření prohlídky - pouze admin */}
                  {isAdmin && (
                    <Link to="/plp/new">
                      <Button size="sm" className="ml-2 gap-2">
                        <PlusCircle className="w-4 h-4" />
                        Nová prohlídka
                      </Button>
                    </Link>
                  )}

                  {/* Typy prohlídek - jen admin a manažer */}
                  {(isAdmin || isManager) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors ml-1", location.pathname === "/plp/types" && "text-foreground bg-card border-b-2 border-primary")}>
                          Ostatní
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48 bg-popover z-50">
                        <DropdownMenuItem asChild>
                          <Link to="/plp/types" className="flex items-center gap-2 cursor-pointer">
                            <BookOpen className="w-4 h-4" />
                            Typy prohlídek
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>}
            </div>

            <div className="flex items-center gap-1">
              {/* Statistics only visible in Training mode and for admin/manager */}
              {isTrainingMode && (isAdmin || isManager) && <NavLink to="/statistics" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors" activeClassName="text-foreground bg-card border-b-2 border-primary">
                  <BarChart3 className="w-4 h-4" />
                  Statistika
                </NavLink>}

              {/* Global "Systém" section - visible to admin/manager, independent of mode */}
              {(isAdmin || isManager) && <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors", (location.pathname === "/audit-log" || location.pathname.startsWith("/admin") || location.pathname === "/facilities") && "text-foreground bg-card border-b-2 border-primary")}>
                      <Settings className="w-4 h-4" />
                      Systém
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                    {/* Zaměstnanci se nezobrazují v modulu Tech. události - nejsou tam potřeba */}
                    {!isDeadlineMode && (
                      <DropdownMenuItem asChild>
                        <Link to="/employees" className="flex items-center gap-2 cursor-pointer">
                          <Users className="w-4 h-4" />
                          Zaměstnanci
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link to="/facilities" className="flex items-center gap-2 cursor-pointer">
                        <Building2 className="w-4 h-4" />
                        Provozovny
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && <DropdownMenuItem asChild>
                      <Link to="/audit-log" className="flex items-center gap-2 cursor-pointer">
                        <FileText className="w-4 h-4" />
                        Audit log
                      </Link>
                    </DropdownMenuItem>}
                    {isAdmin && <>
                        <DropdownMenuItem asChild>
                          <Link to="/admin/status" className="flex items-center gap-2 cursor-pointer">
                            <Activity className="w-4 h-4" />
                            Stav systému
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/admin/settings" className="flex items-center gap-2 cursor-pointer">
                            <Settings className="w-4 h-4" />
                            Administrace
                          </Link>
                        </DropdownMenuItem>
                      </>}
                  </DropdownMenuContent>
                </DropdownMenu>}
            </div>
          </div>
        </nav>

        {/* Mobile Navigation */}
        {mobileMenuOpen && <nav className="lg:hidden mb-6 border border-border rounded-lg bg-card p-4 space-y-2">
            {/* Mode Switcher for Mobile */}
            <div className="pb-4 border-b border-border">
              <Tabs value={isPlpMode ? "plp" : isDeadlineMode ? "deadlines" : "trainings"} onValueChange={handleModeSwitch} className="w-full">
                <TabsList className={cn(
                  "grid w-full",
                  accessibleModulesCount === 1 && "grid-cols-1",
                  accessibleModulesCount === 2 && "grid-cols-2",
                  accessibleModulesCount === 3 && "grid-cols-3"
                )}>
                  {canAccessTrainings && (
                    <TabsTrigger value="trainings" className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Školení
                    </TabsTrigger>
                  )}
                  {canAccessDeadlines && (
                    <TabsTrigger value="deadlines" className="flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Události
                    </TabsTrigger>
                  )}
                  {canAccessPlp && (
                    <TabsTrigger value="plp" className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4" />
                      PLP
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Hlavní</p>
              {isTrainingMode ? <>
                  <Link to="/trainings" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/" || location.pathname === "/trainings" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <Calendar className="w-4 h-4" />
                    Naplánovaná školení
                  </Link>
                  {(isAdmin || isManager) && (
                    <Link to="/trainings/history" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/trainings/history" || location.pathname === "/history" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                      <History className="w-4 h-4" />
                      Historie školení
                    </Link>
                  )}
                  {(isAdmin || isManager) && (
                    <Link to="/trainings/new" onClick={closeMobileMenu} className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground">
                      <PlusCircle className="w-4 h-4" />
                      Nové školení
                    </Link>
                  )}
                </> : isDeadlineMode ? <>
                  <Link to="/deadlines" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/deadlines" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <Calendar className="w-4 h-4" />
                    Naplánované události
                  </Link>
                  {(isAdmin || isManager) && (
                    <Link to="/deadlines/history" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/deadlines/history" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                      <History className="w-4 h-4" />
                      Historie událostí
                    </Link>
                  )}
                  {(isAdmin || isManager) && (
                    <Link to="/deadlines/new" onClick={closeMobileMenu} className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground">
                      <PlusCircle className="w-4 h-4" />
                      Nová událost
                    </Link>
                  )}
                </> : <>
                  <Link to="/plp" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/plp" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <Calendar className="w-4 h-4" />
                    Naplánované prohlídky
                  </Link>
                  {(isAdmin || isManager) && (
                    <Link to="/plp/history" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/plp/history" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                      <History className="w-4 h-4" />
                      Historie prohlídek
                    </Link>
                  )}
                  {isAdmin && (
                    <Link to="/plp/new" onClick={closeMobileMenu} className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground">
                      <PlusCircle className="w-4 h-4" />
                      Nová prohlídka
                    </Link>
                  )}
                </>}
            </div>

            <div className="space-y-1 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ostatní</p>
              {isTrainingMode ? <>
                  <Link to="/training-types" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/training-types" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <BookOpen className="w-4 h-4" />
                    Typy školení
                  </Link>
                  <Link to="/departments" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/departments" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <Building2 className="w-4 h-4" />
                    Střediska
                  </Link>
                  <Link to="/inactive" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/inactive" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <UserX className="w-4 h-4" />
                    Pozastavená
                  </Link>
                </> : isDeadlineMode ? <>
                  <Link to="/deadlines/equipment" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/deadlines/equipment" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <Cog className="w-4 h-4" />
                    Zařízení
                  </Link>
                  <Link to="/deadlines/types" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/deadlines/types" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <Clock className="w-4 h-4" />
                    Typy událostí
                  </Link>
                  <Link to="/deadlines/groups" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/deadlines/groups" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <UsersRound className="w-4 h-4" />
                    Skupiny odpovědných
                  </Link>
                </> : <>
                  {(isAdmin || isManager) && (
                    <Link to="/plp/types" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/plp/types" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                      <BookOpen className="w-4 h-4" />
                      Typy prohlídek
                    </Link>
                  )}
                </>}
              {!isDeadlineMode && (
                <Link to="/employees" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/employees" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                  <Users className="w-4 h-4" />
                  Zaměstnanci
                </Link>
              )}
              <Link to="/facilities" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/facilities" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                <Building2 className="w-4 h-4" />
                Provozovny
              </Link>
            </div>

            {/* Global System section - independent of mode */}
            {(isAdmin || isManager) && <div className="space-y-1 pt-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Systém</p>
                {isTrainingMode && <Link to="/statistics" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/statistics" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <BarChart3 className="w-4 h-4" />
                    Statistika
                  </Link>}
                {isAdmin && <Link to="/audit-log" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/audit-log" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                  <FileText className="w-4 h-4" />
                  Audit log
                </Link>}
                {isAdmin && <>
                    <Link to="/admin/status" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/admin/status" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                      <Activity className="w-4 h-4" />
                      Stav systému
                    </Link>
                    <Link to="/admin/settings" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/admin/settings" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                      <Settings className="w-4 h-4" />
                      Administrace
                    </Link>
                  </>}
              </div>}

            <div className="space-y-1 pt-2 border-t border-border">
              <Link to="/profile" onClick={closeMobileMenu} className={cn("flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors", location.pathname === "/profile" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                <User className="w-4 h-4" />
                Profil
                {getRoleBadge()}
              </Link>
              <button onClick={() => {
            closeMobileMenu();
            signOut();
          }} className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-destructive hover:bg-destructive/10 w-full">
                <LogOut className="w-4 h-4" />
                Odhlásit se
              </button>
            </div>
          </nav>}
        
        <main>{children}</main>
      </div>
    </div>;
};