import { NavLink } from "./NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import { 
  Calendar, 
  History, 
  PlusCircle,
  BarChart3,
  MoreHorizontal,
  LogOut,
  User,
  Shield,
  FileText,
  Settings,
  Activity
} from "lucide-react";

const navItems = [
  { to: "/", label: "Naplánovaná školení", icon: Calendar },
  { to: "/history", label: "Historie školení", icon: History },
  { to: "/new-training", label: "Vytvoření nového školení", icon: PlusCircle },
  { to: "/statistics", label: "Statistika", icon: BarChart3 },
  { to: "/other", label: "Ostatní", icon: MoreHorizontal },
];

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { profile, roles, isAdmin, isManager, signOut } = useAuth();

  const getRoleBadge = () => {
    if (roles.includes("admin")) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-700 dark:text-red-300">Admin</span>;
    }
    if (roles.includes("manager")) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300">Manažer</span>;
    }
    return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-700 dark:text-green-300">Uživatel</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">
              Systém správy školení
            </h1>
            
            {profile && (
              <div className="flex items-center gap-4">
                <Link to="/profile" className="flex items-center gap-3 text-sm hover:bg-accent rounded-lg px-3 py-2 transition-colors">
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
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Odhlásit se
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-6">
        <nav className="mb-6 border-b border-border">
          <div className="flex flex-wrap gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors"
                  activeClassName="text-foreground bg-card border-b-2 border-primary"
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              );
            })}
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
                  to="/admin/settings"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors"
                  activeClassName="text-foreground bg-card border-b-2 border-primary"
                >
                  <Settings className="w-4 h-4" />
                  Administrace
                </NavLink>
                <NavLink
                  to="/admin/status"
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-lg transition-colors"
                  activeClassName="text-foreground bg-card border-b-2 border-primary"
                >
                  <Activity className="w-4 h-4" />
                  Stav systému
                </NavLink>
              </>
            )}
          </div>
        </nav>
        
        <main>{children}</main>
      </div>
    </div>
  );
};
