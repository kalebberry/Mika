import { type State, today, totals } from "./model.ts";
export type CompanionExpression =
  | "welcome"
  | "celebrating"
  | "concerned"
  | "focused";
export const companionPortraits: Record<CompanionExpression, string> = {
  welcome: "/images/mika.png?v=2",
  celebrating: "/images/mika-celebrating.png?v=2",
  concerned: "/images/mika-concerned.png?v=2",
  focused: "/images/mika-focused.png?v=2",
};
export type CompanionMessage = {
  expression: CompanionExpression;
  title: string;
  text: string;
  action: string;
  destination: "Settings" | "Budgets" | "Pots" | "Add transaction";
};
export function companionMessage(s: State, now = today()): CompanionMessage {
  if (!s.demo && !s.transactions.length && s.opening === 0)
    return {
      expression: "welcome",
      title: "A fresh start, together.",
      text: "Let’s begin with your current balance and next payday. One small step is enough.",
      action: "Set my balance",
      destination: "Settings",
    };
  if (s.payday < now)
    return {
      expression: "focused",
      title: "Time to refresh your plan.",
      text: "Your payday has passed. Update the next date so your spending plan stays useful.",
      action: "Update payday",
      destination: "Settings",
    };
  const tot = totals(s, now);
  if (tot.shortfall > 0 || tot.rawSafe < 0)
    return {
      expression: "concerned",
      title: "Let’s make a little room.",
      text: "Your reserves are above your balance. Take a moment to review your budgets, pots, and bills.",
      action: "Review budgets",
      destination: "Budgets",
    };
  const goal = s.pots.find((p) => p.target > 0 && p.saved >= p.target);
  if (goal)
    return {
      expression: "celebrating",
      title: "You reached a goal!",
      text: `Your “${goal.name}” pot has reached its target. That’s progress worth noticing.`,
      action: "See my pots",
      destination: "Pots",
    };
  if (!s.demo && s.transactions.some((t) => t.date === now))
    return {
      expression: "welcome",
      title: "One less thing to remember.",
      text: "You’ve recorded activity today. Add anything else when you’re ready.",
      action: "Add a transaction",
      destination: "Add transaction",
    };
  return {
    expression: "welcome",
    title: "Ready for a quick money check?",
    text: s.demo
      ? "I’m Mika. Explore the demo, then start with your own numbers whenever you’re ready."
      : "Start with one purchase. A small check-in counts, even after a few days away.",
    action: "Add a transaction",
    destination: "Add transaction",
  };
}
