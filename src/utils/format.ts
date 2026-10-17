import {
  type Bill,
  type State,
  type PaydayFrequency,
  isBillPaid,
  nextUnpaidDueDate,
  getBillOccurrenceStatus,
  getCurrentPayday,
  getFollowingPayday,
  today,
  isValidDateString,
} from "../model.ts";

export const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    v / 100,
  );

export const date = (v: string) => {
  if (!v || !isValidDateString(v)) return "";
  return new Date(v + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const dateWithDay = (v?: string | null) => {
  if (!v || !isValidDateString(v)) return "";
  return new Date(v + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const frequencyLabel = (freq?: PaydayFrequency): string => {
  switch (freq) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Biweekly";
    case "semimonthly":
      return "Semimonthly";
    case "monthly":
      return "Monthly";
    case "manual":
      return "Manual";
    default:
      return "Schedule";
  }
};

export const formatNextDue = (v: string) => {
  const dt = new Date(v + "T12:00:00");
  const isDiffYear = dt.getFullYear() !== new Date().getFullYear();
  const formatted = dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(isDiffYear ? { year: "numeric" } : {}),
  });
  return `Next due ${formatted}`;
};

export const pct = (a: number, b: number) =>
  Math.min(100, b ? Math.max(0, (a / b) * 100) : 0);

export function billStatus(state: State, b: Bill, now = today()) {
  const next = nextUnpaidDueDate(state, b, now);
  const occ = getBillOccurrenceStatus(state, b, next);
  if (occ.status === "overpaid") {
    return "Overpaid";
  }
  if (occ.status === "paid") {
    return "Paid";
  }
  if (occ.status === "partially_paid") {
    return "Partially paid";
  }
  if (next < now) {
    return "Overdue";
  }
  if (next === now) {
    return "Due today";
  }
  const currentPayday = getCurrentPayday(state, now);
  if (next <= currentPayday) {
    return "Due before payday";
  }
  const followingPayday = getFollowingPayday(state, now);
  if (next <= followingPayday) {
    return b.protected ? "Protected (Next cycle)" : "Next cycle";
  }
  return "Upcoming";
}
