import { type Bill, type State, isBillPaid, nextDueDate, today } from "../model";

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

export function billStatus(state: State, b: Bill) {
  const next = nextDueDate(b);
  return isBillPaid(state, b, next)
    ? "Paid"
    : next === today()
      ? "Due today"
      : "Upcoming";
}
