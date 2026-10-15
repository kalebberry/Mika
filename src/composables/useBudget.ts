import { ref, computed, watch } from "vue";
import {
  type State,
  type Account,
  type AccountType,
  demo,
  resetWorkspace,
  cents,
  today,
  totals,
  spent,
  migrateState,
  getFollowingPayday,
  addDays,
  isBillPaid,
  nextUnpaidDueDate,
  settleBillOccurrence,
  unsettleBillOccurrence,
  isLedgerStatus,
  accountTotals,
  getAccountBalance,
  getAvailableCredit,
  getAccountLedgerDelta,
  getAccountTransactionCount,
  canDeleteAccount,
  getAccountDeletionBlockReason,
  type DeletionBlockReason,
  type CreditCardCoverage,
  type CreditCoverageStatus,
  getCreditCardCoverage,
  getCreditCardCoverageStatus,
  assignCardPaymentReserve as modelAssignCardPaymentReserve,
  releaseCardPaymentReserve as modelReleaseCardPaymentReserve,
  uid,
} from "../model.ts";
import { money } from "../utils/format.ts";
import { useToast } from "./useToast.ts";

export type PageName =
  | "Overview"
  | "Accounts"
  | "Transactions"
  | "Budgets"
  | "Pots"
  | "Recurring Bills"
  | "Settings";

export const navItems: [PageName, string][] = [
  ["Overview", "⌂"],
  ["Accounts", "💳"],
  ["Transactions", "↕"],
  ["Budgets", "◔"],
  ["Pots", "▣"],
  ["Recurring Bills", "▤"],
  ["Settings", "⚙"],
];

const STORAGE_KEY = "budget-companion-v1";

let initialData = demo();
let initialWarning = "";

try {
  if (typeof localStorage !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        (parsed.version === 1 ||
          parsed.version === 2 ||
          parsed.version === 3 ||
          parsed.version === 4) &&
        Array.isArray(parsed.transactions) &&
        Array.isArray(parsed.pots) &&
        Array.isArray(parsed.bills) &&
        Array.isArray(parsed.budgets) &&
        Number.isFinite(parsed.opening)
      ) {
        initialData = migrateState(parsed);
      } else {
        throw new Error("Invalid schema");
      }
    }
  }
} catch {
  initialWarning =
    "Your saved data could not be loaded. Demo data is shown; the previous browser data has not been overwritten.";
}

// Module-level reactive singleton state
const state = ref<State>(initialData);
const storageBlocked = ref(Boolean(initialWarning));
const page = ref<PageName>("Overview");
const collapsed = ref(false);

const search = ref("");
const category = ref("All");
const accountFilter = ref("All");
const sort = ref("Latest");
const statusFilter = ref<"All" | "Scheduled" | "Pending" | "Cleared">("All");

const sum = computed(() => totals(state.value));
const month = computed(() => today().slice(0, 7));
const monthly = computed(() =>
  state.value.transactions.filter(
    (t) => isLedgerStatus(t.status) && t.date.startsWith(month.value),
  ),
);

const income = computed(() =>
  monthly.value
    .filter((t) => (t.kind === "standard" || !t.kind) && t.amount > 0)
    .reduce((n, t) => n + t.amount, 0),
);

const expenses = computed(
  () =>
    -monthly.value
      .filter((t) => (t.kind === "standard" || !t.kind) && t.amount < 0)
      .reduce((n, t) => n + t.amount, 0),
);

const scheduledIncome = computed(() =>
  state.value.transactions
    .filter(
      (t) =>
        t.status === "scheduled" &&
        (t.kind === "standard" || !t.kind) &&
        t.amount > 0 &&
        t.date.startsWith(month.value),
    )
    .reduce((n, t) => n + t.amount, 0),
);

const scheduledExpenses = computed(() =>
  -state.value.transactions
    .filter(
      (t) =>
        t.status === "scheduled" &&
        (t.kind === "standard" || !t.kind) &&
        t.amount < 0 &&
        t.date.startsWith(month.value),
    )
    .reduce((n, t) => n + t.amount, 0),
);

const categories = computed(() =>
  Array.from(
    new Set([
      "Groceries",
      "Dining Out",
      "Entertainment",
      "Personal Care",
      "Transport",
      "Utilities",
      "General",
      "Bills",
      "Income",
      ...state.value.budgets.map((b) => b.category),
      ...state.value.transactions.map((t) => t.category),
    ]),
  ),
);

const list = computed(() =>
  state.value.transactions
    .filter(
      (t) =>
        t.name.toLowerCase().includes(search.value.toLowerCase()) &&
        (category.value === "All" || t.category === category.value) &&
        (accountFilter.value === "All" ||
          t.accountId === accountFilter.value ||
          t.targetAccountId === accountFilter.value ||
          (!t.accountId && accountFilter.value === "acc-default-checking")) &&
        (statusFilter.value === "All" ||
          (statusFilter.value === "Scheduled" && t.status === "scheduled") ||
          (statusFilter.value === "Pending" && (t.status === "pending" || t.status === "posted")) ||
          (statusFilter.value === "Cleared" && t.status === "cleared")),
    )
    .sort((a, b) =>
      sort.value === "Latest"
        ? b.date.localeCompare(a.date)
        : sort.value === "Oldest"
          ? a.date.localeCompare(b.date)
          : Math.abs(b.amount) - Math.abs(a.amount),
    ),
);

const latest = computed(() =>
  [...state.value.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5),
);

const accounts = computed(() => state.value.accounts || []);
const activeAccounts = computed(() => accounts.value.filter((a) => !a.archived));
const archivedAccounts = computed(() => accounts.value.filter((a) => a.archived));
const accountSummary = computed(() => accountTotals(state.value));

const budgetTotal = computed(() =>
  state.value.budgets.reduce((n, b) => n + b.limit, 0),
);

const budgetSpent = computed(() =>
  state.value.budgets.reduce((n, b) => n + spent(state.value, b.category), 0),
);

const ring = computed(() => {
  let p = 0;
  const total = budgetTotal.value || 1;
  return (
    "conic-gradient(" +
    state.value.budgets
      .map((b) => {
        const start = p;
        p += (b.limit / total) * 100;
        return `${b.color} ${start}% ${p}%`;
      })
      .concat(state.value.budgets.length ? [] : ["#eee 0% 100%"])
      .join(",") +
    ")"
  );
});

const days = computed(() =>
  Math.max(
    1,
    Math.ceil(
      (new Date(state.value.payday + "T12:00:00").getTime() -
        new Date(today() + "T12:00:00").getTime()) /
        86400000,
    ),
  ),
);

const categoryRecent = (c: string) =>
  [...monthly.value]
    .filter((t) => t.category === c && t.amount < 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

// Settings form state
const settingsBalance = ref(String(sum.value.balance / 100));
const settingsPayday = ref(state.value.payday);
const settingsFollowingPayday = ref(getFollowingPayday(state.value));
const settingsSaved = ref(false);

watch(
  () => sum.value.balance,
  (newVal) => {
    if (page.value !== "Settings") {
      settingsBalance.value = String(newVal / 100);
    }
  },
);

watch(
  () => state.value.payday,
  (val) => {
    if (page.value !== "Settings") {
      settingsPayday.value = val;
      settingsFollowingPayday.value = getFollowingPayday(state.value);
    }
  },
);

// Watch state changes for local storage persistence
watch(
  state,
  () => {
    if (storageBlocked.value || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
    } catch {
      const { toast } = useToast();
      toast(
        "Changes could not be saved in this browser. Export a backup before closing.",
      );
    }
  },
  { deep: true },
);

export function useBudget() {
  const { toast } = useToast();

  if (initialWarning) {
    toast(initialWarning);
    initialWarning = "";
  }

  function saveSettings() {
    const balance = cents(Number(settingsBalance.value));
    if (
      !Number.isFinite(balance) ||
      !settingsPayday.value ||
      settingsPayday.value < today() ||
      settingsPayday.value >
        String(Number(today().slice(0, 4)) + 1) + today().slice(4)
    ) {
      toast("Enter a valid balance and a payday within the next year.");
      return;
    }
    const postedSum = state.value.transactions
      .filter((t) => isLedgerStatus(t.status))
      .reduce((n, t) => n + t.amount, 0);

    state.value.opening = balance - postedSum;
    state.value.payday = settingsPayday.value;
    state.value.followingPayday =
      settingsFollowingPayday.value || addDays(settingsPayday.value, 14);
    settingsSaved.value = true;
    setTimeout(() => {
      settingsSaved.value = false;
    }, 3000);
    toast("Financial baseline saved.");
  }

  function backup() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state.value, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup downloaded.");
  }

  function importBackup(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.transactions) &&
          Array.isArray(parsed.budgets) &&
          Array.isArray(parsed.pots) &&
          Array.isArray(parsed.bills)
        ) {
          state.value = migrateState(parsed);
          settingsBalance.value = String(totals(state.value).balance / 100);
          settingsPayday.value = state.value.payday;
          settingsFollowingPayday.value = getFollowingPayday(state.value);
          toast("Backup restored successfully.");
        } else {
          toast("File does not match budget backup format.");
        }
      } catch {
        toast("Failed to read or parse backup file.");
      }
    };
    reader.readAsText(file);
  }

  function postTransaction(id: string, targetStatus: "pending" | "cleared" = "cleared") {
    const tx = state.value.transactions.find((t) => t.id === id);
    if (tx) {
      tx.status = targetStatus;
      tx.postedDate = tx.postedDate || today();
      toast(
        targetStatus === "cleared"
          ? (tx.amount > 0
              ? "Income cleared and confirmed."
              : "Expense cleared and confirmed.")
          : "Transaction marked pending.",
      );
    }
  }

  function toggleProtectBill(id: string) {
    const bill = state.value.bills.find((b) => b.id === id);
    if (bill) {
      bill.protected = !bill.protected;
      toast(
        bill.protected
          ? `Protected ${bill.name} for the following pay cycle.`
          : `Removed protection for ${bill.name}.`,
      );
    }
  }

  function settleBill(billId: string, dueDate?: string) {
    const bill = state.value.bills.find((b) => b.id === billId);
    if (!bill) return false;
    const due = dueDate || nextUnpaidDueDate(state.value, bill, today());
    if (isBillPaid(state.value, bill, due)) {
      toast(`${bill.name} (${due}) is already recorded as paid or settled.`);
      return false;
    }
    const ok = settleBillOccurrence(state.value, billId, due);
    if (ok) {
      toast(`Marked ${bill.name} (${due}) settled before setup without deducting cash.`);
    }
    return ok;
  }

  function unsettleBill(billId: string, dueDate: string) {
    unsettleBillOccurrence(state.value, billId, dueDate);
    toast("Settlement removed.");
  }

  function addAccount(accData: {
    name: string;
    type: AccountType;
    balance: number;
    creditLimit?: number;
    dueDay?: number;
    minPayment?: number;
    includeInSafeToSpend?: boolean;
  }) {
    if (!state.value.accounts) state.value.accounts = [];
    const isCredit = accData.type === "credit";
    const newAcc: Account = {
      id: uid(),
      name: accData.name.trim() || (isCredit ? "Credit Card" : "Account"),
      type: accData.type,
      opening: accData.balance,
      balance: accData.balance,
      includeInSafeToSpend: isCredit ? false : Boolean(accData.includeInSafeToSpend),
      archived: false,
      createdAt: today(),
      updatedAt: today(),
    };
    if (isCredit) {
      newAcc.creditLimit = accData.creditLimit ? Math.max(0, accData.creditLimit) : 0;
      if (accData.dueDay) newAcc.dueDay = Math.min(31, Math.max(1, accData.dueDay));
      if (accData.minPayment) newAcc.minPayment = Math.max(0, accData.minPayment);
      newAcc.assignedPaymentReserve = 0;
      newAcc.paymentReservations = [];
      newAcc.coveredCreditBaselineAt = today();
    }
    state.value.accounts.push(newAcc);
    toast(`Added ${newAcc.name}.`);
    return newAcc;
  }

  function updateAccount(
    id: string,
    metadata: {
      name: string;
      creditLimit?: number;
      dueDay?: number;
      minPayment?: number;
      includeInSafeToSpend?: boolean;
    },
  ) {
    const acc = (state.value.accounts || []).find((a) => a.id === id);
    if (!acc) return false;
    acc.name = metadata.name.trim() || acc.name;
    acc.updatedAt = today();

    if (acc.type === "credit") {
      if (metadata.creditLimit !== undefined) {
        acc.creditLimit = Math.max(0, metadata.creditLimit);
      }
      if (metadata.dueDay !== undefined) {
        acc.dueDay = metadata.dueDay ? Math.min(31, Math.max(1, metadata.dueDay)) : undefined;
      }
      if (metadata.minPayment !== undefined) {
        acc.minPayment = metadata.minPayment ? Math.max(0, metadata.minPayment) : undefined;
      }
      acc.includeInSafeToSpend = false;
    } else {
      if (metadata.includeInSafeToSpend !== undefined) {
        acc.includeInSafeToSpend = Boolean(metadata.includeInSafeToSpend);
      }
    }
    toast(`Updated ${acc.name} details.`);
    return true;
  }

  function adjustAccountBalance(id: string, newBalanceCents: number) {
    if (!Number.isFinite(newBalanceCents)) return false;
    const acc = (state.value.accounts || []).find((a) => a.id === id);
    if (!acc) return false;

    const delta = getAccountLedgerDelta(acc, state.value);
    acc.opening = newBalanceCents - delta;
    acc.balance = newBalanceCents;
    acc.updatedAt = today();

    if (acc.id === "acc-default-checking") {
      state.value.opening = acc.opening;
    }
    toast(`Balance for ${acc.name} adjusted.`);
    return true;
  }

  function toggleArchiveAccount(id: string) {
    const acc = (state.value.accounts || []).find((a) => a.id === id);
    if (!acc) return false;
    if (acc.id === "acc-default-checking") {
      toast("The primary checking account cannot be archived.");
      return false;
    }
    acc.archived = !acc.archived;
    acc.updatedAt = today();
    toast(acc.archived ? `Archived ${acc.name}.` : `Restored ${acc.name}.`);
    return true;
  }

  function deleteAccount(id: string): boolean {
    if (id === "acc-default-checking") {
      toast("The primary checking account cannot be deleted.");
      return false;
    }
    const acc = (state.value.accounts || []).find((a) => a.id === id);
    if (!acc) return false;

    const bal = getAccountBalance(acc, state.value);
    if (bal !== 0) {
      toast(
        `Cannot delete ${acc.name} because it has a remaining balance of ${money(bal)}. Accounts must have a $0.00 balance to be deleted. Adjust its balance to $0.00 or archive it instead.`,
      );
      return false;
    }

    const count = getAccountTransactionCount(id, state.value);
    if (count > 0) {
      toast(
        `Cannot delete ${acc.name} because it has ${count} linked transaction${count === 1 ? "" : "s"}. Archive it instead to preserve financial history.`,
      );
      return false;
    }

    const idx = (state.value.accounts || []).findIndex((a) => a.id === id);
    if (idx !== -1) {
      state.value.accounts.splice(idx, 1);
      toast(`Permanently deleted ${acc.name}.`);
      return true;
    }
    return false;
  }

  const activeCreditCards = computed(() =>
    (state.value.accounts || []).filter(
      (a) => !a.archived && a.type === "credit",
    ),
  );

  const creditCardSummary = computed(() => {
    const cards = activeCreditCards.value;
    const coverages = cards.map((a) =>
      getCreditCardCoverage(a, state.value, today()),
    );
    return {
      totalOwed: coverages.reduce((sum, c) => sum + c.totalOwed, 0),
      readyToPay: coverages.reduce((sum, c) => sum + c.readyToPay, 0),
      uncoveredDebt: coverages.reduce((sum, c) => sum + c.uncoveredDebt, 0),
      statementCredit: coverages.reduce((sum, c) => sum + c.statementCredit, 0),
      availableCredit: coverages.reduce((sum, c) => sum + c.availableCredit, 0),
      manualReleasable: coverages.reduce((sum, c) => sum + c.manualReleasable, 0),
      cardCount: cards.length,
      coverages,
    };
  });

  function assignCardPaymentReserve(
    cardOrId: Account | string,
    amount: number,
    now?: string,
  ): boolean {
    const acc =
      typeof cardOrId === "string"
        ? (state.value.accounts || []).find((a) => a.id === cardOrId)
        : cardOrId;
    if (!acc || acc.type !== "credit") {
      toast("Invalid credit card account.");
      return false;
    }
    if (amount <= 0) {
      toast("Enter an amount greater than zero.");
      return false;
    }
    const currentSafe = Math.max(0, sum.value.safe);
    if (amount > currentSafe) {
      toast("This amount exceeds your available Safe to Spend.");
      return false;
    }
    const asOf = now || today();
    const cov = getCreditCardCoverage(acc, state.value, asOf);
    if (cov.uncoveredDebt <= 0) {
      toast(`${acc.name} is already fully covered. No reservation needed.`);
      return false;
    }
    if (amount > cov.uncoveredDebt) {
      toast(
        `Cannot reserve more than the uncovered debt (${money(cov.uncoveredDebt)}).`,
      );
      return false;
    }
    modelAssignCardPaymentReserve(acc, amount, asOf);
    acc.updatedAt = asOf;
    toast(`Reserved ${money(amount)} for ${acc.name}.`);
    return true;
  }

  function releaseCardPaymentReserve(
    cardOrId: Account | string,
    amount: number,
    now?: string,
  ): boolean {
    const acc =
      typeof cardOrId === "string"
        ? (state.value.accounts || []).find((a) => a.id === cardOrId)
        : cardOrId;
    if (!acc || acc.type !== "credit") {
      toast("Invalid credit card account.");
      return false;
    }
    if (amount <= 0) {
      toast("Enter an amount greater than zero.");
      return false;
    }
    const asOf = now || today();
    const cov = getCreditCardCoverage(acc, state.value, asOf);
    if (cov.manualReleasable <= 0) {
      toast("There are no manual reserved funds to release.");
      return false;
    }
    if (amount > cov.manualReleasable) {
      toast(
        `Cannot release more than the manually assigned reserve (${money(cov.manualReleasable)}).`,
      );
      return false;
    }
    const ok = modelReleaseCardPaymentReserve(
      acc,
      amount,
      state.value,
      asOf,
    );
    if (!ok) {
      toast("Cannot release more than the manually assigned reserve.");
      return false;
    }
    acc.updatedAt = asOf;
    toast(`Released ${money(amount)} back to Safe to Spend.`);
    return true;
  }

  function registerModelContext() {
    const context = (document as any).modelContext;
    if (context?.registerTool) {
      try {
        Promise.resolve(
          context.registerTool({
            name: "get_budget_summary",
            description:
              "Read the current balance, reserves and safe-to-spend in integer US cents.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute: () => ({
              ...sum.value,
              demo: state.value.demo,
              payday: state.value.payday,
              followingPayday: getFollowingPayday(state.value),
            }),
          }),
        ).catch(() => {});
      } catch {}
    }
  }

  return {
    state,
    storageBlocked,
    page,
    collapsed,
    search,
    category,
    accountFilter,
    sort,
    statusFilter,
    sum,
    month,
    monthly,
    income,
    expenses,
    scheduledIncome,
    scheduledExpenses,
    categories,
    list,
    latest,
    budgetTotal,
    budgetSpent,
    ring,
    days,
    categoryRecent,
    settingsBalance,
    settingsPayday,
    settingsFollowingPayday,
    settingsSaved,
    saveSettings,
    backup,
    importBackup,
    postTransaction,
    toggleProtectBill,
    settleBill,
    unsettleBill,
    accounts,
    activeAccounts,
    archivedAccounts,
    activeCreditCards,
    accountSummary,
    addAccount,
    updateAccount,
    adjustAccountBalance,
    toggleArchiveAccount,
    deleteAccount,
    getAccountTransactionCount: (accOrId: Account | string) =>
      getAccountTransactionCount(accOrId, state.value),
    canDeleteAccount: (accOrId: Account | string) =>
      canDeleteAccount(accOrId, state.value),
    getAccountDeletionBlockReason: (accOrId: Account | string) =>
      getAccountDeletionBlockReason(accOrId, state.value),
    getAccountBalance: (a: Account) => getAccountBalance(a, state.value),
    getAvailableCredit: (a: Account) => getAvailableCredit(a, state.value),
    creditCardSummary,
    assignCardPaymentReserve,
    releaseCardPaymentReserve,
    getCreditCardCoverage: (accOrId: Account | string, now?: string) => {
      const acc =
        typeof accOrId === "string"
          ? (state.value.accounts || []).find((a) => a.id === accOrId)
          : accOrId;
      if (!acc) {
        return {
          totalOwed: 0,
          readyToPay: 0,
          uncoveredDebt: 0,
          statementCredit: 0,
          availableCredit: 0,
          grossReserve: 0,
          assignedReserve: 0,
          manualReleasable: 0,
          status: "zero_balance" as const,
        };
      }
      return getCreditCardCoverage(acc, state.value, now || today());
    },
    getCreditCardCoverageStatus: (accOrId: Account | string, now?: string) => {
      const acc =
        typeof accOrId === "string"
          ? (state.value.accounts || []).find((a) => a.id === accOrId)
          : accOrId;
      if (!acc) return "zero_balance" as const;
      return getCreditCardCoverage(acc, state.value, now || today()).status;
    },
    registerModelContext,
  };
}
