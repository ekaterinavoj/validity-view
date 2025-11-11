import { NavLink } from "./NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import { 
  Calendar, 
  History, 
  PlusCircle,
  BarChart3,
  MoreHorizontal,
  LogOut,
  User
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
  const { profile, signOut } = useAuth();

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
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    {profile.first_name} {profile.last_name}
                  </span>
                  {profile.position && (
                    <span className="text-muted-foreground">
                      ({profile.position})
                    </span>
                  )}
                </div>
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
          </div>
        </nav>
        
        <main>{children}</main>
      </div>
    </div>
  );
};
