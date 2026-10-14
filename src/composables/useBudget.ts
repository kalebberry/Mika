import { ref, computed, watch } from "vue";
import {
  type State,
  demo,
  resetWorkspace,
  cents,
  today,
  totals,
  spent,
} from "../model";
import { useToast } from "./useToast";

export type PageName =
  | "Overview"
  | "Transactions"
  | "Budgets"
  | "Pots"
  | "Recurring Bills"
  | "Settings";

export const navItems: [PageName, string][] = [
  ["Overview", "⌂"],
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
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (
      parsed.version === 1 &&
      Array.isArray(parsed.transactions) &&
      Array.isArray(parsed.pots) &&
      Array.isArray(parsed.bills) &&
      Array.isArray(parsed.budgets) &&
      Number.isFinite(parsed.opening)
    ) {
      initialData = parsed;
    } else {
      throw new Error("Invalid schema");
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
const sort = ref("Latest");

const sum = computed(() => totals(state.value));
const month = computed(() => today().slice(0, 7));
const monthly = computed(() =>
  state.value.transactions.filter((t) => t.date.startsWith(month.value)),
);

const income = computed(() =>
  monthly.value.filter((t) => t.amount > 0).reduce((n, t) => n + t.amount, 0),
);

const expenses = computed(
  () =>
    -monthly.value
      .filter((t) => t.amount < 0)
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
        (category.value === "All" || t.category === category.value),
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
    }
  },
);

// Watch state changes for local storage persistence
watch(
  state,
  () => {
    if (storageBlocked.value) return;
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
    state.value.opening =
      balance - state.value.transactions.reduce((n, t) => n + t.amount, 0);
    state.value.payday = settingsPayday.value;
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
          state.value = parsed;
          settingsBalance.value = String(totals(parsed).balance / 100);
          settingsPayday.value = parsed.payday || today();
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
    sort,
    sum,
    month,
    monthly,
    income,
    expenses,
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
    settingsSaved,
    saveSettings,
    backup,
    importBackup,
    registerModelContext,
  };
}
