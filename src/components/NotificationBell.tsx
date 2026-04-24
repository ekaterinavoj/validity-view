import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  user_id: string;
}

type FilterCategory = "all" | "probation" | "training" | "deadline" | "medical" | "other";

const CATEGORY_LABELS: Record<FilterCategory, string> = {
  all: "Vše",
  probation: "ZD",
  training: "Školení",
  deadline: "Lhůty",
  medical: "PLP",
  other: "Ostatní",
};

/** Mapuje related_entity_type na kategorii filtru. */
function categorize(n: Notification): FilterCategory {
  const t = n.related_entity_type ?? "";
  if (t === "probation_period" || t === "probation_ending") return "probation";
  if (t === "training") return "training";
  if (t === "deadline") return "deadline";
  if (t === "medical_examination" || t === "plp") return "medical";
  return "other";
}

export function NotificationBell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { preferences, updatePreference, isLoaded } = useUserPreferences();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  // Filter state mirrors cross-device preferences (DB-backed via useUserPreferences)
  const category = (preferences.notificationCategory ?? "all") as FilterCategory;
  const onlyUnread = preferences.notificationOnlyUnread ?? false;
  const setCategory = (c: FilterCategory) => updatePreference("notificationCategory", c);
  const setOnlyUnread = (v: boolean) => updatePreference("notificationOnlyUnread", v);

  // Mapování notifikací na cílové URL podle related_entity_type.
  // Vrací i lidský label pro tlačítko, aby uživatel věděl, kam ho to pošle.
  const getNotificationTarget = (n: Notification): { href: string; label: string } | null => {
    const t = n.related_entity_type;
    const id = n.related_entity_id;
    if (!t) return null;
    switch (t) {
      case "probation_period":
      case "probation_ending":
        return id
          ? { href: `/employees?edit=${id}&focus=probation`, label: "Otevřít ZD zaměstnance" }
          : { href: "/probations", label: "Otevřít přehled ZD" };
      case "employee_age_50":
        return id
          ? { href: `/employees?edit=${id}`, label: "Otevřít zaměstnance" }
          : { href: "/employees", label: "Otevřít zaměstnance" };
      case "training":
        return { href: "/trainings", label: "Otevřít školení" };
      case "deadline":
        return { href: "/deadlines", label: "Otevřít lhůtu" };
      case "medical_examination":
      case "plp":
        return { href: "/medical-examinations", label: "Otevřít PLP" };
      default:
        return null;
    }
  };

  const getNotificationLink = (n: Notification): string | null =>
    getNotificationTarget(n)?.href ?? null;

  const handleNotificationClick = async (n: Notification) => {
    const link = getNotificationLink(n);
    if (!n.is_read) {
      await markAsRead(n.id);
    }
    setOpen(false);
    if (link) navigate(link);
  };

  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();

      const channel = supabase
        .channel("notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            setNotifications(prev => [newNotification, ...prev]);
            
            toast({
              title: newNotification.title,
              description: newNotification.message,
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  /** Označit jako přečtené – jen v aktuálně viditelném filtru. */
  const markAllAsRead = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const targetIds = filtered.filter(n => !n.is_read).map(n => n.id);
      if (targetIds.length === 0) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in("id", targetIds);

      if (error) throw error;

      const idSet = new Set(targetIds);
      setNotifications(prev => prev.map(n => idSet.has(n.id) ? { ...n, is_read: true } : n));

      toast({
        title: `Označeno jako přečtené (${targetIds.length})`,
      });
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  // Counts per category (na všech datech, ne jen filtru)
  const unreadByCategory = useMemo(() => {
    const counts: Record<FilterCategory, number> = {
      all: 0, probation: 0, training: 0, deadline: 0, medical: 0, other: 0,
    };
    for (const n of notifications) {
      if (n.is_read) continue;
      counts.all++;
      counts[categorize(n)]++;
    }
    return counts;
  }, [notifications]);

  const filtered = useMemo(() => {
    return notifications.filter(n => {
      if (category !== "all" && categorize(n) !== category) return false;
      if (onlyUnread && n.is_read) return false;
      return true;
    });
  }, [notifications, category, onlyUnread]);

  const totalUnread = unreadByCategory.all;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalUnread > 9 ? "9+" : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Oznámení</h4>
          {filtered.some(n => !n.is_read) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={loading}
            >
              <Check className="h-4 w-4 mr-1" />
              Označit zobrazené
            </Button>
          )}
        </div>

        <div className="px-3 pt-3 pb-2 border-b space-y-2">
          <Tabs value={category} onValueChange={(v) => setCategory(v as FilterCategory)}>
            <TabsList className="grid grid-cols-6 h-auto">
              {(Object.keys(CATEGORY_LABELS) as FilterCategory[]).map((c) => (
                <TabsTrigger key={c} value={c} className="text-xs px-1 py-1.5 relative">
                  {CATEGORY_LABELS[c]}
                  {unreadByCategory[c] > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] rounded-full bg-primary text-primary-foreground">
                      {unreadByCategory[c]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center justify-between px-1">
            <Label htmlFor="only-unread" className="text-xs text-muted-foreground cursor-pointer">
              Jen nepřečtené
            </Label>
            <Switch
              id="only-unread"
              checked={onlyUnread}
              onCheckedChange={setOnlyUnread}
            />
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{onlyUnread || category !== "all" ? "Žádná oznámení v tomto filtru" : "Žádná oznámení"}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((notification) => {
                const target = getNotificationTarget(notification);
                const link = target?.href ?? null;
                return (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-accent/50 transition-colors relative group",
                    !notification.is_read && "bg-primary/5",
                    link && "cursor-pointer"
                  )}
                  onClick={() => link && handleNotificationClick(notification)}
                  role={link ? "button" : undefined}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                        notification.is_read ? "bg-muted" : "bg-primary"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.is_read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              title="Označit jako přečtené"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            title="Smazat oznámení"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: cs,
                          })}
                        </p>
                        {target && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick(notification);
                            }}
                          >
                            {target.label}
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
