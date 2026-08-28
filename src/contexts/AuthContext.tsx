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
  resetPasswordForEmail: (email: string) => Promise<{ error: any }>;
  mfaPending: boolean;
  mfaChecked: boolean;
  verifyMfaCode: (code: string) => Promise<{ error: any }>;
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
  // True when the user has a verified TOTP factor and this session hasn't
  // completed the second (aal2) step yet — blocks app access until verifyMfaCode()
  // succeeds. Checked fresh on every session change (sign-in, token refresh, etc).
  const [mfaPending, setMfaPending] = useState(false);
  // Start true, mirroring rolesLoaded/moduleAccessLoaded — no spinner before we
  // know if there's a session at all; flips false while a real check is pending.
  const [mfaChecked, setMfaChecked] = useState(true);
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

  const checkMfaStatus = async () => {
    setMfaChecked(false);
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      setMfaPending(!!data && data.currentLevel === "aal1" && data.nextLevel === "aal2");
    } catch (error) {
      console.error("Error checking MFA status:", error);
      // Fail closed would lock everyone out on a transient error — fail open instead,
      // consistent with treating MFA as an added layer rather than the sole gate.
      setMfaPending(false);
    } finally {
      setMfaChecked(true);
    }
  };

  const loadUserData = async (userId: string) => {
    const [, userRoles] = await Promise.all([loadProfile(userId), loadRoles(userId), checkMfaStatus()]);
    // Load module access after roles (needs to know if admin)
    await loadModuleAccess(userId, userRoles);
  };

  // Completes the aal2 step-up: challenges the user's verified TOTP factor with
  // the given code. On success, mfaPending clears and the app becomes reachable.
  const verifyMfaCode = async (code: string) => {
    try {
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const factor = factorsData?.totp?.find((f) => f.status === "verified");
      if (!factor) {
        return { error: new Error("Nebyl nalezen žádný nastavený dvoufázový faktor") };
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw verifyError;

      await checkMfaStatus();
      return { error: null };
    } catch (error: any) {
      return { error };
    }
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
        setMfaPending(false);
        setMfaChecked(false);

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
        setMfaPending(false);
        setMfaChecked(true);
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

  // Sends a password-recovery email via Supabase Auth (GoTrue). The link lands
  // the user back on /change-password with a valid session already established,
  // where they can set a new password. Requires GoTrue's SMTP to be configured
  // with real credentials and the account to have a real, reachable email —
  // this app's seeded admin account uses a placeholder @system.local address,
  // which cannot receive mail.
  const resetPasswordForEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/change-password`,
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
        resetPasswordForEmail,
        mfaPending,
        mfaChecked,
        verifyMfaCode,
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
