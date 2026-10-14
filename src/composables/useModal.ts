import { ref } from "vue";
import {
  colors,
  themeColors,
  today,
  uid,
  cents,
  resetWorkspace,
  nextUnpaidDueDate,
  isBillPaid,
  settleBillOccurrence,
  type TransactionStatus,
} from "../model";
import { useBudget } from "./useBudget";
import { useToast } from "./useToast";
import { useCompanion } from "./useCompanion";

export interface ModalFormState {
  name: string;
  amount: string;
  category: string;
  date: string;
  type: string;
  target: string;
  day: number;
  color: string;
  opening: string;
  payday: string;
  protected?: boolean;
  status?: TransactionStatus;
  customCategory?: string;
  customColor?: string;
  accountType?: "checking" | "savings" | "credit";
  creditLimit?: string;
  dueDay?: number;
  minPayment?: string;
  includeInSafeToSpend?: boolean;
}

const dialogRef = ref<HTMLDialogElement | null>(null);
const mode = ref("");
const selected = ref("");
const error = ref("");
const resetChoice = ref<"keep" | "all">("keep");
const resetConfirmed = ref(false);
const focusBefore = ref<HTMLElement | null>(null);
const payMethod = ref<"transaction" | "settled">("transaction");

const form = ref<ModalFormState>({
  name: "",
  amount: "",
  category: "Groceries",
  date: today(),
  type: "Expense",
  target: "",
  day: 1,
  color: colors[0]!,
  opening: "",
  payday: "",
  protected: false,
  status: "posted",
  customCategory: "",
  accountType: "checking",
  creditLimit: "",
  dueDay: 1,
  minPayment: "",
  includeInSafeToSpend: true,
});

export function useModal() {
  const {
    state,
    storageBlocked,
    page,
    sum,
    postTransaction,
    addAccount,
    updateAccount,
    adjustAccountBalance,
    deleteAccount,
    getAccountBalance,
  } = useBudget();
  const { toast } = useToast();
  const { showCompanion } = useCompanion();

  function open(m: string, id = "", defaultCategory = "") {
    if (m === "Settings") {
      page.value = "Settings";
      return;
    }
    if (m === "Start fresh") {
      resetChoice.value = state.value.demo ? "all" : "keep";
      resetConfirmed.value = false;
    }
    mode.value = m;
    selected.value = id;
    error.value = "";
    focusBefore.value = document.activeElement as HTMLElement;
    payMethod.value = m === "Settle bill" ? "settled" : "transaction";

    let initialColor = colors[0]!;
    if (m === "Add budget") {
      const usedBudgetColors = state.value.budgets.map((b) => b.color.toLowerCase());
      const available = themeColors.find(
        (tc) => !usedBudgetColors.includes(tc.value.toLowerCase()),
      );
      initialColor = available
        ? available.value
        : colors[state.value.budgets.length % colors.length]!;
    } else if (m === "Add pot") {
      const usedPotColors = state.value.pots.map((p) => p.color.toLowerCase());
      const available = themeColors.find(
        (tc) => !usedPotColors.includes(tc.value.toLowerCase()),
      );
      initialColor = available
        ? available.value
        : colors[state.value.pots.length % colors.length]!;
    }

    form.value = {
      name: "",
      amount: "",
      category: defaultCategory || "Groceries",
      date: today(),
      type: "Expense",
      target: "",
      day: 1,
      color: initialColor,
      opening: String(sum.value.balance / 100),
      payday: state.value.payday,
      protected: false,
      status: "cleared",
      customCategory: "",
      customColor: initialColor,
    };

    if (m === "Edit transaction") {
      const t = state.value.transactions.find((item) => item.id === id);
      if (t) {
        const rawStatus = t.status;
        const normalizedStatus: TransactionStatus =
          rawStatus === "scheduled"
            ? "scheduled"
            : rawStatus === "cleared"
              ? "cleared"
              : "pending";
        form.value = {
          ...form.value,
          name: t.name,
          amount: String(Math.abs(t.amount) / 100),
          category: t.category,
          date: t.date,
          type: t.amount > 0 ? "Income" : "Expense",
          status: normalizedStatus,
        };
      }
    } else if (m === "Edit budget") {
      const b = state.value.budgets.find((item) => item.id === id);
      if (b) {
        form.value = {
          ...form.value,
          name: b.name || b.category,
          category: b.category,
          amount: String(b.limit / 100),
          color: b.color,
          customColor: b.color,
        };
      }
    } else if (m === "Edit bill") {
      const b = state.value.bills.find((item) => item.id === id);
      if (b) {
        form.value = {
          ...form.value,
          name: b.name,
          amount: String(b.amount / 100),
          day: b.day,
          protected: Boolean(b.protected),
        };
      }
    } else if (m === "Add account") {
      form.value = {
        ...form.value,
        name: "",
        amount: "0.00",
        accountType: "checking",
        creditLimit: "",
        dueDay: 1,
        minPayment: "",
        includeInSafeToSpend: true,
      };
    } else if (m === "Edit account") {
      const acc = (state.value.accounts || []).find((item) => item.id === id);
      if (acc) {
        form.value = {
          ...form.value,
          name: acc.name,
          accountType: acc.type,
          creditLimit:
            acc.creditLimit !== undefined ? String(acc.creditLimit / 100) : "",
          dueDay: acc.dueDay || 1,
          minPayment:
            acc.minPayment !== undefined ? String(acc.minPayment / 100) : "",
          includeInSafeToSpend: Boolean(acc.includeInSafeToSpend),
        };
      }
    } else if (m === "Adjust balance") {
      const acc = (state.value.accounts || []).find((item) => item.id === id);
      if (acc) {
        const bal = getAccountBalance(acc);
        form.value = {
          ...form.value,
          name: acc.name,
          amount: String(Math.abs(bal) / 100),
          accountType: acc.type,
        };
      }
    }

    dialogRef.value?.showModal();
  }

  function close() {
    dialogRef.value?.close();
    focusBefore.value?.focus();
  }

  function submit() {
    error.value = "";
    const f = form.value;
    const amount = cents(Number(f.amount));
    const target = cents(Number(f.target));
    const name = f.name.trim();

    if (mode.value === "Add account") {
      if (!name) {
        error.value = "Enter an account name.";
        return;
      }
      const initialBal = cents(Number(f.amount || 0));
      if (!Number.isFinite(initialBal) || initialBal < 0) {
        error.value = "Enter a valid balance ($0.00 or greater).";
        return;
      }
      const isCredit = f.accountType === "credit";
      let limitCents: number | undefined;
      let minPayCents: number | undefined;
      if (isCredit) {
        limitCents = cents(Number(f.creditLimit || 0));
        if (!Number.isFinite(limitCents) || limitCents < 0) {
          error.value = "Enter a valid credit limit ($0.00 or greater).";
          return;
        }
        if (f.minPayment) {
          minPayCents = cents(Number(f.minPayment));
          if (!Number.isFinite(minPayCents) || minPayCents < 0) {
            error.value = "Enter a valid minimum payment.";
            return;
          }
        }
      }
      addAccount({
        name,
        type: f.accountType || "checking",
        balance: initialBal,
        creditLimit: limitCents,
        dueDay: isCredit && f.dueDay ? Number(f.dueDay) : undefined,
        minPayment: minPayCents,
        includeInSafeToSpend: isCredit
          ? false
          : Boolean(f.includeInSafeToSpend),
      });
      close();
      return;
    }

    if (mode.value === "Edit account") {
      if (!name) {
        error.value = "Enter an account name.";
        return;
      }
      const acc = (state.value.accounts || []).find((a) => a.id === selected.value);
      if (!acc) return;
      const isCredit = acc.type === "credit";
      let limitCents: number | undefined;
      let minPayCents: number | undefined;
      if (isCredit) {
        if (f.creditLimit !== undefined && f.creditLimit !== "") {
          limitCents = cents(Number(f.creditLimit));
          if (!Number.isFinite(limitCents) || limitCents < 0) {
            error.value = "Enter a valid credit limit ($0.00 or greater).";
            return;
          }
        }
        if (f.minPayment !== undefined && f.minPayment !== "") {
          minPayCents = cents(Number(f.minPayment));
          if (!Number.isFinite(minPayCents) || minPayCents < 0) {
            error.value = "Enter a valid minimum payment.";
            return;
          }
        }
      }
      updateAccount(selected.value, {
        name,
        creditLimit: limitCents,
        dueDay: isCredit && f.dueDay ? Number(f.dueDay) : undefined,
        minPayment: minPayCents,
        includeInSafeToSpend: isCredit
          ? false
          : Boolean(f.includeInSafeToSpend),
      });
      close();
      return;
    }

    if (mode.value === "Adjust balance") {
      const newBal = cents(Number(f.amount || 0));
      if (!Number.isFinite(newBal) || newBal < 0) {
        error.value = "Enter a valid balance ($0.00 or greater).";
        return;
      }
      adjustAccountBalance(selected.value, newBal);
      close();
      return;
    }

    if (mode.value === "Delete account") {
      deleteAccount(selected.value);
      close();
      return;
    }

    if (
      [
        "Add transaction",
        "Edit transaction",
        "Add budget",
        "Edit budget",
        "Add bill",
        "Edit bill",
        "Add money",
        "Withdraw",
      ].includes(mode.value) &&
      (!Number.isFinite(amount) || amount <= 0 || amount > 10000000000)
    ) {
      error.value = "Enter an amount greater than zero.";
      return;
    }

    if (
      [
        "Add transaction",
        "Edit transaction",
        "Add pot",
        "Add bill",
        "Edit bill",
      ].includes(mode.value) &&
      !name
    ) {
      error.value = "Enter a name.";
      return;
    }

    const resolvedCategory =
      f.category === "__custom__"
        ? (f.customCategory || "").trim()
        : f.category.trim();

    if (mode.value === "Add transaction" || mode.value === "Edit transaction") {
      if (f.date > today() && f.status === "cleared") {
        error.value =
          "Future-dated transactions cannot be marked as Cleared. Use Scheduled or Pending until confirmed by your bank.";
        return;
      }
    }

    if (mode.value === "Add transaction") {
      const isFuture = f.date > today();
      const status: TransactionStatus =
        f.status || (isFuture ? "scheduled" : "cleared");
      state.value.transactions.unshift({
        id: uid(),
        name,
        amount: f.type === "Income" ? amount : -amount,
        category: f.type === "Income" ? "Income" : (resolvedCategory || "General"),
        date: f.date,
        status,
        postedDate: status !== "scheduled" ? f.date : undefined,
      });
    } else if (mode.value === "Edit transaction") {
      const existing = state.value.transactions.find(
        (t) => t.id === selected.value,
      );
      if (existing) {
        const isFuture = f.date > today();
        const status: TransactionStatus =
          f.status || (isFuture ? "scheduled" : "cleared");

        Object.assign(existing, {
          name,
          amount: f.type === "Income" ? amount : -amount,
          category: f.type === "Income" ? "Income" : (resolvedCategory || "General"),
          date: f.date,
          status,
          postedDate: status !== "scheduled" ? existing.postedDate || f.date : undefined,
        });
      }
    } else if (mode.value === "Post transaction") {
      postTransaction(selected.value);
    } else if (mode.value === "Add budget" || mode.value === "Edit budget") {
      if (!resolvedCategory) {
        error.value = "Enter or select a category name.";
        return;
      }
      if (resolvedCategory.toLowerCase() === "bills") {
        error.value =
          "Fixed bills (Rent, Internet) are reserved in Recurring Bills. Use 'Utilities' or a specific name like 'Electricity' for variable bills.";
        return;
      }
      if (resolvedCategory.toLowerCase() === "income") {
        error.value = "Income cannot be used as a spending budget category.";
        return;
      }
      if (
        state.value.budgets.some(
          (b) =>
            b.category.toLowerCase() === resolvedCategory.toLowerCase() &&
            b.id !== selected.value,
        )
      ) {
        error.value = `You already have a budget for ${resolvedCategory}.`;
        return;
      }
      let resolvedColor = f.color;
      if (resolvedColor === "__custom__") {
        let custom = (f.customColor || "").trim();
        if (custom && !custom.startsWith("#")) {
          custom = "#" + custom;
        }
        if (!/^#[0-9a-fA-F]{6}$/.test(custom)) {
          error.value = "Enter a valid 6-character hex color (e.g. #277c78).";
          return;
        }
        resolvedColor = custom.toLowerCase();
      }

      const budgetName = name || resolvedCategory;
      if (mode.value === "Edit budget") {
        const existing = state.value.budgets.find(
          (b) => b.id === selected.value,
        );
        if (existing) {
          Object.assign(existing, {
            name: budgetName,
            limit: amount,
            category: resolvedCategory,
            color: resolvedColor,
          });
        }
      } else {
        state.value.budgets.push({
          id: uid(),
          name: budgetName,
          category: resolvedCategory,
          limit: amount,
          color: resolvedColor,
        });
      }
    } else if (mode.value === "Add pot") {
      if (!Number.isFinite(target) || target <= 0 || target > 10000000000) {
        error.value = "Enter a valid target greater than zero.";
        return;
      }
      let resolvedColor = f.color;
      if (resolvedColor === "__custom__") {
        let custom = (f.customColor || "").trim();
        if (custom && !custom.startsWith("#")) {
          custom = "#" + custom;
        }
        if (!/^#[0-9a-fA-F]{6}$/.test(custom)) {
          error.value = "Enter a valid 6-character hex color (e.g. #277c78).";
          return;
        }
        resolvedColor = custom.toLowerCase();
      }
      state.value.pots.push({
        id: uid(),
        name,
        saved: 0,
        target,
        color: resolvedColor,
      });
    } else if (mode.value === "Add money" || mode.value === "Withdraw") {
      const p = state.value.pots.find((item) => item.id === selected.value);
      if (!p) return;
      if (mode.value === "Withdraw" && amount > p.saved) {
        error.value = "You cannot withdraw more than this pot contains.";
        return;
      }
      if (mode.value === "Add money" && amount > Math.max(0, sum.value.safe)) {
        error.value = "This amount exceeds your available safe-to-spend money.";
        return;
      }
      p.saved += mode.value === "Add money" ? amount : -amount;
    } else if (mode.value === "Add bill" || mode.value === "Edit bill") {
      if (
        !Number.isInteger(Number(f.day)) ||
        Number(f.day) < 1 ||
        Number(f.day) > 31
      ) {
        error.value = "Choose a day from 1 to 31.";
        return;
      }
      if (mode.value === "Edit bill") {
        const existing = state.value.bills.find((b) => b.id === selected.value);
        if (existing) {
          Object.assign(existing, {
            name,
            amount,
            day: Number(f.day),
            protected: Boolean(f.protected),
          });
        }
      } else {
        state.value.bills.push({
          id: uid(),
          name,
          amount,
          day: Number(f.day),
          protected: Boolean(f.protected),
        });
      }
    } else if (mode.value === "Start fresh") {
      if (!resetConfirmed.value) {
        error.value = "Confirm that you understand what will be cleared.";
        return;
      }
      storageBlocked.value = false;
      state.value = resetWorkspace(state.value, resetChoice.value === "keep");
      page.value = "Overview";
    } else if (mode.value === "Delete transaction") {
      state.value.transactions = state.value.transactions.filter(
        (t) => t.id !== selected.value,
      );
    } else if (mode.value === "Delete budget") {
      state.value.budgets = state.value.budgets.filter(
        (b) => b.id !== selected.value,
      );
    } else if (mode.value === "Delete pot") {
      state.value.pots = state.value.pots.filter(
        (p) => p.id !== selected.value,
      );
    } else if (mode.value === "Delete bill") {
      state.value.bills = state.value.bills.filter(
        (b) => b.id !== selected.value,
      );
    } else if (mode.value === "Pay bill" || mode.value === "Settle bill") {
      const b = state.value.bills.find((item) => item.id === selected.value);
      if (b) {
        const due = nextUnpaidDueDate(state.value, b, today());
        if (!isBillPaid(state.value, b, due)) {
          if (mode.value === "Settle bill" || payMethod.value === "settled") {
            settleBillOccurrence(state.value, b.id, due);
          } else {
            state.value.transactions.unshift({
              id: uid(),
              name: b.name,
              amount: -b.amount,
              category: "Bills",
              date: today(),
              billId: b.id,
              billDueDate: due,
              status: "posted",
              postedDate: today(),
            });
          }
        }
      }
    }

    const currentMode = mode.value;
    const currentMethod = payMethod.value;
    close();

    toast(
      currentMode === "Start fresh"
        ? "Ready for your numbers. Set your balance to begin."
        : currentMode === "Add transaction" && form.value.date > today()
          ? "Scheduled transaction saved. It will not affect balance until confirmed."
          : currentMode === "Settle bill" || (currentMode === "Pay bill" && currentMethod === "settled")
            ? "Marked settled before setup without deducting cash."
            : currentMode === "Add transaction" && showCompanion.value
              ? "Mika: Logged. One less thing to remember."
              : "Saved. You’re up to date.",
    );
  }

  return {
    dialogRef,
    mode,
    selected,
    error,
    resetChoice,
    resetConfirmed,
    payMethod,
    form,
    open,
    close,
    submit,
  };
}
