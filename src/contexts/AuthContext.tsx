import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  position: string | null;
  department_id: string | null;
  approval_status: string;
  must_change_password: boolean;
  employee_id: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
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
  moduleAccessLoaded: boolean;
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
  const [moduleAccessLoaded, setModuleAccessLoaded] = useState(true);
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
    setModuleAccessLoaded(false);
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
    } finally {
      setModuleAccessLoaded(true);
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

  // Ref to track current user ID inside the onAuthStateChange closure
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    // Counter to deduplicate concurrent handleSession calls (race between onAuthStateChange + getSession)
    let sessionSeq = 0;

    const handleSession = async (newSession: Session | null) => {
      if (!mounted) return;

      const mySeq = ++sessionSeq;

      // CRITICAL: Set loading=true to prevent ModuleRedirect from acting on stale data
      setLoading(true);
      setSession(newSession);
      setUser(newSession?.user ?? null);
      currentUserIdRef.current = newSession?.user?.id ?? null;

      if (newSession?.user) {
        // Clear stale data immediately
        setProfile(null);
        setRoles([]);
        setModuleAccess([]);
        setProfileLoaded(false);
        setRolesLoaded(false);
        setModuleAccessLoaded(false);
        setProfileError(null);

        // Load user data and WAIT for it before setting loading=false
        try {
          await loadUserData(newSession.user.id);
        } catch (error) {
          console.error("Error loading user data:", error);
          if (mounted && mySeq === sessionSeq) {
            setProfileLoaded(true);
            setRolesLoaded(true);
            setModuleAccessLoaded(true);
          }
        }
      } else {
        setProfile(null);
        setRoles([]);
        setModuleAccess([]);
        setProfileError(null);
        setProfileLoaded(true);
        setRolesLoaded(true);
        setModuleAccessLoaded(true);
      }

      // Only the latest handleSession call should set loading=false
      if (mounted && mySeq === sessionSeq) {
        setLoading(false);
      }
    };

    // Listener FIRST (prevents missing events during init)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log(`[AuthContext] onAuthStateChange: event="${event}", user=${newSession?.user?.id ?? 'null'}, currentRef=${currentUserIdRef.current}`);

      // Silent update: same user, just session/token refresh — no unmount, no loading
      if (
        newSession?.user &&
        currentUserIdRef.current &&
        newSession.user.id === currentUserIdRef.current
      ) {
        console.log(`[AuthContext] Silent update for event="${event}" (same user)`);
        setSession(newSession);
        setUser(newSession.user);
        return;
      }

      // Identity changed (login, logout, different user) — full reload
      console.log(`[AuthContext] Full handleSession for event="${event}"`);
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
          setModuleAccessLoaded(true);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // Retry logic for transient server errors (500, network issues) — common on selfhosted
    // after long idle periods or backend restarts.
    const MAX_ATTEMPTS = 3;
    const BASE_DELAY_MS = 700;
    let lastError: any = null;

    // Correlation id to trace all attempts for one logical signIn in DB logs / console.
    const requestId =
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    const userAgent =
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null;

    // Best-effort logger to public.auth_signin_attempts. Never throws or blocks login.
    const logAttempt = async (params: {
      attempt: number;
      status: "success" | "failure" | "retry";
      httpStatus?: number | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    }) => {
      try {
        await supabase.from("auth_signin_attempts").insert({
          email: email.trim().toLowerCase().slice(0, 320),
          attempt_number: params.attempt,
          status: params.status,
          http_status: params.httpStatus ?? null,
          error_code: params.errorCode ? String(params.errorCode).slice(0, 100) : null,
          error_message: params.errorMessage ? params.errorMessage.slice(0, 2000) : null,
          request_id: requestId,
          user_agent: userAgent,
        });
      } catch (logErr: any) {
        // Silent — diagnostics must never break auth.
        console.debug("[AuthContext] logAttempt failed:", logErr?.message);
      }
    };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (!error) {
          console.log(
            `[AuthContext] signIn success requestId=${requestId} email=${email} attempt=${attempt}`
          );
          void logAttempt({ attempt, status: "success" });
          return { error: null };
        }

        lastError = error;

        const status = (error as any)?.status ?? 0;
        const code = (error as any)?.code ?? (error as any)?.name ?? null;
        const message = (error?.message ?? "").toLowerCase();
        const isRetryable =
          status >= 500 ||
          status === 0 ||
          status === 408 ||
          status === 429 ||
          message.includes("database error") ||
          message.includes("granting user") ||
          message.includes("network") ||
          message.includes("fetch") ||
          message.includes("timeout") ||
          message.includes("unexpected_failure");

        const isFinal = !isRetryable || attempt === MAX_ATTEMPTS;

        console.warn(
          `[AuthContext] signIn attempt ${attempt}/${MAX_ATTEMPTS} requestId=${requestId} email=${email} ` +
            `status=${status} code=${code ?? "n/a"} retryable=${isRetryable} final=${isFinal} message="${error.message}"`
        );

        void logAttempt({
          attempt,
          status: isFinal ? "failure" : "retry",
          httpStatus: status || null,
          errorCode: code,
          errorMessage: error.message,
        });

        if (isFinal) {
          return { error };
        }

        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (error: any) {
        lastError = error;
        const isFinal = attempt === MAX_ATTEMPTS;
        console.warn(
          `[AuthContext] signIn attempt ${attempt}/${MAX_ATTEMPTS} requestId=${requestId} email=${email} ` +
            `threw: name=${error?.name} message="${error?.message}" final=${isFinal}`
        );
        void logAttempt({
          attempt,
          status: isFinal ? "failure" : "retry",
          httpStatus: null,
          errorCode: error?.name ?? "exception",
          errorMessage: error?.message ?? String(error),
        });
        if (isFinal) return { error };
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return { error: lastError };
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
    } catch (error: any) {
      // Session may already be expired on server (403) — that's fine, clear local state anyway
      console.warn("Sign out error (ignored):", error.message);
    } finally {
      // ALWAYS clear local state, even if server-side logout failed
      setUser(null);
      setSession(null);
      setProfile(null);
      setRoles([]);
      setModuleAccess([]);
      setProfileError(null);
      setProfileLoaded(true);
      setRolesLoaded(true);
      setModuleAccessLoaded(true);
      toast({
        title: "Odhlášení úspěšné",
        description: "Byli jste úspěšně odhlášeni.",
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
        moduleAccessLoaded,
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
