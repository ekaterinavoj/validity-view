import { NavLink } from "./NavLink";
import { 
  LayoutDashboard,
  Calendar, 
  History, 
  PlusCircle, 
  Clock,
  MoreHorizontal
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scheduled-trainings", label: "Naplánovaná školení", icon: Calendar },
  { to: "/history", label: "Historie školení", icon: History },
  { to: "/training-hours", label: "Odškolené hodiny", icon: Clock },
  { to: "/new-training", label: "Vytvoření nového školení", icon: PlusCircle },
  { to: "/other", label: "Ostatní", icon: MoreHorizontal },
];

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">
            Systém správy školení
          </h1>
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
