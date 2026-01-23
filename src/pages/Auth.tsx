import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn, AlertCircle, Lock, Users } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Neplatný email"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
});

const signupSchema = z.object({
  email: z.string().email("Neplatný email"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "Zadejte jméno"),
  lastName: z.string().min(1, "Zadejte příjmení"),
  position: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hesla se neshodují",
  path: ["confirmPassword"],
});

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<string>('self_signup_approval');
  const [hasValidInvite, setHasValidInvite] = useState(false);
  const inviteEmail = searchParams.get('invite_email');
  
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    email: inviteEmail || "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    position: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load registration mode
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'registration_mode')
        .maybeSingle();
      
      if (data?.value && typeof data.value === 'object' && 'mode' in data.value) {
        setRegistrationMode((data.value as { mode: string }).mode);
      }

      // Check for valid invite if email is provided
      if (inviteEmail) {
        const { data: invite } = await supabase
          .from('user_invites')
          .select('id')
          .eq('email', inviteEmail.toLowerCase())
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        
        setHasValidInvite(!!invite);
      }
    };
    loadSettings();
  }, [inviteEmail]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      loginSchema.parse(loginData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    setIsLoading(true);

    const { error } = await signIn(loginData.email, loginData.password);

    setIsLoading(false);

    if (error) {
      let errorMessage = "Přihlášení se nezdařilo. Zkontrolujte email a heslo.";
      
      if (error.message?.includes("Invalid login credentials")) {
        errorMessage = "Nesprávný email nebo heslo.";
      } else if (error.message?.includes("Email not confirmed")) {
        errorMessage = "Email nebyl potvrzen. Zkontrolujte svou emailovou schránku.";
      }
      
      toast({
        title: "Chyba přihlášení",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Přihlášení úspěšné",
      description: "Vítejte zpět!",
    });

    navigate("/");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      signupSchema.parse(signupData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    setIsLoading(true);

    const { error } = await signUp(
      signupData.email,
      signupData.password,
      signupData.firstName,
      signupData.lastName,
      signupData.position
    );

    setIsLoading(false);

    if (error) {
      let errorMessage = "Registrace se nezdařila. Zkuste to prosím znovu.";
      
      if (error.message?.includes("User already registered")) {
        errorMessage = "Tento email je již registrován. Zkuste se přihlásit.";
      }
      
      toast({
        title: "Chyba registrace",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Registrace úspěšná",
      description: "Váš účet byl vytvořen. Čeká na schválení administrátorem.",
    });

    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex items-center justify-center mb-6">
          <LogIn className="w-10 h-10 text-primary mr-3" />
          <h1 className="text-3xl font-bold text-foreground">Školení App</h1>
        </div>

        {/* Show mode info banner */}
        {registrationMode === 'invite_only' && !hasValidInvite && (
          <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-2">
            <Lock className="w-4 h-4 text-warning mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Registrace je možná pouze na pozvánku. Kontaktujte administrátora pro získání přístupu.
            </p>
          </div>
        )}

        {hasValidInvite && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-start gap-2">
            <Users className="w-4 h-4 text-primary mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Máte platnou pozvánku pro <strong>{inviteEmail}</strong>. Dokončete registraci níže.
            </p>
          </div>
        )}

        <Tabs defaultValue={hasValidInvite ? "signup" : "login"} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">Přihlášení</TabsTrigger>
            <TabsTrigger value="signup" disabled={registrationMode === 'invite_only' && !hasValidInvite}>
              Registrace
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="vas@email.cz"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  required
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Heslo</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Přihlásit se
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-firstname">Jméno *</Label>
                  <Input
                    id="signup-firstname"
                    type="text"
                    placeholder="Jan"
                    value={signupData.firstName}
                    onChange={(e) => setSignupData({ ...signupData, firstName: e.target.value })}
                    required
                  />
                  {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-lastname">Příjmení *</Label>
                  <Input
                    id="signup-lastname"
                    type="text"
                    placeholder="Novák"
                    value={signupData.lastName}
                    onChange={(e) => setSignupData({ ...signupData, lastName: e.target.value })}
                    required
                  />
                  {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-position">Pozice</Label>
                <Input
                  id="signup-position"
                  type="text"
                  placeholder="např. Vedoucí výroby"
                  value={signupData.position}
                  onChange={(e) => setSignupData({ ...signupData, position: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email *</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="vas@email.cz"
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  required
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Heslo *</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  required
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm">Potvrzení hesla *</Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={signupData.confirmPassword}
                  onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                  required
                />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Zaregistrovat se
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
