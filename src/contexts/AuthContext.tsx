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
type ModuleAccess = "trainings" | "deadlines" | "plp";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  moduleAccess: ModuleAccess[];
  loading: boolean;
  rolesLoaded: boolean;
  profileLoaded: boolean;
  profileError: string | null;
  isPending: boolean;
  isApproved: boolean;
  hasRole: (role: UserRole) => boolean;
  hasModuleAccess: (module: ModuleAccess) => boolean;
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
  const [moduleAccess, setModuleAccess] = useState<ModuleAccess[]>([]);
  const [loading, setLoading] = useState(true);
  // Start with true so we don't show spinner on initial load before we know if there's a user
  const [rolesLoaded, setRolesLoaded] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadProfile = async (userId: string): Promise<Profile | null> => {
    setProfileLoaded(false);
    setProfileError(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error loading profile:", error);
        setProfile(null);
        setProfileError(error.message);
        return null;
      }

      setProfile(data);
      return data;
    } catch (error) {
      console.error("Error loading profile:", error);
      setProfile(null);
      setProfileError(error instanceof Error ? error.message : "Neznámá chyba");
      return null;
    } finally {
      setProfileLoaded(true);
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

  const loadModuleAccess = async (userId: string, userRoles: UserRole[]): Promise<ModuleAccess[]> => {
    try {
      // Admins have access to all modules - no need to query DB
      if (userRoles.includes("admin")) {
        const allModules: ModuleAccess[] = ["trainings", "deadlines", "plp"];
        setModuleAccess(allModules);
        return allModules;
      }

      const { data, error } = await supabase
        .from("user_module_access")
        .select("module")
        .eq("user_id", userId);

      if (error) {
        console.error("Error loading module access:", error);
        return [];
      }

      const modules = (data?.map((r) => r.module) || []).filter(
        (m): m is ModuleAccess => m === "trainings" || m === "deadlines" || m === "plp"
      );
      setModuleAccess(modules);
      return modules;
    } catch (error) {
      console.error("Error loading module access:", error);
      return [];
    }
  };

  const loadUserData = async (userId: string) => {
    const [, userRoles] = await Promise.all([loadProfile(userId), loadRoles(userId)]);
    // Load module access after roles (needs to know if admin)
    await loadModuleAccess(userId, userRoles);
  };

  const hasRole = (role: UserRole): boolean => {
    return roles.includes(role);
  };

  const hasModuleAccess = (module: ModuleAccess): boolean => {
    // Admins always have access to all modules
    if (roles.includes("admin")) return true;
    return moduleAccess.includes(module);
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

    const handleSession = async (newSession: Session | null) => {
      if (!mounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Clear stale data immediately
        setProfile(null);
        setRoles([]);
        setModuleAccess([]);
        setProfileLoaded(false);
        setRolesLoaded(false);
        setProfileError(null);

        // Load user data and WAIT for it before setting loading=false
        try {
          await loadUserData(newSession.user.id);
        } catch (error) {
          console.error("Error loading user data:", error);
          setProfileLoaded(true);
          setRolesLoaded(true);
        }
      } else {
        setProfile(null);
        setRoles([]);
        setModuleAccess([]);
        setProfileError(null);
        setProfileLoaded(true);
        setRolesLoaded(true);
      }

      if (mounted) {
        setLoading(false);
      }
    };

    // Listener FIRST (prevents missing events during init)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      void event;
      // Don't await - the callback cannot be async, but handleSession manages loading state
      void handleSession(newSession);
    });

    // THEN resolve initial session
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        void handleSession(initialSession);
      })
      .catch((error) => {
        console.error("Error initializing auth:", error);
        if (mounted) {
          setProfile(null);
          setRoles([]);
          setProfileError(error instanceof Error ? error.message : "Neznámá chyba");
          setProfileLoaded(true);
          setRolesLoaded(true);
          setLoading(false);
        }
      });

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
      
      const { data, error } = await supabase.auth.signUp({
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
      
      // If signup succeeded and we have a user, ensure profile exists
      // This is a fallback in case the database trigger fails
      if (!error && data?.user) {
        // Small delay to let trigger attempt first
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if profile was created by trigger
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .maybeSingle();
        
        // If no profile exists, create it manually (fallback)
        if (!existingProfile) {
          console.log("Profile not created by trigger, creating manually...");
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: data.user.id,
              first_name: firstName,
              last_name: lastName,
              email: email,
              position: position || "",
            });
          
          if (profileError) {
            console.error("Failed to create profile fallback:", profileError);
            // Don't return error - user is created, profile issue is secondary
          }
        }
      }
      
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
      setModuleAccess([]);
      setProfileError(null);
      setProfileLoaded(true);
      setRolesLoaded(true);
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
        moduleAccess,
        loading,
        rolesLoaded,
        profileLoaded,
        profileError,
        isPending,
        isApproved,
        hasRole,
        hasModuleAccess,
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
