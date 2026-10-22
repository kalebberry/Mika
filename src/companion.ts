import {
  type State,
  today,
  totals,
  getMoneyOutlook,
  getBeforePaydayCommitments,
  isValidDateString,
} from "./model.ts";
import { money } from "./utils/format.ts";

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

/* ==========================================================================
   Phase 5C: Contextual Outlook Explanations (Deterministic Rules-Based)
   Zero generative AI, zero cloud dependencies, strictly grounded in model data
   ========================================================================== */

export type OutlookTopic =
  | "safe_to_spend"
  | "protected_bills"
  | "commitments"
  | "balance_freshness"
  | "shortfall"
  | "no_commitments";

export type MikaOutlookExplanation = {
  topic: OutlookTopic;
  expression: CompanionExpression;
  title: string;
  text: string;
  detail?: string;
  actionLabel?: string;
  actionDestination?: "Settings" | "Budgets" | "Pots" | "Recurring Bills" | "Accounts" | "Transactions" | "Add transaction";
};

export function getMikaOutlookExplanation(
  s: State,
  topic: OutlookTopic,
  now = today(),
): MikaOutlookExplanation {
  const validNow = isValidDateString(now) ? now : today();
  const tot = totals(s, validNow);
  const outlook = getMoneyOutlook(s, validNow);
  const commitmentsSummary = getBeforePaydayCommitments(s, validNow);

  switch (topic) {
    case "shortfall": {
      if (tot.shortfall > 0 || tot.rawSafe < 0) {
        return {
          topic: "shortfall",
          expression: "concerned",
          title: "Understanding your shortfall",
          text: `Your planned protections exceed your recorded cash by ${money(tot.shortfall)}. Safe to Spend shows $0.00 so you don't overspend, but the actual shortfall is ${money(tot.shortfall)}.`,
          detail: "A small adjustment to a category budget or pot allocation can bring your spending plan back into balance.",
          actionLabel: "Review budgets",
          actionDestination: "Budgets",
        };
      }
      return {
        topic: "shortfall",
        expression: "celebrating",
        title: "No shortfall in your plan",
        text: `Your recorded cash of ${money(tot.balance)} fully covers all ${money(outlook.totalProtections)} in planned protections with ${money(tot.safe)} remaining safe to spend.`,
        actionLabel: "View budgets",
        actionDestination: "Budgets",
      };
    }

    case "safe_to_spend": {
      if (tot.rawSafe < 0) {
        return {
          topic: "safe_to_spend",
          expression: "concerned",
          title: "Safe to Spend with a shortfall",
          text: `Safe to Spend starts with your recorded cash (${money(tot.balance)}) and subtracts ${money(outlook.totalProtections)} in protections, creating a shortfall of ${money(tot.shortfall)}.`,
          detail: "We display $0.00 Safe to Spend so you know new purchases aren't currently covered by available cash.",
          actionLabel: "Review budgets",
          actionDestination: "Budgets",
        };
      }
      return {
        topic: "safe_to_spend",
        expression: "welcome",
        title: "How your Safe to Spend is calculated",
        text: `Safe to Spend starts with your recorded cash (${money(tot.balance)}) and reserves ${money(outlook.totalProtections)} for your pots, budgets, bills, and credit card commitments.`,
        detail: `That leaves ${money(tot.safe)} completely free for your everyday spending until payday.`,
        actionLabel: "Add transaction",
        actionDestination: "Add transaction",
      };
    }

    case "protected_bills": {
      if (tot.bills > 0) {
        return {
          topic: "protected_bills",
          expression: "focused",
          title: "Why upcoming bills are protected",
          text: `We've set aside ${money(tot.bills)} for upcoming bills (${money(tot.currentCycleBills)} this cycle and ${money(tot.protectedCycleBills)} protected for next cycle).`,
          detail: "By locking this money away now, you can spend your remaining Safe to Spend without worrying about bill money disappearing.",
          actionLabel: "See bills",
          actionDestination: "Recurring Bills",
        };
      }
      return {
        topic: "protected_bills",
        expression: "celebrating",
        title: "No upcoming bill reserves needed",
        text: "You have no unpaid bills due before your next payday, so zero cash is currently locked away for bills.",
        actionLabel: "See bills",
        actionDestination: "Recurring Bills",
      };
    }

    case "commitments": {
      if (!commitmentsSummary.hasConfiguredPayday) {
        return {
          topic: "commitments",
          expression: "focused",
          title: "Set up your payday schedule",
          text: "I can show you all upcoming commitments once your payday is set. Add your next payday in Settings to unlock the timeline.",
          actionLabel: "Go to Settings",
          actionDestination: "Settings",
        };
      }
      if (commitmentsSummary.commitments.length > 0) {
        return {
          topic: "commitments",
          expression: "focused",
          title: "Upcoming commitments before payday",
          text: `You have ${commitmentsSummary.commitments.length} commitment(s) totaling ${money(commitmentsSummary.totalCommitmentsAmount)} approaching before payday.`,
          detail: `${money(commitmentsSummary.protectedCommitmentsAmount)} is already protected in Safe to Spend, keeping your day-to-day spending safe.`,
          actionLabel: "View transactions",
          actionDestination: "Transactions",
        };
      }
      return {
        topic: "commitments",
        expression: "celebrating",
        title: "Clear horizon before payday",
        text: "You have no upcoming bills or scheduled expenses due before your next payday. Your spending plan is clear!",
      };
    }

    case "balance_freshness": {
      if (outlook.overallFreshness === "fallback") {
        return {
          topic: "balance_freshness",
          expression: "welcome",
          title: "Using ledger cash baseline",
          text: "You haven't linked checking or savings accounts yet, so Safe to Spend uses your manual opening balance plus ledger transactions.",
          detail: "Linking a checking account in Accounts helps ensure your available cash matches your bank.",
          actionLabel: "Review accounts",
          actionDestination: "Accounts",
        };
      }
      if (outlook.overallFreshness === "stale" || outlook.overallFreshness === "unverified") {
        return {
          topic: "balance_freshness",
          expression: "focused",
          title: "Checking account balance freshness",
          text: "Some of your bank account balances haven't been updated in over 7 days. Verifying your balances in Accounts keeps Safe to Spend reliable.",
          detail: "A quick check-in against your bank app ensures your available cash is accurate.",
          actionLabel: "Update accounts",
          actionDestination: "Accounts",
        };
      }
      return {
        topic: "balance_freshness",
        expression: "celebrating",
        title: "Account balances are fresh",
        text: "Your eligible cash accounts were updated recently. Your Safe to Spend calculations are based on verified numbers.",
        actionLabel: "View accounts",
        actionDestination: "Accounts",
      };
    }

    case "no_commitments": {
      return {
        topic: "no_commitments",
        expression: "celebrating",
        title: "No upcoming commitments",
        text: "There are no recurring bills or scheduled expenses due before your next payday. Your reserves only cover your active budgets and savings pots.",
      };
    }
  }
}
