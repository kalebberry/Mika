import {
  type Bill,
  type State,
  isBillPaid,
  nextUnpaidDueDate,
  getFollowingPayday,
  today,
} from "../model.ts";

export const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    v / 100,
  );

export const date = (v: string) =>
  new Date(v + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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
  if (isBillPaid(state, b, next)) {
    return "Paid";
  }
  if (next < now) {
    return "Overdue";
  }
  if (next === now) {
    return "Due today";
  }
  if (next <= state.payday) {
    return "Due before payday";
  }
  const followingPayday = getFollowingPayday(state);
  if (next <= followingPayday) {
    return b.protected ? "Protected (Next cycle)" : "Next cycle";
  }
  return "Upcoming";
}
