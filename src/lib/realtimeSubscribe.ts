import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type RealtimeDenyReason =
  | "not_authenticated"
  | "not_approved"
  | "no_permission"
  | "channel_error"
  | "timed_out"
  | "closed";

export interface SubscribeOptions {
  /** Required role to subscribe (one of). Empty = any approved user. */
  requiredRoles?: ("admin" | "manager" | "user")[];
  /** Required module access (deadlines, trainings, plp). */
  requiredModule?: string;
  /** Display toast on denial. Default true. */
  notifyOnError?: boolean;
}

interface AppContextLike {
  isAuthenticated: boolean;
  isApproved: boolean;
  roles: string[];
  moduleAccess: string[];
}

const REASON_LABEL: Record<RealtimeDenyReason, string> = {
  not_authenticated: "Nejste přihlášen.",
  not_approved: "Váš účet zatím nebyl schválen administrátorem.",
  no_permission: "Pro tento kanál vám chybí oprávnění (role nebo modul).",
  channel_error: "Kanál odmítl připojení (server-side RLS).",
  timed_out: "Připojení ke kanálu vypršelo.",
  closed: "Kanál byl zavřen.",
};

export const formatRealtimeDenyReason = (reason: RealtimeDenyReason) => REASON_LABEL[reason];

async function logDenied(topic: string, reason: RealtimeDenyReason) {
  try {
    await supabase.rpc("log_realtime_denied" as never, {
      _topic: topic,
      _reason: reason,
    } as never);
  } catch {
    // Silent — denial logging is best-effort.
  }
}

/**
 * Subscribe to a Supabase Realtime channel with explicit pre-checks and
 * user-facing error reporting. Logs denied attempts to audit_logs via RPC.
 *
 * Returns the channel handle so the caller can attach .on(...) listeners
 * and later call supabase.removeChannel(ch). Returns null on denial.
 */
export function subscribeToChannel(
  topic: string,
  ctx: AppContextLike,
  options: SubscribeOptions = {}
) {
  const { requiredRoles, requiredModule, notifyOnError = true } = options;

  const denyAndReport = (reason: RealtimeDenyReason) => {
    if (notifyOnError) {
      toast({
        title: "Realtime nedostupný",
        description: formatRealtimeDenyReason(reason),
        variant: "destructive",
      });
    }
    void logDenied(topic, reason);
    return null;
  };

  if (!ctx.isAuthenticated) return denyAndReport("not_authenticated");
  if (!ctx.isApproved) return denyAndReport("not_approved");
  if (requiredRoles?.length && !requiredRoles.some((r) => ctx.roles.includes(r))) {
    return denyAndReport("no_permission");
  }
  if (requiredModule && !ctx.moduleAccess.includes(requiredModule)) {
    return denyAndReport("no_permission");
  }

  const channel = supabase.channel(topic);
  channel.subscribe((status) => {
    if (status === "CHANNEL_ERROR") denyAndReport("channel_error");
    else if (status === "TIMED_OUT") denyAndReport("timed_out");
    else if (status === "CLOSED") void logDenied(topic, "closed");
  });
  return channel;
}
