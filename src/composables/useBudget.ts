import { ref, reactive, computed, watch } from "vue";
import {
  type State,
  type Bill,
  type Account,
  type AccountType,
  demo,
  resetWorkspace,
  cents,
  today,
  totals,
  spent,
  migrateState,
  exportBackup,
  validateAndPreviewBackup,
  type BackupEnvelope,
  type RestorePreview,
  CURRENT_SCHEMA_VERSION,
  CURRENT_BACKUP_FORMAT_VERSION,
  getFollowingPayday,
  getCurrentPayday,
  validatePaydaySchedule,
  updatePaydaySchedule,
  applyPaydayOverride,
  removePaydayOverride,
  type PaydaySchedule,
  addDays,
  isBillPaid,
  nextUnpaidDueDate,
  getBillOccurrenceStatus,
  getOrganizedBills,
  getBillItemPresentation,
  getBillTargetOccurrenceDate,
  type BillItemPresentation,
  getDailyAttentionItems,
  getDailySuggestedAction,
  getDailyPaydayPresentation,
  type DailyAttentionItem,
  type DailyAttentionSummary,
  type DailySuggestedAction,
  type DailyPaydayPresentation,
  settleBillOccurrence,
  unsettleBillOccurrence,
  recordBillPayment,
  type TransactionStatus,
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
  type CreditCardMinimumProtection,
  type CreditCardMinimumBreakdown,
  type CreditCardMinimumStatus,
  getCreditCardMinimumProtection,
  getCreditCardMinimumBreakdown,
  confirmCreditCardMinimum,
  unconfirmCreditCardMinimum,
  setCreditCardMinimumObligation,
  getCreditCardMinimumObligation,
  getCreditCardDueDate,
  getPastCreditCardDueDate,
  updateCreditCardMinimumSettings,
  getMonthlyExpenses,
  getMonthlyIncome,
  assignCardPaymentReserve as modelAssignCardPaymentReserve,
  releaseCardPaymentReserve as modelReleaseCardPaymentReserve,
  uid,
  getReportingPeriods,
  getInsightsSpending,
  getMonthComparison,
  getCategoryTrends,
  getSpendingHistory,
  getPreviousMonth,
  getInsightsReconciliation,
  getTransactionInsightsStatus,
  getAccountFreshnessInfo,
  getMoneyOutlook,
  getBeforePaydayCommitments,
  getOutlookExplanation,
  type InsightsSpendingSummary,
  type ReportingPeriod,
  type MonthComparison,
  type CategoryTrend,
  type SpendingHistorySummary,
  type InsightsReconciliation,
  type AccountFreshnessInfo,
  type AccountFreshnessStatus,
  type MoneyOutlookProtectionItem,
  type MoneyOutlookSummary,
  type BeforePaydayCommitment,
  type BeforePaydayCommitmentsSummary,
  type CommitmentProtectionStatus,
  type CommitmentSourceType,
} from "../model.ts";
import {
  getMikaOutlookExplanation,
  type OutlookTopic,
  type MikaOutlookExplanation,
} from "../companion.ts";
import { money } from "../utils/format.ts";
import { useToast } from "./useToast.ts";

export type PageName =
  | "Overview"
  | "Accounts"
  | "Transactions"
  | "Budgets"
  | "Pots"
  | "Recurring Bills"
  | "Insights"
  | "Settings";

export const navItems: [PageName, string][] = [
  ["Overview", "⌂"],
  ["Accounts", "💳"],
  ["Transactions", "↕"],
  ["Budgets", "◔"],
  ["Pots", "▣"],
  ["Recurring Bills", "▤"],
  ["Insights", "▥"],
  ["Settings", "⚙"],
];

const selectedInsightsMonth = ref<string>(today().slice(0, 7));
const insightsSummary = computed(() =>
  getInsightsSpending(state.value, selectedInsightsMonth.value),
);
const reportingPeriods = computed(() => getReportingPeriods());
const monthComparison = computed(() =>
  getMonthComparison(state.value, selectedInsightsMonth.value),
);
const comparisonPrevSummary = computed(() =>
  getInsightsSpending(
    state.value,
    getPreviousMonth(selectedInsightsMonth.value),
  ),
);
const categoryTrends = computed(() =>
  getCategoryTrends(insightsSummary.value, comparisonPrevSummary.value),
);
const spendingHistory = computed(() =>
  getSpendingHistory(state.value, selectedInsightsMonth.value, 6),
);
const activeReconciliation = computed(() => {
  if (category.value === "All" || monthFilter.value === "All") return null;
  return getInsightsReconciliation(state.value, monthFilter.value, category.value);
});

const moneyOutlook = computed(() => getMoneyOutlook(state.value));
const beforePaydayCommitments = computed(() =>
  getBeforePaydayCommitments(state.value),
);
const outlookExplanation = computed(() =>
  getOutlookExplanation(moneyOutlook.value),
);

export const isMobileMenuOpen = ref(false);

export const STORAGE_KEY = "budget-companion-v1";
export const STORAGE_BACKUP_KEY = "budget-companion-v1-backup";
export const STORAGE_CORRUPT_KEY = "budget-companion-v1-corrupt";

export interface StorageHealth {
  status: "healthy" | "quota_exceeded" | "blocked" | "concurrency_warning";
  errorMessage: string;
  lastSavedAt: string | null;
  saveRevision: number;
  hasRollbackSnapshot: boolean;
  rollbackTimestamp: string | null;
  hasCorruptedStash: boolean;
}

let initialData = demo();
let initialWarning = "";
let initialHasCorrupt = false;
let initialHasRollback = false;
let initialRollbackTimestamp: string | null = null;
let initialBlocked = false;

if (typeof localStorage !== "undefined") {
  // Check if corrupted stash exists
  const corruptRaw = localStorage.getItem(STORAGE_CORRUPT_KEY);
  if (corruptRaw) {
    initialHasCorrupt = true;
  }

  // Check if rollback snapshot exists
  const backupRaw = localStorage.getItem(STORAGE_BACKUP_KEY);
  if (backupRaw) {
    initialHasRollback = true;
    try {
      const parsedBackup = JSON.parse(backupRaw);
      if (parsedBackup && parsedBackup.timestamp) {
        initialRollbackTimestamp = parsedBackup.timestamp;
      }
    } catch {
      // ignore
    }
  }

  // Load primary storage
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const validation = validateAndPreviewBackup(raw);
      if (validation.valid && validation.stateToRestore) {
        initialData = validation.stateToRestore;
      } else {
        localStorage.setItem(STORAGE_CORRUPT_KEY, raw);
        initialHasCorrupt = true;
        initialBlocked = true;
        initialWarning =
          validation.error ||
          "Your saved data could not be loaded safely. Demo data is shown in read-only mode so your original browser data is preserved. Download your raw data in Settings to inspect or recover.";
      }
    } catch {
      localStorage.setItem(STORAGE_CORRUPT_KEY, raw);
      initialHasCorrupt = true;
      initialBlocked = true;
      initialWarning =
        "Your saved data could not be loaded. Demo data is shown in read-only mode; your original browser data has been preserved for recovery in Settings.";
    }
  }
}

// Module-level reactive singleton state
const state = ref<State>(initialData);
const storageBlocked = ref(initialBlocked);
export const storageHealth = reactive<StorageHealth>({
  status: initialBlocked ? "blocked" : "healthy",
  errorMessage: initialWarning,
  lastSavedAt: null,
  saveRevision: 0,
  hasRollbackSnapshot: initialHasRollback,
  rollbackTimestamp: initialRollbackTimestamp,
  hasCorruptedStash: initialHasCorrupt,
});

export const pendingRestorePreview = ref<RestorePreview | null>(null);
export const pendingRestoreState = ref<State | null>(null);
const collapsed = ref(false);

const search = ref("");
const category = ref("All");
const accountFilter = ref("All");
const sort = ref("Latest");
const statusFilter = ref<"All" | "Scheduled" | "Pending" | "Cleared">("All");
const monthFilter = ref<string>("All");
const targetedTransactionId = ref<string | null>(null);

const getInitialPage = (): PageName => {
  if (typeof window !== "undefined" && window.location.hash) {
    const raw = window.location.hash.slice(1);
    const [pathPart, queryPart] = raw.split("?");
    const h = (pathPart || "").toLowerCase();
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      const catParam = params.get("category");
      const monthParam = params.get("month");
      if (catParam) category.value = catParam;
      if (monthParam) monthFilter.value = monthParam;
    }
    if (h === "insights") return "Insights";
    if (h === "transactions") return "Transactions";
    if (h === "accounts") return "Accounts";
    if (h === "budgets") return "Budgets";
    if (h === "pots") return "Pots";
    if (h === "recurring-bills") return "Recurring Bills";
    if (h === "settings") return "Settings";
  }
  return "Overview";
};

const page = ref<PageName>(getInitialPage());

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    page.value = getInitialPage();
  });
  watch(page, (p) => {
    const slug = p === "Recurring Bills" ? "recurring-bills" : p.toLowerCase();
    const currentHash = window.location.hash.slice(1).split("?")[0]?.toLowerCase();
    if (currentHash !== slug) {
      window.location.hash = slug;
    }
  });
}

const sum = computed(() => totals(state.value));
const month = computed(() => today().slice(0, 7));
const monthly = computed(() =>
  state.value.transactions.filter(
    (t) => isLedgerStatus(t.status) && t.date.startsWith(month.value),
  ),
);

const income = computed(() => getMonthlyIncome(state.value, month.value));

const expenses = computed(() => getMonthlyExpenses(state.value, month.value));

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
  state.value.transactions
    .filter(
      (t) =>
        t.status === "scheduled" &&
        (t.kind === "standard" || !t.kind) &&
        t.amount < 0 &&
        t.date.startsWith(month.value),
    )
    .reduce((n, t) => n + Math.abs(t.amount), 0),
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

const availableMonths = computed(() => {
  const months = new Set<string>();
  months.add(today().slice(0, 7));
  months.add(getPreviousMonth(today().slice(0, 7)));
  for (const t of state.value.transactions) {
    if (t.date && t.date.length >= 7) {
      months.add(t.date.slice(0, 7));
    }
  }
  return Array.from(months).sort((a, b) => b.localeCompare(a));
});

const list = computed(() =>
  state.value.transactions
    .filter(
      (t) =>
        t.name.toLowerCase().includes(search.value.toLowerCase()) &&
        (category.value === "All" || t.category === category.value) &&
        (monthFilter.value === "All" || t.date.startsWith(monthFilter.value)) &&
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
      (new Date(getCurrentPayday(state.value) + "T12:00:00").getTime() -
        new Date(today() + "T12:00:00").getTime()) /
        86400000,
    ),
  ),
);

const currentPayday = computed(() => getCurrentPayday(state.value));
const followingPayday = computed(() => getFollowingPayday(state.value));

const dailyAttentionSummary = computed(() =>
  getDailyAttentionItems(state.value, today()),
);
const dailySuggestedAction = computed(() =>
  getDailySuggestedAction(state.value, dailyAttentionSummary.value.allCandidates, today()),
);
const dailyPayday = computed(() =>
  getDailyPaydayPresentation(state.value, today()),
);

const categoryRecent = (c: string) =>
  [...monthly.value]
    .filter((t) => t.category === c && t.amount < 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

// Settings form state
const settingsBalance = ref(String(sum.value.balance / 100));
const settingsPayday = ref(getCurrentPayday(state.value));
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
  () => [state.value.payday, state.value.paydaySchedule],
  () => {
    if (page.value !== "Settings") {
      settingsPayday.value = getCurrentPayday(state.value);
      settingsFollowingPayday.value = getFollowingPayday(state.value);
    }
  },
  { deep: true },
);

export function saveCurrentStateToStorage(stateToSave: State): { success: boolean; error?: string } {
  if (storageBlocked.value || typeof localStorage === "undefined") {
    return {
      success: false,
      error: "Storage is currently blocked to prevent overwriting unrecovered data.",
    };
  }
  try {
    const raw = JSON.stringify(stateToSave);
    localStorage.setItem(STORAGE_KEY, raw);
    storageHealth.saveRevision++;
    storageHealth.lastSavedAt = new Date().toISOString();
    if (
      storageHealth.status === "quota_exceeded" ||
      storageHealth.status === "concurrency_warning"
    ) {
      storageHealth.status = "healthy";
      storageHealth.errorMessage = "";
    }
    return { success: true };
  } catch (err: any) {
    const isQuota = err?.name === "QuotaExceededError";
    storageHealth.status = "quota_exceeded";
    storageHealth.errorMessage = isQuota
      ? "Storage quota exceeded. Your changes cannot be saved locally."
      : (err?.message || "Storage write failure.");
    const { toast } = useToast();
    toast(
      isQuota
        ? "Storage quota exceeded: changes cannot be saved in this browser. Export a backup before closing."
        : "Storage write failed: changes cannot be saved in this browser. Export a backup before closing.",
    );
    return { success: false, error: storageHealth.errorMessage };
  }
}

// Watch state changes for local storage persistence
watch(
  state,
  () => {
    saveCurrentStateToStorage(state.value);
  },
  { deep: true },
);

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const validation = validateAndPreviewBackup(e.newValue);
        if (validation.valid && validation.stateToRestore) {
          const currentJson = JSON.stringify(state.value);
          const newJson = JSON.stringify(validation.stateToRestore);
          if (currentJson !== newJson) {
            state.value = validation.stateToRestore;
            settingsBalance.value = String(totals(state.value).balance / 100);
            settingsPayday.value = state.value.payday;
            settingsFollowingPayday.value = getFollowingPayday(state.value);
            storageHealth.lastSavedAt = new Date().toISOString();
            storageHealth.saveRevision++;
            const { toast } = useToast();
            toast("Budget updated with changes from another browser tab.");
          }
        }
      } catch {
        storageHealth.status = "concurrency_warning";
        storageHealth.errorMessage =
          "Another browser tab saved changes that could not be parsed automatically.";
      }
    }
  });
}

export function useBudget() {
  const { toast } = useToast();

  if (initialWarning) {
    toast(initialWarning);
    initialWarning = "";
  }

  function saveSettings() {
    const balance = cents(Number(settingsBalance.value));
    if (!Number.isFinite(balance)) {
      toast("Enter a valid account balance.");
      return;
    }
    const postedSum = state.value.transactions
      .filter((t) => isLedgerStatus(t.status))
      .reduce((n, t) => n + t.amount, 0);

    state.value.opening = balance - postedSum;
    state.value.payday = getCurrentPayday(state.value);
    state.value.followingPayday = getFollowingPayday(state.value);
    settingsSaved.value = true;
    setTimeout(() => {
      settingsSaved.value = false;
    }, 3000);
    toast("Financial baseline saved.");
  }

  function saveSchedule(draft: Partial<PaydaySchedule>) {
    const result = updatePaydaySchedule(state.value, draft);
    if (!result.success) {
      toast(result.message || "Please correct the schedule errors.");
      return result;
    }
    settingsPayday.value = getCurrentPayday(state.value);
    settingsFollowingPayday.value = getFollowingPayday(state.value);
    toast("Payday schedule saved.");
    return result;
  }

  function addScheduleOverride(override: {
    scheduledDate: string;
    overrideDate: string;
    note?: string;
  }): { success: boolean; error?: string } {
    const result = applyPaydayOverride(state.value.paydaySchedule, override);
    if (!result.success) {
      toast(result.error || "Could not add payday override.");
      return { success: false, error: result.error };
    }
    state.value.paydaySchedule = result.schedule;
    state.value.payday = getCurrentPayday(state.value);
    state.value.followingPayday = getFollowingPayday(state.value);
    settingsPayday.value = state.value.payday;
    settingsFollowingPayday.value = state.value.followingPayday;
    toast("Payday override added.");
    return { success: true };
  }

  function removeScheduleOverride(scheduledDateOrId: string) {
    state.value.paydaySchedule = removePaydayOverride(
      state.value.paydaySchedule,
      scheduledDateOrId,
    );
    state.value.payday = getCurrentPayday(state.value);
    state.value.followingPayday = getFollowingPayday(state.value);
    settingsPayday.value = state.value.payday;
    settingsFollowingPayday.value = state.value.followingPayday;
    toast("Payday override removed.");
    return true;
  }

  function createRollbackSnapshot(): boolean {
    if (typeof localStorage === "undefined") return false;
    try {
      const timestamp = new Date().toISOString();
      const payload = JSON.stringify({
        timestamp,
        state: state.value,
      });
      localStorage.setItem(STORAGE_BACKUP_KEY, payload);
      storageHealth.hasRollbackSnapshot = true;
      storageHealth.rollbackTimestamp = timestamp;
      return true;
    } catch {
      return false;
    }
  }

  function restoreRollbackSnapshot(): boolean {
    if (typeof localStorage === "undefined") return false;
    try {
      const raw = localStorage.getItem(STORAGE_BACKUP_KEY);
      if (!raw) {
        toast("No rollback snapshot found.");
        return false;
      }
      const parsed = JSON.parse(raw);
      const stateObj = parsed?.state || parsed;
      const validation = validateAndPreviewBackup(stateObj);
      if (!validation.valid || !validation.stateToRestore) {
        toast("Rollback snapshot could not be validated.");
        return false;
      }
      // Unblock storage if blocked
      storageBlocked.value = false;
      storageHealth.status = "healthy";
      storageHealth.errorMessage = "";

      state.value = validation.stateToRestore;
      saveCurrentStateToStorage(state.value);
      settingsBalance.value = String(totals(state.value).balance / 100);
      settingsPayday.value = state.value.payday;
      settingsFollowingPayday.value = getFollowingPayday(state.value);
      toast("Previous rollback snapshot restored successfully.");
      return true;
    } catch {
      toast("Failed to restore rollback snapshot.");
      return false;
    }
  }

  function downloadCorruptData(): void {
    if (typeof localStorage === "undefined") return;
    const raw =
      localStorage.getItem(STORAGE_CORRUPT_KEY) ||
      localStorage.getItem(STORAGE_KEY) ||
      "";
    if (!raw) {
      toast("No raw unparseable data found in storage.");
      return;
    }
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mika-corrupted-raw-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Raw unparseable data downloaded.");
  }

  function backup() {
    const json = exportBackup(state.value);
    const url = URL.createObjectURL(
      new Blob([json], {
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

  async function prepareRestoreFromFile(
    file: File,
  ): Promise<{ success: boolean; preview?: RestorePreview; error?: string }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const validation = validateAndPreviewBackup(text);
          if (
            !validation.valid ||
            !validation.preview ||
            !validation.stateToRestore
          ) {
            const err =
              validation.error || "File does not match budget backup format.";
            toast(err);
            resolve({ success: false, error: err });
            return;
          }
          pendingRestorePreview.value = validation.preview;
          pendingRestoreState.value = validation.stateToRestore;
          resolve({ success: true, preview: validation.preview });
        } catch {
          const err = "Failed to read or parse backup file.";
          toast(err);
          resolve({ success: false, error: err });
        }
      };
      reader.onerror = () => {
        const err = "Could not read the selected file.";
        toast(err);
        resolve({ success: false, error: err });
      };
      reader.readAsText(file);
    });
  }

  function confirmRestore(): boolean {
    if (!pendingRestoreState.value) {
      toast("No restore data prepared.");
      return false;
    }
    // Automatically create a rollback snapshot of current data before replacement!
    createRollbackSnapshot();

    // Unblock storage if previously blocked
    storageBlocked.value = false;
    storageHealth.status = "healthy";
    storageHealth.errorMessage = "";

    state.value = pendingRestoreState.value;
    saveCurrentStateToStorage(state.value);
    settingsBalance.value = String(totals(state.value).balance / 100);
    settingsPayday.value = state.value.payday;
    settingsFollowingPayday.value = getFollowingPayday(state.value);

    pendingRestorePreview.value = null;
    pendingRestoreState.value = null;

    toast("Backup restored successfully.");
    return true;
  }

  function cancelRestore(): void {
    pendingRestorePreview.value = null;
    pendingRestoreState.value = null;
  }

  async function importBackup(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const res = await prepareRestoreFromFile(file);
    (e.target as HTMLInputElement).value = "";
    return res;
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

  function payBill(
    billId: string,
    options?: {
      dueDate?: string;
      accountId?: string;
      date?: string;
      amount?: number;
      status?: TransactionStatus;
    },
  ) {
    const bill = state.value.bills.find((b) => b.id === billId);
    if (!bill) return null;
    const due = options?.dueDate || nextUnpaidDueDate(state.value, bill, today());
    if (isBillPaid(state.value, bill, due)) {
      toast(`${bill.name} (${due}) is already recorded as paid or settled.`);
      return null;
    }
    const tx = recordBillPayment(state.value, billId, {
      ...options,
      dueDate: due,
    });
    if (tx) {
      const occStatus = getBillOccurrenceStatus(state.value, bill, due);
      if (occStatus.status === "partially_paid") {
        toast(
          `Recorded partial payment of ${money(Math.abs(tx.amount))} for ${tx.name}. ${money(occStatus.remainingAmount)} remaining for ${due}.`,
        );
      } else if (occStatus.status === "overpaid") {
        toast(
          `Recorded payment of ${money(Math.abs(tx.amount))} for ${tx.name}. Overpaid by ${money(occStatus.overpaidAmount)}.`,
        );
      } else {
        toast(`Recorded payment for ${tx.name} (${tx.billDueDate}).`);
      }
    }
    return tx;
  }

  const organizedBills = computed<BillItemPresentation[]>(() =>
    getOrganizedBills(state.value, today()),
  );

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
      lastVerifiedAt: today(),
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
    now = today(),
  ) {
    const acc = (state.value.accounts || []).find((a) => a.id === id);
    if (!acc) return false;
    acc.name = metadata.name.trim() || acc.name;
    acc.updatedAt = now;

    if (acc.type === "credit") {
      if (metadata.creditLimit !== undefined) {
        acc.creditLimit = Math.max(0, metadata.creditLimit);
      }
      if (metadata.dueDay !== undefined) {
        acc.dueDay = metadata.dueDay ? Math.min(31, Math.max(1, metadata.dueDay)) : undefined;
      }
      if (metadata.minPayment !== undefined) {
        const updated = updateCreditCardMinimumSettings(
          acc,
          metadata.minPayment ? Math.max(0, metadata.minPayment) : undefined,
          now,
        );
        acc.minPayment = updated.minPayment;
        acc.minimumObligations = updated.minimumObligations;
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
    acc.lastVerifiedAt = today();

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

  function confirmCardMinimum(accountId: string, dueDate: string) {
    const accIndex = state.value.accounts.findIndex((a) => a.id === accountId);
    if (accIndex === -1) return;
    state.value.accounts[accIndex] = confirmCreditCardMinimum(
      state.value.accounts[accIndex]!,
      dueDate,
    );
  }

  function unconfirmCardMinimum(accountId: string, dueDate: string) {
    const accIndex = state.value.accounts.findIndex((a) => a.id === accountId);
    if (accIndex === -1) return;
    state.value.accounts[accIndex] = unconfirmCreditCardMinimum(
      state.value.accounts[accIndex]!,
      dueDate,
    );
  }

  function setCardMinimumObligation(
    accountId: string,
    dueDate: string,
    amount: number,
  ) {
    const accIndex = state.value.accounts.findIndex((a) => a.id === accountId);
    if (accIndex === -1) return;
    state.value.accounts[accIndex] = setCreditCardMinimumObligation(
      state.value.accounts[accIndex]!,
      dueDate,
      amount,
    );
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

  function navigateToTransaction(txId: string) {
    targetedTransactionId.value = txId;
    category.value = "All";
    accountFilter.value = "All";
    statusFilter.value = "All";
    search.value = "";
    page.value = "Transactions";
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
    targetedTransactionId,
    navigateToTransaction,
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
    currentPayday,
    followingPayday,
    saveSettings,
    saveSchedule,
    addScheduleOverride,
    removeScheduleOverride,
    backup,
    importBackup,
    storageHealth,
    pendingRestorePreview,
    prepareRestoreFromFile,
    confirmRestore,
    cancelRestore,
    createRollbackSnapshot,
    restoreRollbackSnapshot,
    downloadCorruptData,
    saveCurrentStateToStorage,
    postTransaction,
    toggleProtectBill,
    settleBill,
    unsettleBill,
    payBill,
    organizedBills,
    getBillItemPresentation: (bill: Bill, now?: string) =>
      getBillItemPresentation(state.value, bill, now),
    getBillTargetOccurrenceDate: (bill: Bill, now?: string) =>
      getBillTargetOccurrenceDate(state.value, bill, now),
    getBillOccurrenceStatus: (bill: Bill, occurrenceDate?: string) =>
      getBillOccurrenceStatus(state.value, bill, occurrenceDate),
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
    getCreditCardMinimumProtection: (
      accOrId: Account | string,
      now?: string,
    ) => {
      const acc =
        typeof accOrId === "string"
          ? (state.value.accounts || []).find((a) => a.id === accOrId)
          : accOrId;
      if (!acc) {
        const dummyAccount: Account = {
          id: "",
          name: "",
          type: "credit",
          opening: 0,
          includeInSafeToSpend: false,
          createdAt: "",
          updatedAt: "",
        };
        return getCreditCardMinimumProtection(dummyAccount, state.value, now || today());
      }
      return getCreditCardMinimumProtection(acc, state.value, now || today());
    },
    getCreditCardMinimumBreakdown: (now?: string) =>
      getCreditCardMinimumBreakdown(state.value, now || today()),
    confirmCardMinimum,
    unconfirmCardMinimum,
    setCardMinimumObligation,
    updateCreditCardMinimumSettings,
    getPastCreditCardDueDate,
    getMonthlyExpenses: (m = month.value) => getMonthlyExpenses(state.value, m),
    getMonthlyIncome: (m = month.value) => getMonthlyIncome(state.value, m),
    dailyAttentionSummary,
    dailySuggestedAction,
    dailyPayday,
    registerModelContext,
    selectedInsightsMonth,
    insightsSummary,
    reportingPeriods,
    monthComparison,
    comparisonPrevSummary,
    categoryTrends,
    spendingHistory,
    monthFilter,
    availableMonths,
    activeReconciliation,
    getTransactionInsightsStatus,
    getInsightsReconciliation: (m: string, cat: string) =>
      getInsightsReconciliation(state.value, m, cat),
    moneyOutlook,
    beforePaydayCommitments,
    outlookExplanation,
    getMikaOutlookExplanation: (topic: OutlookTopic, now?: string) =>
      getMikaOutlookExplanation(state.value, topic, now),
    getAccountFreshnessInfo: (now?: string) =>
      getAccountFreshnessInfo(state.value, now),
    isMobileMenuOpen,
  };
}
