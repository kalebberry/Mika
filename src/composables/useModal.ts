import { ref } from "vue";
import {
  colors,
  today,
  uid,
  cents,
  resetWorkspace,
  nextDueDate,
  isBillPaid,
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
}

const dialogRef = ref<HTMLDialogElement | null>(null);
const mode = ref("");
const selected = ref("");
const error = ref("");
const resetChoice = ref<"keep" | "all">("keep");
const resetConfirmed = ref(false);
const focusBefore = ref<HTMLElement | null>(null);

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
});

export function useModal() {
  const {
    state,
    storageBlocked,
    page,
    sum,
    search,
    category,
    sort,
  } = useBudget();
  const { toast } = useToast();
  const { showCompanion } = useCompanion();

  function open(m: string, id = "") {
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

    form.value = {
      name: "",
      amount: "",
      category: "Groceries",
      date: today(),
      type: "Expense",
      target: "",
      day: 1,
      color: colors[state.value.pots.length % colors.length]!,
      opening: String(sum.value.balance / 100),
      payday: state.value.payday,
    };

    if (m === "Edit budget") {
      const b = state.value.budgets.find((item) => item.id === id);
      if (b) {
        form.value = {
          ...form.value,
          name: b.name || b.category,
          category: b.category,
          amount: String(b.limit / 100),
          color: b.color,
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

    if (
      [
        "Add transaction",
        "Add budget",
        "Edit budget",
        "Add bill",
        "Add money",
        "Withdraw",
      ].includes(mode.value) &&
      (!Number.isFinite(amount) || amount <= 0 || amount > 10000000000)
    ) {
      error.value = "Enter an amount greater than zero.";
      return;
    }

    if (
      ["Add transaction", "Add pot", "Add bill"].includes(mode.value) &&
      !name
    ) {
      error.value = "Enter a name.";
      return;
    }

    if (mode.value === "Add transaction") {
      state.value.transactions.unshift({
        id: uid(),
        name,
        amount: f.type === "Income" ? amount : -amount,
        category: f.type === "Income" ? "Income" : f.category,
        date: f.date,
      });
    } else if (mode.value === "Add budget" || mode.value === "Edit budget") {
      if (f.category === "Bills" || f.category === "Income") {
        error.value =
          "Use Recurring Bills for bill reserves. Choose a spending category.";
        return;
      }
      if (
        state.value.budgets.some(
          (b) => b.category === f.category && b.id !== selected.value,
        )
      ) {
        error.value = "This category already has a budget.";
        return;
      }
      const budgetName = name || f.category;
      if (mode.value === "Edit budget") {
        const existing = state.value.budgets.find(
          (b) => b.id === selected.value,
        );
        if (existing) {
          Object.assign(existing, {
            name: budgetName,
            limit: amount,
            category: f.category,
            color: f.color,
          });
        }
      } else {
        state.value.budgets.push({
          id: uid(),
          name: budgetName,
          category: f.category,
          limit: amount,
          color: f.color,
        });
      }
    } else if (mode.value === "Add pot") {
      if (!Number.isFinite(target) || target <= 0 || target > 10000000000) {
        error.value = "Enter a valid target greater than zero.";
        return;
      }
      state.value.pots.push({
        id: uid(),
        name,
        saved: 0,
        target,
        color: f.color,
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
    } else if (mode.value === "Add bill") {
      if (
        !Number.isInteger(Number(f.day)) ||
        Number(f.day) < 1 ||
        Number(f.day) > 31
      ) {
        error.value = "Choose a day from 1 to 31.";
        return;
      }
      state.value.bills.push({ id: uid(), name, amount, day: Number(f.day) });
    } else if (mode.value === "Start fresh") {
      if (!resetConfirmed.value) {
        error.value = "Confirm that you understand what will be cleared.";
        return;
      }
      storageBlocked.value = false;
      state.value = resetWorkspace(state.value, resetChoice.value === "keep");
      page.value = "Overview";
      search.value = "";
      category.value = "All";
      sort.value = "Latest";
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
    } else if (mode.value === "Pay bill") {
      const b = state.value.bills.find((item) => item.id === selected.value);
      if (b) {
        const due = nextDueDate(b);
        if (!isBillPaid(state.value, b, due)) {
          state.value.transactions.unshift({
            id: uid(),
            name: b.name,
            amount: -b.amount,
            category: "Bills",
            date: today(),
            billId: b.id,
            billDueDate: due,
          });
        }
      }
    }

    const currentMode = mode.value;
    close();

    toast(
      currentMode === "Start fresh"
        ? "Ready for your numbers. Set your balance to begin."
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
    form,
    open,
    close,
    submit,
  };
}
