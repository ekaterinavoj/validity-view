import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  position?: string;
  department_id?: string;
  approval_status?: string;
}

type UserRole = "admin" | "manager" | "user";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  loading: boolean;
  rolesLoaded: boolean;
  isPending: boolean;
  isApproved: boolean;
  hasRole: (role: UserRole) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, firstName: string, lastName: string, position?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const { toast } = useToast();

  const loadProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error loading profile:", error);
        return null;
      }

      setProfile(data);
      return data;
    } catch (error) {
      console.error("Error loading profile:", error);
      return null;
    }
  };

  const loadRoles = async (userId: string): Promise<UserRole[]> => {
    // IMPORTANT: roles are fetched async; never let rolesLoaded stay false forever.
    setRolesLoaded(false);
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.error("Error loading roles:", error);
        return [];
      }

      const userRoles = data?.map((r) => r.role as UserRole) || [];
      setRoles(userRoles);
      return userRoles;
    } catch (error) {
      console.error("Error loading roles:", error);
      return [];
    } finally {
      setRolesLoaded(true);
    }
  };

  const loadUserData = async (userId: string) => {
    await Promise.all([loadProfile(userId), loadRoles(userId)]);
  };

  const hasRole = (role: UserRole): boolean => {
    return roles.includes(role);
  };

  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");
  const isPending = profile?.approval_status === 'pending';
  const isApproved = profile?.approval_status === 'approved';

  const refreshProfile = async () => {
    if (user?.id) {
      await loadUserData(user.id);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          await loadUserData(initialSession.user.id);
        } else {
          setRolesLoaded(true);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        if (mounted) {
          setRolesLoaded(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          await loadUserData(newSession.user.id);
        } else {
          setProfile(null);
          setRoles([]);
          setRolesLoaded(true);
        }
        
        setLoading(false);
      }
    );

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error ?? null };
    } catch (error: any) {
      return { error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    position?: string
  ) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName,
            last_name: lastName,
            position: position || "",
          },
        },
      });
      return { error: error ?? null };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setProfile(null);
      setRoles([]);
      setRolesLoaded(false);
      toast({
        title: "Odhlášení úspěšné",
        description: "Byli jste úspěšně odhlášeni.",
      });
    } catch (error: any) {
      toast({
        title: "Chyba při odhlášení",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        rolesLoaded,
        isPending,
        isApproved,
        hasRole,
        isAdmin,
        isManager,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
