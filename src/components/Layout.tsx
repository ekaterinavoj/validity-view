import { useState } from "react";
import { NavLink } from "./NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import { Link, useLocation } from "react-router-dom";
import { 
  Calendar, 
  History, 
  PlusCircle,
  BarChart3,
  ChevronDown,
  LogOut,
  User,
  FileText,
  Activity,
  Users,
  BookOpen,
  Building2,
  UserX,
  Settings,
  Bell,
  Mail,
  UserCheck,
  Database,
  Menu,
  X,
  GraduationCap,
  Wrench,
  Clock,
  Cog
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { profile, roles, isAdmin, isManager, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine current mode based on route
  const isDeadlineMode = location.pathname.startsWith("/deadlines");
  const isTrainingMode = !isDeadlineMode;

  const getRoleBadge = () => {
    if (roles.includes("admin")) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-700 dark:text-red-300">Admin</span>;
    }
    if (roles.includes("manager")) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300">Manažer</span>;
    }
    return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-700 dark:text-green-300">Uživatel</span>;
  };

  // Training mode "Ostatní" dropdown active state
  const isTrainingOstatniActive = ["/employees", "/training-types", "/departments", "/facilities", "/inactive"].some(
    path => location.pathname === path
  );

  // Deadline mode "Ostatní" dropdown active state
  const isDeadlineOstatniActive = ["/deadlines/equipment", "/deadlines/types"].some(
    path => location.pathname === path
  );

  const isAdminActive = location.pathname.startsWith("/admin/settings");

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleModeSwitch = (value: string) => {
    if (value === "trainings" && isDeadlineMode) {
      window.location.href = "/trainings";
    } else if (value === "deadlines" && isTrainingMode) {
      window.location.href = "/deadlines";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-foreground">
                Správa
              </h1>
              
              {/* Mode Switcher Tabs */}
              <Tabs value={isDeadlineMode ? "deadlines" : "trainings"} onValueChange={handleModeSwitch}>
                <TabsList className="grid w-[280px] grid-cols-2">
                  <TabsTrigger value="trainings" className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    Školení
                  </TabsTrigger>
                  <TabsTrigger value="deadlines" className="flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Technické lhůty
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            {profile && (
              <div className="flex items-center gap-4">
                <Link to="/profile" className="hidden sm:flex items-center gap-3 text-sm hover:bg-accent rounded-lg px-3 py-2 transition-colors">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div className="flex flex-col items-end">
                    <span className="font-medium text-foreground">
                      {profile.first_name} {profile.last_name}
                    </span>
                    <div className="flex items-center gap-2">
                      {profile.position && (
                        <span className="text-xs text-muted-foreground">
                          {profile.position}
                        </span>
                      )}
                      {getRoleBadge()}
                    </div>
                  </div>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="hidden sm:flex gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Odhlásit se
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-6">
        {/* Desktop Navigation */}
        <nav className="hidden lg:block mb-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {isTrainingMode ? (
                <>
                  {/* Training Mode Navigation */}
                  <NavLink
                    to="/trainings"
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors"
                    activeClassName="text-foreground bg-card border-b-2 border-primary"
                  >
                    <Calendar className="w-4 h-4" />
                    Naplánovaná
                  </NavLink>
                  
                  <NavLink
                    to="/trainings/history"
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors"
                    activeClassName="text-foreground bg-card border-b-2 border-primary"
                  >
                    <History className="w-4 h-4" />
                    Historie
                  </NavLink>

                  <Link to="/trainings/new">
                    <Button size="sm" className="ml-2 gap-2">
                      <PlusCircle className="w-4 h-4" />
                      Nové školení
                    </Button>
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors ml-1",
                          isTrainingOstatniActive && "text-foreground bg-card border-b-2 border-primary"
                        )}
                      >
                        Ostatní
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 bg-popover z-50">
                      <DropdownMenuItem asChild>
                        <Link to="/employees" className="flex items-center gap-2 cursor-pointer">
                          <Users className="w-4 h-4" />
                          Školené osoby
                        </Link>
                      </DropdownMenuItem>
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
                        <Link to="/facilities" className="flex items-center gap-2 cursor-pointer">
                          <Building2 className="w-4 h-4" />
                          Provozovny
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
                </>
              ) : (
                <>
                  {/* Deadline Mode Navigation */}
                  <NavLink
                    to="/deadlines"
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors"
                    activeClassName="text-foreground bg-card border-b-2 border-primary"
                  >
                    <Calendar className="w-4 h-4" />
                    Naplánované
                  </NavLink>
                  
                  <NavLink
                    to="/deadlines/history"
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors"
                    activeClassName="text-foreground bg-card border-b-2 border-primary"
                  >
                    <History className="w-4 h-4" />
                    Historie
                  </NavLink>

                  <Link to="/deadlines/new">
                    <Button size="sm" className="ml-2 gap-2">
                      <PlusCircle className="w-4 h-4" />
                      Nová lhůta
                    </Button>
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors ml-1",
                          isDeadlineOstatniActive && "text-foreground bg-card border-b-2 border-primary"
                        )}
                      >
                        Ostatní
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 bg-popover z-50">
                      <DropdownMenuItem asChild>
                        <Link to="/deadlines/equipment" className="flex items-center gap-2 cursor-pointer">
                          <Cog className="w-4 h-4" />
                          Zařízení
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/deadlines/types" className="flex items-center gap-2 cursor-pointer">
                          <Clock className="w-4 h-4" />
                          Typy lhůt
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/facilities" className="flex items-center gap-2 cursor-pointer">
                          <Building2 className="w-4 h-4" />
                          Provozovny
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Statistics only visible in Training mode */}
              {isTrainingMode && (
                <NavLink
                  to="/statistics"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors"
                  activeClassName="text-foreground bg-card border-b-2 border-primary"
                >
                  <BarChart3 className="w-4 h-4" />
                  Statistika
                </NavLink>
              )}

              {(isAdmin || isManager) && (
                <NavLink
                  to="/audit-log"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors"
                  activeClassName="text-foreground bg-card border-b-2 border-primary"
                >
                  <FileText className="w-4 h-4" />
                  Audit log
                </NavLink>
              )}

              {isAdmin && (
                <>
                  <NavLink
                    to="/admin/status"
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors"
                    activeClassName="text-foreground bg-card border-b-2 border-primary"
                  >
                    <Activity className="w-4 h-4" />
                    Stav systému
                  </NavLink>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors",
                          isAdminActive && "text-foreground bg-card border-b-2 border-primary"
                        )}
                      >
                        <Settings className="w-4 h-4" />
                        Administrace
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                      <DropdownMenuItem asChild>
                        <Link to="/admin/settings?tab=onboarding" className="flex items-center gap-2 cursor-pointer">
                          <UserCheck className="w-4 h-4" />
                          Onboarding
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/settings?tab=reminders" className="flex items-center gap-2 cursor-pointer">
                          <Bell className="w-4 h-4" />
                          Připomínky
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/settings?tab=email" className="flex items-center gap-2 cursor-pointer">
                          <Mail className="w-4 h-4" />
                          Emaily
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/settings?tab=recipients" className="flex items-center gap-2 cursor-pointer">
                          <Users className="w-4 h-4" />
                          Příjemci
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/admin/settings?tab=data" className="flex items-center gap-2 cursor-pointer">
                          <Database className="w-4 h-4" />
                          Data
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="lg:hidden mb-6 border border-border rounded-lg bg-card p-4 space-y-2">
            {/* Mode Switcher for Mobile */}
            <div className="pb-4 border-b border-border">
              <Tabs value={isDeadlineMode ? "deadlines" : "trainings"} onValueChange={handleModeSwitch} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="trainings" className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    Školení
                  </TabsTrigger>
                  <TabsTrigger value="deadlines" className="flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Tech. lhůty
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Hlavní</p>
              {isTrainingMode ? (
                <>
                  <Link 
                    to="/trainings" 
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      location.pathname === "/" || location.pathname === "/trainings" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Calendar className="w-4 h-4" />
                    Naplánovaná školení
                  </Link>
                  <Link 
                    to="/trainings/history" 
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      location.pathname === "/trainings/history" || location.pathname === "/history" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <History className="w-4 h-4" />
                    Historie školení
                  </Link>
                  <Link 
                    to="/trainings/new" 
                    onClick={closeMobileMenu}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Nové školení
                  </Link>
                </>
              ) : (
                <>
                  <Link 
                    to="/deadlines" 
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      location.pathname === "/deadlines" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Calendar className="w-4 h-4" />
                    Naplánované lhůty
                  </Link>
                  <Link 
                    to="/deadlines/history" 
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      location.pathname === "/deadlines/history" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <History className="w-4 h-4" />
                    Historie lhůt
                  </Link>
                  <Link 
                    to="/deadlines/new" 
                    onClick={closeMobileMenu}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Nová lhůta
                  </Link>
                </>
              )}
            </div>

            <div className="space-y-1 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ostatní</p>
              {isTrainingMode ? (
                <>
                  <Link 
                    to="/employees" 
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      location.pathname === "/employees" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Users className="w-4 h-4" />
                    Školené osoby
                  </Link>
                  <Link 
                    to="/training-types" 
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      location.pathname === "/training-types" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <BookOpen className="w-4 h-4" />
                    Typy školení
                  </Link>
                  <Link 
                    to="/departments" 
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      location.pathname === "/departments" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Building2 className="w-4 h-4" />
                    Střediska
                  </Link>
                  <Link 
                    to="/inactive" 
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      location.pathname === "/inactive" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <UserX className="w-4 h-4" />
                    Pozastavená
                  </Link>
                </>
              ) : (
                <>
                  <Link 
                    to="/deadlines/equipment" 
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      location.pathname === "/deadlines/equipment" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Cog className="w-4 h-4" />
                    Zařízení
                  </Link>
                  <Link 
                    to="/deadlines/types" 
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      location.pathname === "/deadlines/types" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Clock className="w-4 h-4" />
                    Typy lhůt
                  </Link>
                </>
              )}
              <Link 
                to="/facilities" 
                onClick={closeMobileMenu}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  location.pathname === "/facilities" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Building2 className="w-4 h-4" />
                Provozovny
              </Link>
            </div>

            <div className="space-y-1 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Přehledy</p>
              {/* Statistics only visible in Training mode */}
              {isTrainingMode && (
                <Link 
                  to="/statistics" 
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    location.pathname === "/statistics" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                  Statistika
                </Link>
              )}
              {(isAdmin || isManager) && (
                <Link 
                  to="/audit-log" 
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    location.pathname === "/audit-log" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <FileText className="w-4 h-4" />
                  Audit log
                </Link>
              )}
              {isAdmin && (
                <Link 
                  to="/admin/status" 
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    location.pathname === "/admin/status" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Activity className="w-4 h-4" />
                  Stav systému
                </Link>
              )}
            </div>

            {isAdmin && (
              <div className="space-y-1 pt-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Administrace</p>
                <Link 
                  to="/admin/settings?tab=onboarding" 
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    location.pathname === "/admin/settings" && location.search.includes("onboarding") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <UserCheck className="w-4 h-4" />
                  Onboarding
                </Link>
                <Link 
                  to="/admin/settings?tab=reminders" 
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    location.pathname === "/admin/settings" && location.search.includes("reminders") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Bell className="w-4 h-4" />
                  Připomínky
                </Link>
                <Link 
                  to="/admin/settings?tab=email" 
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    location.pathname === "/admin/settings" && location.search.includes("tab=email") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Mail className="w-4 h-4" />
                  Emaily
                </Link>
                <Link 
                  to="/admin/settings?tab=recipients" 
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    location.pathname === "/admin/settings" && location.search.includes("recipients") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Users className="w-4 h-4" />
                  Příjemci
                </Link>
                <Link 
                  to="/admin/settings?tab=data" 
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    location.pathname === "/admin/settings" && location.search.includes("data") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Database className="w-4 h-4" />
                  Data
                </Link>
              </div>
            )}

            <div className="space-y-1 pt-2 border-t border-border">
              <Link 
                to="/profile" 
                onClick={closeMobileMenu}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  location.pathname === "/profile" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <User className="w-4 h-4" />
                Profil
                {getRoleBadge()}
              </Link>
              <button 
                onClick={() => { closeMobileMenu(); signOut(); }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-destructive hover:bg-destructive/10 w-full"
              >
                <LogOut className="w-4 h-4" />
                Odhlásit se
              </button>
            </div>
          </nav>
        )}
        
        <main>{children}</main>
      </div>
    </div>
  );
};
