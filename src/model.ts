export type TransactionStatus = "scheduled" | "pending" | "cleared" | "posted";
export type TransactionKind = "standard" | "transfer" | "payment";

export function isLedgerStatus(status?: string): boolean {
  return status === "pending" || status === "cleared" || status === "posted";
}

export type Transaction = {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  billId?: string;
  billDueDate?: string;
  status?: TransactionStatus;
  postedDate?: string;
  accountId?: string;
  kind?: TransactionKind;
  targetAccountId?: string;
  isLegacyDebt?: boolean;
  createdAt?: string;
};

export type Budget = {
  id: string;
  name?: string;
  category: string;
  limit: number;
  color: string;
};

export type Pot = {
  id: string;
  name: string;
  saved: number;
  target: number;
  color: string;
};

export type Bill = {
  id: string;
  name: string;
  amount: number;
  day: number;
  protected?: boolean;
  settledDueDates?: string[];
};

export type BillSettlement = {
  billId: string;
  dueDate: string;
  settledAt?: string;
};

export type AccountType = "checking" | "savings" | "credit";

export interface PaymentReservation {
  id: string;
  amount: number; // Integer cents: positive = reserve added, negative = reserve released
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  opening: number; // Integer cents. Baseline opening balance for the account
  balance?: number; // Integer cents. For manual accounts without transaction ledgers, holds current balance
  creditLimit?: number; // Integer cents (credit card only)
  dueDay?: number; // 1-31 (credit card only)
  minPayment?: number; // Integer cents (credit card only)
  includeInSafeToSpend: boolean; // True for primary checking, default false for savings/credit
  archived?: boolean; // Soft-delete / hide from active views
  createdAt: string;
  updatedAt: string;
  assignedPaymentReserve?: number; // Integer cents (credit card only). Current net manual reserve
  paymentReservations?: PaymentReservation[]; // Chronological manual reservation entries
  coveredCreditBaselineAt?: string; // ISO timestamp of baseline
}

export type State = {
  version: 2 | 3 | 4;
  demo: boolean;
  opening: number;
  payday: string;
  followingPayday?: string;
  transactions: Transaction[];
  budgets: Budget[];
  pots: Pot[];
  bills: Bill[];
  settledBills?: BillSettlement[];
  accounts: Account[];
};

export interface ThemeColor {
  name: string;
  value: string;
}

export const themeColors: ThemeColor[] = [
  { name: "Teal (Green)", value: "#277c78" },
  { name: "Cyan (Sky)", value: "#82c9d7" },
  { name: "Slate (Navy)", value: "#626070" },
  { name: "Peach (Yellow)", value: "#f2cdac" },
  { name: "Purple (Lavender)", value: "#826cb0" },
  { name: "Turquoise", value: "#597c7c" },
  { name: "Coral (Red)", value: "#c94736" },
  { name: "Magenta (Berry)", value: "#934f6f" },
  { name: "Blue (Cobalt)", value: "#3f82b2" },
  { name: "Gold (Amber)", value: "#cab361" },
  { name: "Orange (Terracotta)", value: "#be6c49" },
  { name: "Army Green", value: "#7f9161" },
  { name: "Rose Pink", value: "#af81ba" },
  { name: "Steel Grey", value: "#97a0ac" },
  { name: "Brown (Tan)", value: "#93674f" },
  { name: "Emerald (Forest)", value: "#1e824c" },
];

export const colors = themeColors.map((tc) => tc.value);

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const cents = (v: number) => Math.round(v * 100);
export const uid = () => crypto.randomUUID();

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function nextPayday() {
  return addDays(today(), 14);
}

export function getFollowingPayday(s: { payday: string; followingPayday?: string }): string {
  return s.followingPayday || addDays(s.payday, 14);
}

export function hasAccountLedgerActivity(account: Account, s: State): boolean {
  if (!s.transactions || !Array.isArray(s.transactions)) return false;
  return s.transactions.some((t) => {
    if (!isLedgerStatus(t.status)) return false;
    if (account.id === "acc-default-checking" && !t.accountId) return true;
    return t.accountId === account.id || t.targetAccountId === account.id;
  });
}

export function getAccountTransactionCount(account: Account | string, s: State): number {
  if (!s.transactions || !Array.isArray(s.transactions)) return 0;
  const accId = typeof account === "string" ? account : account.id;
  return s.transactions.filter(
    (t) =>
      t.accountId === accId ||
      t.targetAccountId === accId ||
      (!t.accountId && accId === "acc-default-checking"),
  ).length;
}

export type DeletionBlockReason =
  | "primary_checking"
  | "has_balance"
  | "has_transactions"
  | null;

export function getAccountDeletionBlockReason(
  account: Account | string,
  s: State,
): DeletionBlockReason {
  const accId = typeof account === "string" ? account : account.id;
  if (accId === "acc-default-checking") return "primary_checking";
  const acc = (s.accounts || []).find((a) => a.id === accId);
  if (!acc) return null;
  if (getAccountBalance(acc, s) !== 0) return "has_balance";
  if (getAccountTransactionCount(accId, s) > 0) return "has_transactions";
  return null;
}

export function canDeleteAccount(account: Account | string, s: State): boolean {
  return getAccountDeletionBlockReason(account, s) === null;
}

export function getAccountLedgerDelta(account: Account, s: State): number {
  if (!s.transactions || !Array.isArray(s.transactions)) return 0;

  let delta = 0;
  for (const t of s.transactions) {
    if (!isLedgerStatus(t.status)) continue;
    const kind = t.kind || "standard";
    const absAmt = Math.abs(t.amount);

    if (account.type === "credit") {
      // Credit card: balance represents debt owed
      if (kind === "standard") {
        const isThisAccount =
          t.accountId === account.id ||
          (!t.accountId && account.id === "acc-default-checking");
        if (isThisAccount) {
          if (t.amount < 0) {
            delta += absAmt; // Expense / purchase increases debt owed
          } else {
            delta -= absAmt; // Refund / credit reduces debt owed
          }
        }
      } else if (kind === "payment") {
        if (t.targetAccountId === account.id) {
          delta -= absAmt; // Payment to this card reduces debt owed
        }
      }
    } else {
      // Cash accounts (checking / savings): balance represents cash assets
      if (kind === "standard") {
        const isThisAccount =
          t.accountId === account.id ||
          (!t.accountId && account.id === "acc-default-checking");
        if (isThisAccount) {
          delta += t.amount;
        }
      } else if (kind === "transfer") {
        if (t.accountId === account.id) {
          delta -= absAmt; // Outflow from source
        }
        if (t.targetAccountId === account.id) {
          delta += absAmt; // Inflow to destination
        }
      } else if (kind === "payment") {
        if (t.accountId === account.id) {
          delta -= absAmt; // Cash payment outflow
        }
      }
    }
  }
  return delta;
}

export function getAccountBalance(account: Account, s: State): number {
  const delta = getAccountLedgerDelta(account, s);
  if (account.id === "acc-default-checking") {
    const opening =
      account.opening !== 0
        ? account.opening
        : s && typeof s.opening === "number"
          ? s.opening
          : account.opening;
    return opening + delta;
  }
  if (hasAccountLedgerActivity(account, s)) {
    return account.opening + delta;
  }
  return account.balance !== undefined ? account.balance : account.opening;
}

export function getAvailableCredit(account: Account, s?: State): number {
  if (account.type !== "credit") return 0;
  const currentBalance = s ? getAccountBalance(account, s) : (account.balance !== undefined ? account.balance : account.opening);
  const limit = account.creditLimit || 0;
  return Math.max(0, limit - currentBalance);
}

export function accountTotals(s: State) {
  const accounts = s.accounts || [];
  const activeAccounts = accounts.filter((a) => !a.archived);
  const cashAccounts = activeAccounts.filter((a) => a.type === "checking" || a.type === "savings");
  const creditAccounts = activeAccounts.filter((a) => a.type === "credit");

  const totalCashAssets = cashAccounts.reduce((sum, a) => sum + getAccountBalance(a, s), 0);
  const totalCreditDebt = creditAccounts.reduce((sum, a) => sum + Math.max(0, getAccountBalance(a, s)), 0);
  const totalAvailableCredit = creditAccounts.reduce((sum, a) => sum + getAvailableCredit(a, s), 0);

  return {
    totalCashAssets,
    totalCreditDebt,
    totalAvailableCredit,
    activeCount: activeAccounts.length,
    archivedCount: accounts.length - activeAccounts.length,
  };
}

export type CreditCoverageStatus =
  | "zero_balance"
  | "statement_credit"
  | "fully_covered"
  | "partially_covered"
  | "uncovered";

export function getCreditCardCoverageStatus(coverage: {
  totalOwed: number;
  readyToPay: number;
  uncoveredDebt: number;
  statementCredit: number;
}): CreditCoverageStatus {
  if (coverage.statementCredit > 0) return "statement_credit";
  if (coverage.totalOwed === 0) return "zero_balance";
  if (coverage.uncoveredDebt === 0) return "fully_covered";
  if (coverage.readyToPay > 0) return "partially_covered";
  return "uncovered";
}

export interface CreditCardCoverage {
  totalOwed: number; // Current liability (Math.max(0, balance))
  readyToPay: number; // Actual cash reserved in checking for repayment
  uncoveredDebt: number; // Math.max(0, totalOwed - readyToPay)
  statementCredit: number; // Math.max(0, -balance)
  availableCredit: number; // Math.max(0, limit - balance)
  grossReserve: number; // Total reserve in pool before clamping
  assignedReserve: number; // Net manual reservations
  manualReleasable: number; // Actual remaining manual reserve eligible for release
  status: CreditCoverageStatus;
}

export function getCreditCardCoverage(
  account: Account,
  s: State,
  now = today(),
): CreditCardCoverage {
  if (account.type !== "credit") {
    return {
      totalOwed: 0,
      readyToPay: 0,
      uncoveredDebt: 0,
      statementCredit: 0,
      availableCredit: 0,
      grossReserve: 0,
      assignedReserve: 0,
      manualReleasable: 0,
      status: "zero_balance",
    };
  }

  const currentBalance = getAccountBalance(account, s);
  const totalOwed = Math.max(0, currentBalance);
  const statementCredit = Math.max(0, -currentBalance);

  const manualEntries = Array.isArray(account.paymentReservations)
    ? [...account.paymentReservations]
    : [];

  if (manualEntries.length === 0 && (account.assignedPaymentReserve || 0) > 0) {
    manualEntries.push({
      id: "baseline-reserve",
      amount: account.assignedPaymentReserve || 0,
      date: (account.updatedAt || account.createdAt || now).slice(0, 10),
      createdAt: account.updatedAt || account.createdAt || now,
    });
  }

  const assignedReserve = manualEntries.reduce((sum, r) => sum + r.amount, 0);

  const allCardTransactions = (s.transactions || []).filter(
    (t) =>
      isLedgerStatus(t.status) &&
      (t.accountId === account.id || t.targetAccountId === account.id),
  );

  interface TimelineEvent {
    type: "purchase" | "payment" | "manual_reserve" | "refund";
    amount: number;
    category?: string;
    date: string;
    createdAt: string;
    isLegacyDebt?: boolean;
    txId?: string;
  }

  const events: TimelineEvent[] = [];

  for (const t of allCardTransactions) {
    const kind = t.kind || "standard";
    const absAmt = Math.abs(t.amount);
    const createdAt = t.createdAt || t.postedDate || t.date;

    if (kind === "payment" && t.targetAccountId === account.id) {
      events.push({
        type: "payment",
        amount: absAmt,
        date: t.date,
        createdAt,
        txId: t.id,
      });
    } else if (kind === "standard" && t.accountId === account.id) {
      if (t.amount < 0) {
        events.push({
          type: "purchase",
          amount: absAmt,
          category: t.category,
          date: t.date,
          createdAt,
          isLegacyDebt: Boolean(t.isLegacyDebt),
          txId: t.id,
        });
      } else if (t.amount > 0) {
        events.push({
          type: "refund",
          amount: absAmt,
          category: t.category,
          date: t.date,
          createdAt,
          txId: t.id,
        });
      }
    }
  }

  for (const r of manualEntries) {
    events.push({
      type: "manual_reserve",
      amount: r.amount,
      date: r.date,
      createdAt: r.createdAt || r.date,
    });
  }

  const typePriority = { refund: 1, purchase: 2, manual_reserve: 3, payment: 4 };
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const tsA = a.createdAt.length === 10 ? `${a.createdAt}T00:00:00.000Z` : a.createdAt;
    const tsB = b.createdAt.length === 10 ? `${b.createdAt}T00:00:00.000Z` : b.createdAt;
    if (tsA !== tsB) return tsA.localeCompare(tsB);
    return typePriority[a.type] - typePriority[b.type];
  });

  const categoryBudgetSpentMap = new Map<string, number>();

  let runningCardLiability = account.opening;
  let reservePool = 0;

  interface ReserveLot {
    type: "auto" | "manual";
    amount: number;
  }
  const reserveLots: ReserveLot[] = [];

  for (const ev of events) {
    if (ev.type === "refund") {
      runningCardLiability -= ev.amount;
    } else if (ev.type === "purchase") {
      runningCardLiability += ev.amount;

      // Legacy debt transactions never auto-fund
      const isEligible =
        !ev.isLegacyDebt &&
        (!account.coveredCreditBaselineAt ||
          ev.date >= account.coveredCreditBaselineAt.slice(0, 7));

      if (isEligible) {
        // Purchases when card is in statement credit absorb that credit first
        const liabilityBefore = runningCardLiability - ev.amount;
        const absorbsCredit =
          liabilityBefore < 0
            ? Math.min(ev.amount, Math.abs(liabilityBefore))
            : 0;
        const netRequiringCoverage = ev.amount - absorbsCredit;

        if (netRequiringCoverage > 0) {
          const month = ev.date.slice(0, 7);
          const cat = ev.category || "General";
          const key = `${month}:${cat.toLowerCase()}`;
          const budget = (s.budgets || []).find(
            (b) => b.category.toLowerCase() === cat.toLowerCase(),
          );

          let coveredPortion = 0;
          if (budget) {
            const limit = budget.limit;
            const alreadyUsed = categoryBudgetSpentMap.get(key) || 0;
            const remaining = Math.max(0, limit - alreadyUsed);
            coveredPortion = Math.min(netRequiringCoverage, remaining);
            categoryBudgetSpentMap.set(key, alreadyUsed + coveredPortion);
          } else {
            coveredPortion = 0;
          }

          reservePool += coveredPortion;
          if (coveredPortion > 0) {
            reserveLots.push({ type: "auto", amount: coveredPortion });
          }
        }
      }
    } else if (ev.type === "payment") {
      runningCardLiability -= ev.amount;
      const consumed = Math.min(reservePool, ev.amount);
      reservePool -= consumed;
      let toConsume = ev.amount;
      for (let i = 0; i < reserveLots.length; i++) {
        const lot = reserveLots[i]!;
        if (toConsume <= 0) break;
        const take = Math.min(lot.amount, toConsume);
        lot.amount -= take;
        toConsume -= take;
      }
    } else if (ev.type === "manual_reserve") {
      reservePool = Math.max(0, reservePool + ev.amount);
      if (ev.amount > 0) {
        reserveLots.push({ type: "manual", amount: ev.amount });
      } else if (ev.amount < 0) {
        let toRelease = Math.abs(ev.amount);
        for (let i = reserveLots.length - 1; i >= 0; i--) {
          const lot = reserveLots[i]!;
          if (lot.type === "manual") {
            const take = Math.min(lot.amount, toRelease);
            lot.amount -= take;
            toRelease -= take;
            if (toRelease <= 0) break;
          }
        }
      }
    }
  }

  const manualReservePool = reserveLots
    .filter((l) => l.type === "manual")
    .reduce((sum, l) => sum + l.amount, 0);
  const autoReservePool = reserveLots
    .filter((l) => l.type === "auto")
    .reduce((sum, l) => sum + l.amount, 0);

  const readyToPay = Math.max(0, Math.min(totalOwed, reservePool));
  const uncoveredDebt = Math.max(0, totalOwed - readyToPay);
  const availableCredit = getAvailableCredit(account, s);
  const manualInReadyToPay = Math.max(0, readyToPay - autoReservePool);
  const manualReleasable = Math.max(0, Math.min(manualReservePool, manualInReadyToPay));
  const status = getCreditCardCoverageStatus({
    totalOwed,
    readyToPay,
    uncoveredDebt,
    statementCredit,
  });

  return {
    totalOwed,
    readyToPay,
    uncoveredDebt,
    statementCredit,
    availableCredit,
    grossReserve: reservePool,
    assignedReserve,
    manualReleasable,
    status,
  };
}

export function assignCardPaymentReserve(
  account: Account,
  amount: number,
  now = today(),
): void {
  if (account.type !== "credit" || amount <= 0) return;
  if (!Array.isArray(account.paymentReservations)) {
    account.paymentReservations = [];
  }
  const dateStr = now.slice(0, 10);
  const createdStr = now.length > 10 ? now : `${dateStr}T00:00:00.000Z`;
  const entry: PaymentReservation = {
    id: uid(),
    amount,
    date: dateStr,
    createdAt: createdStr,
  };
  account.paymentReservations.push(entry);
  account.assignedPaymentReserve = account.paymentReservations.reduce(
    (sum, r) => sum + r.amount,
    0,
  );
  account.updatedAt = createdStr;
}

export function releaseCardPaymentReserve(
  account: Account,
  amount: number,
  s: State,
  now = today(),
): boolean {
  if (account.type !== "credit" || amount <= 0) return false;
  const coverage = getCreditCardCoverage(account, s, now);
  if (amount > coverage.manualReleasable) return false;

  if (!Array.isArray(account.paymentReservations)) {
    account.paymentReservations = [];
  }
  const dateStr = now.slice(0, 10);
  const createdStr = now.length > 10 ? now : `${dateStr}T00:00:00.000Z`;
  const entry: PaymentReservation = {
    id: uid(),
    amount: -amount,
    date: dateStr,
    createdAt: createdStr,
  };
  account.paymentReservations.push(entry);
  account.assignedPaymentReserve = account.paymentReservations.reduce(
    (sum, r) => sum + r.amount,
    0,
  );
  account.updatedAt = createdStr;
  return true;
}

export function blank(): State {
  const payday = nextPayday();
  const d = today();
  return {
    version: 4,
    demo: false,
    opening: 0,
    payday,
    followingPayday: addDays(payday, 14),
    transactions: [],
    budgets: [],
    pots: [],
    bills: [],
    settledBills: [],
    accounts: [
      {
        id: "acc-default-checking",
        name: "Primary Checking",
        type: "checking",
        opening: 0,
        includeInSafeToSpend: true,
        archived: false,
        createdAt: d,
        updatedAt: d,
      },
    ],
  };
}

export function demo(): State {
  const d = today();
  const payday = nextPayday();
  return {
    version: 4,
    demo: true,
    opening: 285675,
    payday,
    followingPayday: addDays(payday, 14),
    transactions: [
      {
        id: "t1",
        name: "Paycheck",
        amount: 240000,
        category: "Income",
        date: d,
        status: "posted",
        accountId: "acc-default-checking",
        kind: "standard",
      },
      {
        id: "t2",
        name: "Weekly groceries",
        amount: -8635,
        category: "Groceries",
        date: d,
        status: "posted",
        accountId: "acc-default-checking",
        kind: "standard",
      },
      {
        id: "t3",
        name: "Savory Bites Bistro",
        amount: -5550,
        category: "Dining Out",
        date: d,
        status: "posted",
        accountId: "acc-default-checking",
        kind: "standard",
      },
      {
        id: "t4",
        name: "Internet",
        amount: -10000,
        category: "Bills",
        date: d,
        billId: "b2",
        status: "posted",
        accountId: "acc-default-checking",
        kind: "standard",
      },
      {
        id: "t5",
        name: "Game night",
        amount: -1500,
        category: "Entertainment",
        date: d,
        status: "posted",
        accountId: "acc-default-checking",
        kind: "standard",
      },
      {
        id: "t6",
        name: "Coffee stop",
        amount: -690,
        category: "Dining Out",
        date: d,
        status: "posted",
        accountId: "acc-default-checking",
        kind: "standard",
      },
    ],
    budgets: [
      {
        id: "u1",
        name: "Groceries",
        category: "Groceries",
        limit: 40000,
        color: colors[0]!,
      },
      {
        id: "u2",
        name: "Dining Out",
        category: "Dining Out",
        limit: 15000,
        color: colors[1]!,
      },
      {
        id: "u3",
        name: "Entertainment",
        category: "Entertainment",
        limit: 10000,
        color: colors[2]!,
      },
    ],
    pots: [
      {
        id: "p1",
        name: "Rainy day",
        saved: 50000,
        target: 200000,
        color: colors[0]!,
      },
      {
        id: "p2",
        name: "Next adventure",
        saved: 25000,
        target: 150000,
        color: colors[2]!,
      },
      {
        id: "p3",
        name: "Gifts",
        saved: 10000,
        target: 30000,
        color: colors[1]!,
      },
    ],
    bills: [
      { id: "b1", name: "Rent", amount: 130000, day: 1, protected: true, settledDueDates: [] },
      { id: "b2", name: "Internet", amount: 10000, day: new Date().getDate(), protected: false, settledDueDates: [] },
      { id: "b3", name: "Phone", amount: 5500, day: 12, protected: false, settledDueDates: [] },
    ],
    settledBills: [],
    accounts: [
      {
        id: "acc-default-checking",
        name: "Primary Checking",
        type: "checking",
        opening: 285675,
        includeInSafeToSpend: true,
        archived: false,
        createdAt: d,
        updatedAt: d,
      },
      {
        id: "acc-demo-savings",
        name: "Emergency Savings",
        type: "savings",
        opening: 450000,
        balance: 450000,
        includeInSafeToSpend: false,
        archived: false,
        createdAt: d,
        updatedAt: d,
      },
      {
        id: "acc-demo-credit",
        name: "Mika Rewards Visa",
        type: "credit",
        opening: 35000,
        balance: 35000,
        creditLimit: 200000,
        dueDay: 22,
        minPayment: 3500,
        includeInSafeToSpend: false,
        archived: false,
        createdAt: d,
        updatedAt: d,
        assignedPaymentReserve: 0,
        paymentReservations: [],
        coveredCreditBaselineAt: d,
      },
    ],
  };
}

export const spent = (
  s: State,
  category: string,
  month = today().slice(0, 7),
): number => {
  const transactions = (s.transactions || []).filter(
    (t) =>
      isLedgerStatus(t.status) &&
      t.category.toLowerCase() === category.toLowerCase() &&
      t.date.startsWith(month) &&
      (t.kind === "standard" || !t.kind) &&
      !t.isLegacyDebt,
  );

  let cashPurchases = 0;
  let cashRefunds = 0;
  let creditPurchases = 0;
  let creditRefunds = 0;

  for (const t of transactions) {
    const acc = (s.accounts || []).find(
      (a) => a.id === (t.accountId || "acc-default-checking"),
    );
    const isCredit = acc ? acc.type === "credit" : false;
    const absAmt = Math.abs(t.amount);

    if (t.amount < 0) {
      if (isCredit) {
        creditPurchases += absAmt;
      } else {
        cashPurchases += absAmt;
      }
    } else if (t.amount > 0) {
      if (isCredit) {
        creditRefunds += absAmt;
      } else {
        cashRefunds += absAmt;
      }
    }
  }

  // Account isolation: cash refunds offset cash purchases; credit refunds offset credit purchases.
  // Credit card statement credits cannot offset cash purchases or create cash spending availability.
  const netCash = Math.max(0, cashPurchases - cashRefunds);
  const netCredit = Math.max(0, creditPurchases - creditRefunds);

  return netCash + netCredit;
};

export function dueDate(b: Bill, month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(Math.min(b.day, new Date(y!, m!, 0).getDate())).padStart(2, "0")}`;
}

export function getBillDueDate(b: Bill, year: number, month: number): string {
  const daysInMonth = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(Math.max(1, b.day || 1), daysInMonth);
  return `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export function nextDueDate(b: Bill, fromDate = today()): string {
  const [y, m] = fromDate.split("-").map(Number);
  const currentMonthDue = getBillDueDate(b, y!, m!);

  if (currentMonthDue >= fromDate) {
    return currentMonthDue;
  }

  const nextY = m === 12 ? y! + 1 : y!;
  const nextM = m === 12 ? 1 : m! + 1;
  return getBillDueDate(b, nextY, nextM);
}

export function isBillSettled(
  s: State,
  b: Bill,
  occurrenceDate: string,
): boolean {
  if (Array.isArray(b.settledDueDates) && b.settledDueDates.includes(occurrenceDate)) {
    return true;
  }
  if (
    Array.isArray(s.settledBills) &&
    s.settledBills.some((sb) => sb.billId === b.id && sb.dueDate === occurrenceDate)
  ) {
    return true;
  }
  return false;
}

export function isBillPaid(
  s: State,
  b: Bill,
  occurrenceDate = nextDueDate(b, today()),
): boolean {
  if (isBillSettled(s, b, occurrenceDate)) {
    return true;
  }
  return s.transactions.some(
    (t) =>
      isLedgerStatus(t.status) &&
      t.billId === b.id &&
      (t.billDueDate === occurrenceDate ||
        (!t.billDueDate && t.date.startsWith(occurrenceDate.slice(0, 7)))),
  );
}

export function settleBillOccurrence(
  s: State,
  billId: string,
  occurrenceDate: string,
): boolean {
  const bill = s.bills.find((b) => b.id === billId);
  if (!bill) return false;

  // Prevent duplicate payment or settlement
  if (isBillPaid(s, bill, occurrenceDate)) {
    return false;
  }

  if (!Array.isArray(bill.settledDueDates)) {
    bill.settledDueDates = [];
  }
  if (!bill.settledDueDates.includes(occurrenceDate)) {
    bill.settledDueDates.push(occurrenceDate);
  }

  if (!Array.isArray(s.settledBills)) {
    s.settledBills = [];
  }
  if (!s.settledBills.some((sb) => sb.billId === billId && sb.dueDate === occurrenceDate)) {
    s.settledBills.push({ billId, dueDate: occurrenceDate, settledAt: today() });
  }

  return true;
}

export function unsettleBillOccurrence(
  s: State,
  billId: string,
  occurrenceDate: string,
): boolean {
  const bill = s.bills.find((b) => b.id === billId);
  if (bill && Array.isArray(bill.settledDueDates)) {
    bill.settledDueDates = bill.settledDueDates.filter((d) => d !== occurrenceDate);
  }
  if (Array.isArray(s.settledBills)) {
    s.settledBills = s.settledBills.filter(
      (sb) => !(sb.billId === billId && sb.dueDate === occurrenceDate),
    );
  }
  return true;
}

export function nextUnpaidDueDate(
  s: State,
  b: Bill,
  fromDate = today(),
): string {
  const [startY, startM] = fromDate.split("-").map(Number);
  let y = startY!;
  let m = startM!;

  for (let i = 0; i < 24; i++) {
    const due = getBillDueDate(b, y, m);
    if (i === 0 && due < fromDate) {
      if (!isBillPaid(s, b, due)) {
        return due;
      }
    } else if (due >= fromDate) {
      if (!isBillPaid(s, b, due)) {
        return due;
      }
    }
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return getBillDueDate(b, y, m);
}

export const paid = (s: State, b: Bill, month = today().slice(0, 7)): boolean => {
  const due = dueDate(b, month);
  return isBillPaid(s, b, due);
};

export const isBillUnpaidThisMonth = (
  s: State,
  b: Bill,
  now = today(),
): boolean => {
  const currentMonth = now.slice(0, 7);
  const thisMonthDue = dueDate(b, currentMonth);
  // If the occurrence for this month is already paid or settled, it is not unpaid this month
  if (isBillPaid(s, b, thisMonthDue)) {
    return false;
  }
  // If the next unpaid occurrence is in a future month (e.g. next month / next cycle), it is not unpaid this month
  const nextUnpaid = nextUnpaidDueDate(s, b, now);
  if (nextUnpaid.slice(0, 7) > currentMonth) {
    return false;
  }
  return true;
};

export type BillReservationDetail = {
  bill: Bill;
  dueDate: string;
  amount: number;
  cycle: "current" | "following_protected";
};

export function reserveBillsBreakdown(
  s: State,
  now = today(),
): {
  currentCycleBills: number;
  protectedCycleBills: number;
  total: number;
  details: BillReservationDetail[];
} {
  const currentPaydayEnd = s.payday >= now ? s.payday : now;
  const followingEnd = getFollowingPayday(s);

  let currentCycleBills = 0;
  let protectedCycleBills = 0;
  const details: BillReservationDetail[] = [];

  for (const b of s.bills) {
    const due = nextUnpaidDueDate(s, b, now);
    if (isBillPaid(s, b, due)) continue;

    if (due <= currentPaydayEnd) {
      currentCycleBills += b.amount;
      details.push({
        bill: b,
        dueDate: due,
        amount: b.amount,
        cycle: "current",
      });
    } else if (due <= followingEnd && b.protected) {
      protectedCycleBills += b.amount;
      details.push({
        bill: b,
        dueDate: due,
        amount: b.amount,
        cycle: "following_protected",
      });
    }
  }

  return {
    currentCycleBills,
    protectedCycleBills,
    total: currentCycleBills + protectedCycleBills,
    details,
  };
}

export function reserveBills(s: State, now = today()): number {
  return reserveBillsBreakdown(s, now).total;
}

export function getUncoveredScheduledExpenses(s: State, now = today()): number {
  const currentMonth = now.slice(0, 7);
  const currentPaydayEnd = s.payday >= now ? s.payday : now;
  const scheduledExpensesByCategory = new Map<string, number>();

  for (const t of s.transactions) {
    if (
      t.status === "scheduled" &&
      t.amount < 0 &&
      (t.kind === "standard" || !t.kind)
    ) {
      if (t.date > currentPaydayEnd) continue;
      if (t.billId) continue;
      if (t.category.toLowerCase() === "bills") continue;

      const cat = t.category;
      scheduledExpensesByCategory.set(
        cat,
        (scheduledExpensesByCategory.get(cat) || 0) + Math.abs(t.amount),
      );
    }
  }

  let uncovered = 0;
  for (const [cat, schedAmt] of scheduledExpensesByCategory.entries()) {
    const budget = s.budgets.find(
      (b) => b.category.toLowerCase() === cat.toLowerCase(),
    );
    if (budget) {
      const remainingBudget = Math.max(
        0,
        budget.limit - spent(s, budget.category, currentMonth),
      );
      if (schedAmt > remainingBudget) {
        uncovered += schedAmt - remainingBudget;
      }
    } else {
      uncovered += schedAmt;
    }
  }

  return uncovered;
}

export function totals(s: State, now = today()) {
  const ledgerTransactions = s.transactions.filter(
    (t) => isLedgerStatus(t.status),
  );
  const scheduledTransactions = s.transactions.filter(
    (t) => t.status === "scheduled",
  );

  const eligibleCashAccounts = (s.accounts || []).filter(
    (a) =>
      !a.archived &&
      (a.type === "checking" || a.type === "savings") &&
      a.includeInSafeToSpend,
  );

  const balance =
    eligibleCashAccounts.length > 0
      ? eligibleCashAccounts.reduce((sum, a) => sum + getAccountBalance(a, s), 0)
      : s.opening + ledgerTransactions.reduce((n, t) => n + t.amount, 0);

  const scheduledIncome = scheduledTransactions
    .filter((t) => (t.kind === "standard" || !t.kind) && t.amount > 0)
    .reduce((n, t) => n + t.amount, 0);

  const scheduledExpenses = Math.abs(
    scheduledTransactions
      .filter((t) => (t.kind === "standard" || !t.kind) && t.amount < 0)
      .reduce((n, t) => n + t.amount, 0),
  );

  const pots = s.pots.reduce((n, p) => n + p.saved, 0);
  const budgets = s.budgets.reduce(
    (n, b) =>
      n + Math.max(0, b.limit - spent(s, b.category, now.slice(0, 7))),
    0,
  );
  const billBreakdown = reserveBillsBreakdown(s, now);
  const bills = billBreakdown.total;
  const uncoveredScheduledExpenses = getUncoveredScheduledExpenses(s, now);

  const creditCardAccounts = (s.accounts || []).filter(
    (a) => !a.archived && a.type === "credit",
  );
  const creditCoverage = creditCardAccounts.map((a) =>
    getCreditCardCoverage(a, s, now),
  );
  const totalReadyToPay = creditCoverage.reduce(
    (sum, c) => sum + c.readyToPay,
    0,
  );
  const totalCreditOwed = creditCoverage.reduce(
    (sum, c) => sum + c.totalOwed,
    0,
  );
  const totalUncoveredDebt = creditCoverage.reduce(
    (sum, c) => sum + c.uncoveredDebt,
    0,
  );
  const totalStatementCredits = creditCoverage.reduce(
    (sum, c) => sum + c.statementCredit,
    0,
  );

  const rawSafe =
    balance - pots - budgets - bills - uncoveredScheduledExpenses - totalReadyToPay;
  const safe = Math.max(0, rawSafe);
  const shortfall = rawSafe < 0 ? Math.abs(rawSafe) : 0;

  return {
    balance,
    pots,
    budgets,
    bills,
    currentCycleBills: billBreakdown.currentCycleBills,
    protectedCycleBills: billBreakdown.protectedCycleBills,
    uncoveredScheduledExpenses,
    scheduledIncome,
    scheduledExpenses,
    totalReadyToPay,
    totalCreditOwed,
    totalUncoveredDebt,
    totalStatementCredits,
    rawSafe,
    safe,
    shortfall,
  };
}

export function migrateState(raw: any, now = today()): State {
  if (!raw || typeof raw !== "object") {
    return blank();
  }

  const isV4 = raw.version === 4;
  const creditAccountIds = new Set<string>();
  if (Array.isArray(raw.accounts)) {
    for (const a of raw.accounts) {
      if (a && a.type === "credit" && a.id) {
        creditAccountIds.add(String(a.id));
      }
    }
  }

  const transactions: Transaction[] = Array.isArray(raw.transactions)
    ? raw.transactions.map((t: any) => {
        const isFuture = typeof t.date === "string" && t.date > now;
        let status: TransactionStatus;
        if (t.status === "scheduled") {
          status = "scheduled";
        } else if (t.status === "cleared") {
          status = "cleared";
        } else if (t.status === "pending") {
          status = "pending";
        } else if (t.status === "posted") {
          // Requirement 11: Do not automatically classify old posted transactions as bank-reconciled
          status = "pending";
        } else {
          status = isFuture ? "scheduled" : "pending";
        }
        const kind: TransactionKind =
          t.kind === "transfer" || t.kind === "payment" ? t.kind : "standard";

        const accountId = t.accountId ? String(t.accountId) : "acc-default-checking";
        const isCreditTx = creditAccountIds.has(accountId);
        const isLegacyDebt = isV4 ? Boolean(t.isLegacyDebt) : isCreditTx;

        return {
          id: String(t.id || uid()),
          name: String(t.name || ""),
          amount: Number(t.amount) || 0,
          category: String(
            t.category ||
              (kind === "transfer"
                ? "Transfer"
                : kind === "payment"
                  ? "Payment"
                  : "General"),
          ),
          date: String(t.date || now),
          billId: t.billId ? String(t.billId) : undefined,
          billDueDate: t.billDueDate ? String(t.billDueDate) : undefined,
          status,
          postedDate: t.postedDate ? String(t.postedDate) : undefined,
          accountId,
          kind,
          targetAccountId: t.targetAccountId ? String(t.targetAccountId) : undefined,
          isLegacyDebt,
          createdAt: t.createdAt ? String(t.createdAt) : undefined,
        };
      })
    : [];

  const bills: Bill[] = Array.isArray(raw.bills)
    ? raw.bills.map((b: any) => ({
        id: String(b.id || uid()),
        name: String(b.name || ""),
        amount: Number(b.amount) || 0,
        day: Number(b.day) || 1,
        protected: Boolean(b.protected),
        settledDueDates: Array.isArray(b.settledDueDates)
          ? b.settledDueDates.map(String)
          : [],
      }))
    : [];

  const settledBills: BillSettlement[] = Array.isArray(raw.settledBills)
    ? raw.settledBills.map((sb: any) => ({
        billId: String(sb.billId),
        dueDate: String(sb.dueDate),
        settledAt: sb.settledAt ? String(sb.settledAt) : undefined,
      }))
    : [];

  const budgets: Budget[] = Array.isArray(raw.budgets)
    ? raw.budgets.map((b: any) => ({
        id: String(b.id || uid()),
        name: b.name ? String(b.name) : undefined,
        category: String(b.category || "General"),
        limit: Number(b.limit) || 0,
        color: String(b.color || colors[0]),
      }))
    : [];

  const pots: Pot[] = Array.isArray(raw.pots)
    ? raw.pots.map((p: any) => ({
        id: String(p.id || uid()),
        name: String(p.name || ""),
        saved: Number(p.saved) || 0,
        target: Number(p.target) || 0,
        color: String(p.color || colors[0]),
      }))
    : [];

  const payday = typeof raw.payday === "string" ? raw.payday : nextPayday();
  const followingPayday =
    typeof raw.followingPayday === "string"
      ? raw.followingPayday
      : addDays(payday, 14);

  const rawOpening = Number(raw.opening) || 0;
  let accounts: Account[] = [];

  if (Array.isArray(raw.accounts) && raw.accounts.length > 0) {
    accounts = raw.accounts.map((a: any) => {
      const isCredit = a.type === "credit";
      const isPrimaryChecking = a.id === "acc-default-checking";
      const type: AccountType =
        a.type === "savings" || a.type === "credit" ? a.type : "checking";

      const opening = isPrimaryChecking
        ? rawOpening
        : a.opening !== undefined
          ? Number(a.opening)
          : a.balance !== undefined
            ? Number(a.balance)
            : 0;

      const acc: Account = {
        id: String(a.id || uid()),
        name: String(a.name || (isCredit ? "Credit Card" : "Account")),
        type,
        opening,
        includeInSafeToSpend: isCredit
          ? false
          : a.includeInSafeToSpend !== undefined
            ? Boolean(a.includeInSafeToSpend)
            : isPrimaryChecking,
        archived: Boolean(a.archived),
        createdAt: String(a.createdAt || now),
        updatedAt: String(a.updatedAt || now),
      };
      if (a.balance !== undefined) {
        acc.balance = Number(a.balance);
      }
      if (isCredit) {
        acc.creditLimit = Number(a.creditLimit) || 0;
        if (a.dueDay) {
          acc.dueDay = Math.min(31, Math.max(1, Number(a.dueDay)));
        }
        if (a.minPayment !== undefined) {
          acc.minPayment = Number(a.minPayment);
        }
        acc.assignedPaymentReserve = isV4 ? (Number(a.assignedPaymentReserve) || 0) : 0;
        acc.paymentReservations = (isV4 && Array.isArray(a.paymentReservations))
          ? a.paymentReservations.map((pr: any) => ({
              id: String(pr.id || uid()),
              amount: Number(pr.amount) || 0,
              date: String(pr.date || now),
              createdAt: String(pr.createdAt || now),
            }))
          : [];
        acc.coveredCreditBaselineAt = (isV4 && a.coveredCreditBaselineAt)
          ? String(a.coveredCreditBaselineAt)
          : now;
      }
      return acc;
    });
  } else {
    // Phase 1 Migration: convert existing single cash balance into a default checking account
    accounts = [
      {
        id: "acc-default-checking",
        name: "Primary Checking",
        type: "checking",
        opening: rawOpening,
        includeInSafeToSpend: true,
        archived: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  // Ensure there is at least one safe-to-spend cash account
  if (!accounts.some((a) => a.includeInSafeToSpend && !a.archived && a.type !== "credit")) {
    const primary =
      accounts.find((a) => a.type === "checking" && !a.archived) ||
      accounts.find((a) => a.type === "checking");
    if (primary) {
      primary.includeInSafeToSpend = true;
    }
  }

  const version: 2 | 3 | 4 = (raw.version === 1 || raw.version === 2) ? 2 : 4;

  return {
    version,
    demo: Boolean(raw.demo),
    opening: rawOpening,
    payday,
    followingPayday,
    transactions,
    budgets,
    pots,
    bills,
    settledBills,
    accounts,
  };
}

export function resetWorkspace(current: State, keepPlan: boolean): State {
  const fresh = blank();
  if (keepPlan) {
    fresh.budgets = current.budgets.map((b) => ({ ...b }));
    fresh.bills = current.bills.map((b) => ({ ...b }));
    fresh.accounts = (current.accounts || []).map((a) => ({ ...a }));
  }
  return fresh;
}
