// Shared reminder cadence logic used by send-training-reminders,
// run-deadline-reminders and run-medical-reminders so all three modules behave
// identically, regardless of how often the underlying cron actually invokes them.
//
// Instead of "send again if nothing was sent in the last N days" (which, run
// continuously, ends up firing repeatedly all the way through the pre-expiration
// window too), each record moves through three discrete, one-shot stages:
//
//   'before'  - exactly one reminder, the first time the record enters its
//               remind_days_before window (still in the future).
//   'due'     - exactly one reminder on/after the exact expiration day.
//   'overdue' - repeating reminders after expiration, spaced by the record's
//               own repeat_days_after (not "every time the cron happens to run").
//
// The function is pure and only needs to know: how many days until expiration,
// the record's own thresholds, and the reminder_logs rows already sent for that
// specific record (status = 'sent', is_test = false). It is safe to call on
// every cron tick — if a stage was already reached, it returns null and nothing
// is sent again. It is also safe to miss a run entirely (e.g. downtime): the
// next run catches up on whichever stage is due instead of silently skipping it
// forever.

export type ReminderStage = "before" | "due" | "overdue";

export interface StageLogEntry {
  reminder_stage: ReminderStage | null;
  created_at: string;
}

export function resolveReminderStage(
  daysUntil: number,
  remindDaysBefore: number,
  repeatDaysAfter: number,
  recentLogs: StageLogEntry[],
): ReminderStage | null {
  const hasStage = (stage: ReminderStage) => recentLogs.some(l => l.reminder_stage === stage);

  // Too early — outside the configured "remind me before" window.
  if (daysUntil > remindDaysBefore) return null;

  // Still before the expiration date: send the single "heads up" reminder once.
  if (daysUntil > 0) {
    return hasStage("before") ? null : "before";
  }

  // Exactly on (or freshly past, e.g. after downtime) the expiration day with no
  // "due"/"overdue" reminder sent yet at all — this is the one-shot "it expires
  // today" / catch-up notice.
  if (!hasStage("due") && !hasStage("overdue")) {
    return "due";
  }

  // Already past the initial due notice. Repeat only every repeat_days_after
  // days, measured from the most recent overdue (or due) reminder.
  if (repeatDaysAfter <= 0) return null;

  const lastSent = recentLogs
    .filter(l => l.reminder_stage === "overdue" || l.reminder_stage === "due")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  if (!lastSent) return "overdue"; // defensive fallback, shouldn't normally hit

  const daysSinceLastSent = Math.floor(
    (Date.now() - new Date(lastSent.created_at).getTime()) / (1000 * 60 * 60 * 24),
  );

  return daysSinceLastSent >= repeatDaysAfter ? "overdue" : null;
}
