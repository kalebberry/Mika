import { ref } from "vue";
import {
  colors,
  themeColors,
  today,
  uid,
  cents,
  resetWorkspace,
  nextUnpaidDueDate,
  getBillOccurrenceStatus,
  getBillTargetOccurrenceDate,
  isBillPaid,
  settleBillOccurrence,
  recordBillPayment,
  isValidDateString,
  type TransactionStatus,
  type TransactionKind,
} from "../model.ts";
import { useBudget } from "./useBudget.ts";
import { useToast, type ToastAction } from "./useToast.ts";
import { useCompanion } from "./useCompanion.ts";
import { money } from "../utils/format.ts";

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
  accountId?: string;
  targetAccountId?: string;
  reserveAction?: "reserve" | "release";
  billId?: string;
  billDueDate?: string;
}

const dialogRef = ref<HTMLDialogElement | null>(null);
const mode = ref("");
const selected = ref("");
const error = ref("");
const resetChoice = ref<"keep" | "all">("keep");
const resetConfirmed = ref(false);
const focusBefore = ref<HTMLElement | null>(null);
const payMethod = ref<"transaction" | "settled">("transaction");

export const lastUsedExpenseCategory = ref<string>("");
export const lastUsedSpendingAccountId = ref<string>("");

export function resetSessionPreferences() {
  lastUsedExpenseCategory.value = "";
  lastUsedSpendingAccountId.value = "";
}

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
  accountId: "acc-default-checking",
  targetAccountId: "",
  reserveAction: "reserve",
  billId: undefined,
  billDueDate: undefined,
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
    assignCardPaymentReserve,
    releaseCardPaymentReserve,
    getCreditCardCoverage,
    categories,
    category,
    accountFilter,
    statusFilter,
    sort,
    search,
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
    focusBefore.value =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement)
        : null;
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

    const defaultAcc =
      (state.value.accounts || []).find(
        (a) => !a.archived && a.id === "acc-default-checking",
      ) || (state.value.accounts || []).find((a) => !a.archived);
    const defaultAccountId = defaultAcc ? defaultAcc.id : "acc-default-checking";

    let resolvedAccountId = defaultAccountId;
    if (lastUsedSpendingAccountId.value) {
      const rememberedAcc = (state.value.accounts || []).find(
        (a) => a.id === lastUsedSpendingAccountId.value && !a.archived,
      );
      if (rememberedAcc) {
        resolvedAccountId = rememberedAcc.id;
      }
    }

    let resolvedCategory = defaultCategory || "Groceries";
    const isGenericExpense =
      m === "Add transaction" &&
      (!defaultCategory ||
        defaultCategory.toLowerCase() === "expense" ||
        id?.toLowerCase() === "expense");

    if (isGenericExpense) {
      if (lastUsedExpenseCategory.value) {
        const isKnownCategory =
          (categories.value || []).some(
            (c) => c.toLowerCase() === lastUsedExpenseCategory.value.toLowerCase(),
          ) ||
          (state.value.budgets || []).some(
            (b) => b.category.toLowerCase() === lastUsedExpenseCategory.value.toLowerCase(),
          );
        resolvedCategory = isKnownCategory ? lastUsedExpenseCategory.value : "Groceries";
      } else {
        resolvedCategory = "Groceries";
      }
    }

    form.value = {
      name: "",
      amount: "",
      category: resolvedCategory,
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
      accountId: resolvedAccountId,
      targetAccountId: "",
      billId: undefined,
      billDueDate: undefined,
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
        let type = t.amount > 0 ? "Income" : "Expense";
        if (t.kind === "transfer") {
          type = "Transfer";
        } else if (t.kind === "payment") {
          type = "Credit Card Payment";
        }
        form.value = {
          ...form.value,
          name: t.name,
          amount: String(Math.abs(t.amount) / 100),
          category: t.category,
          date: t.date,
          type,
          status: normalizedStatus,
          accountId: t.accountId || defaultAccountId,
          targetAccountId: t.targetAccountId || "",
          billId: t.billId,
          billDueDate: t.billDueDate,
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
    } else if (m === "Delete account") {
      const acc = (state.value.accounts || []).find((item) => item.id === id);
      if (acc) {
        form.value = {
          ...form.value,
          name: acc.name,
          accountType: acc.type,
        };
      }
    } else if (m === "Reserve for payment") {
      const action = defaultCategory === "release" ? "release" : "reserve";
      const targetCard =
        (state.value.accounts || []).find(
          (a) => a.id === id && a.type === "credit",
        ) ||
        (state.value.accounts || []).find(
          (a) => a.type === "credit" && !a.archived,
        );
      const cardId = targetCard ? targetCard.id : id;
      const cov = targetCard ? getCreditCardCoverage(targetCard) : null;
      let defaultAmount = "";
      if (cov) {
        if (action === "reserve" && cov.uncoveredDebt > 0) {
          defaultAmount = String(cov.uncoveredDebt / 100);
        } else if (action === "release" && cov.manualReleasable > 0) {
          defaultAmount = String(cov.manualReleasable / 100);
        }
      }
      form.value = {
        ...form.value,
        name: targetCard ? targetCard.name : "",
        accountId: cardId,
        amount: defaultAmount,
        reserveAction: action,
      };
    } else if (
      m === "Add transaction" &&
      (defaultCategory?.toLowerCase() === "income" || id?.toLowerCase() === "income")
    ) {
      const incomeAcc = (state.value.accounts || []).find(
        (a) => a.id === resolvedAccountId && (a.type === "checking" || a.type === "savings") && !a.archived,
      );
      form.value = {
        ...form.value,
        type: "Income",
        category: "Income",
        accountId: incomeAcc ? incomeAcc.id : defaultAccountId,
      };
    } else if (
      m === "Add transaction" &&
      (defaultCategory?.toLowerCase() === "expense" || id?.toLowerCase() === "expense")
    ) {
      form.value = {
        ...form.value,
        type: "Expense",
        category: resolvedCategory,
        accountId: resolvedAccountId,
      };
    } else if (
      m === "Add transaction" &&
      (defaultCategory === "Credit Card Payment" || defaultCategory === "payment")
    ) {
      const targetCard = (state.value.accounts || []).find(
        (a) => a.id === id && a.type === "credit",
      );
      const cov = targetCard ? getCreditCardCoverage(targetCard) : null;
      const defaultCash =
        (state.value.accounts || []).find(
          (a) => !a.archived && a.type === "checking",
        ) ||
        (state.value.accounts || []).find(
          (a) => !a.archived && a.type === "savings",
        );
      const cardDebt = cov
        ? cov.totalOwed
        : targetCard
          ? Math.max(0, getAccountBalance(targetCard))
          : 0;
      const prefillAmount =
        cov && cov.readyToPay > 0
          ? Math.min(cov.readyToPay, cardDebt)
          : cardDebt;
      form.value = {
        ...form.value,
        type: "Credit Card Payment",
        category: "Payment",
        name: targetCard ? `${targetCard.name} Payment` : "Credit Card Payment",
        accountId: defaultCash ? defaultCash.id : defaultAccountId,
        targetAccountId: targetCard ? targetCard.id : "",
        amount: prefillAmount > 0 ? String(prefillAmount / 100) : "",
      };
    } else if (m === "Pay bill" || m === "Settle bill") {
      const b = state.value.bills.find((item) => item.id === id);
      if (b) {
        const targetDue =
          isValidDateString(defaultCategory)
            ? defaultCategory
            : getBillTargetOccurrenceDate(state.value, b, today());
        const occStatus = getBillOccurrenceStatus(state.value, b, targetDue);
        const defaultAmt =
          occStatus.remainingAmount > 0
            ? occStatus.remainingAmount
            : b.amount;
        form.value = {
          ...form.value,
          name: b.name,
          amount: String(defaultAmt / 100),
          date: today(),
          billId: b.id,
          billDueDate: targetDue,
          accountId: resolvedAccountId,
          status: "posted",
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
    let billToastMessage = "Bill payment recorded.";
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
      const ok = deleteAccount(selected.value);
      if (ok) {
        close();
      } else {
        error.value =
          "Cannot delete account. The balance must be $0.00 with no linked transactions. Archive it instead.";
      }
      return;
    }

    if (mode.value === "Reserve for payment") {
      const cardId = f.accountId;
      if (!cardId) {
        error.value = "Select a credit card account.";
        return;
      }
      const acc = (state.value.accounts || []).find((a) => a.id === cardId);
      if (!acc || acc.type !== "credit") {
        error.value = "Selected account is not a valid credit card.";
        return;
      }
      const reserveAmount = cents(Number(f.amount || 0));
      if (!Number.isFinite(reserveAmount) || reserveAmount <= 0) {
        error.value = "Enter an amount greater than zero.";
        return;
      }
      const action = f.reserveAction || "reserve";
      if (action === "reserve") {
        const safeToSpend = Math.max(0, sum.value.safe);
        if (reserveAmount > safeToSpend) {
          error.value = "This amount exceeds your available Safe to Spend.";
          return;
        }
        const cov = getCreditCardCoverage(acc);
        if (cov.uncoveredDebt <= 0) {
          error.value = `${acc.name} is already fully covered. No reservation needed.`;
          return;
        }
        if (reserveAmount > cov.uncoveredDebt) {
          error.value = `Cannot reserve more than the uncovered debt (${money(cov.uncoveredDebt)}).`;
          return;
        }
        const ok = assignCardPaymentReserve(acc.id, reserveAmount);
        if (!ok) {
          error.value = "Failed to reserve funds for payment.";
          return;
        }
      } else {
        const cov = getCreditCardCoverage(acc);
        if (cov.manualReleasable <= 0) {
          error.value = "There are no manual reserved funds to release.";
          return;
        }
        if (reserveAmount > cov.manualReleasable) {
          error.value =
            `Cannot release more than the manually assigned reserve (${money(cov.manualReleasable)}).`;
          return;
        }
        const ok = releaseCardPaymentReserve(acc.id, reserveAmount);
        if (!ok) {
          error.value = "Failed to release payment reserve.";
          return;
        }
      }
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

      if (f.type === "Transfer") {
        if (!f.accountId || !f.targetAccountId) {
          error.value = "Select both a source and destination cash account.";
          return;
        }
        if (f.accountId === f.targetAccountId) {
          error.value =
            "Transfers between the same account are not permitted. Choose different accounts.";
          return;
        }
        const src = (state.value.accounts || []).find((a) => a.id === f.accountId);
        const dest = (state.value.accounts || []).find((a) => a.id === f.targetAccountId);
        if (src?.type === "credit" || dest?.type === "credit") {
          error.value =
            "Transfers can only be made between cash accounts (checking and savings). For credit cards, choose 'Credit Card Payment'.";
          return;
        }
      } else if (f.type === "Credit Card Payment") {
        if (!f.accountId || !f.targetAccountId) {
          error.value =
            "Select both a payment source (checking/savings) and destination credit card.";
          return;
        }
        const src = (state.value.accounts || []).find((a) => a.id === f.accountId);
        const dest = (state.value.accounts || []).find((a) => a.id === f.targetAccountId);
        if (src?.type === "credit") {
          error.value = "Payments cannot originate from a credit card.";
          return;
        }
        if (dest?.type !== "credit") {
          error.value = "Payment destination must be a credit card account.";
          return;
        }
        const cov = getCreditCardCoverage(dest);
        let maxPayable = cov.totalOwed;
        if (mode.value === "Edit transaction" && selected.value) {
          const existingTx = (state.value.transactions || []).find(
            (t) => t.id === selected.value,
          );
          if (
            existingTx &&
            existingTx.kind === "payment" &&
            existingTx.targetAccountId === dest.id
          ) {
            maxPayable += Math.abs(existingTx.amount);
          }
        }
        if (maxPayable <= 0) {
          error.value = "This credit card has no positive outstanding balance to pay.";
          return;
        }
        if (amount > maxPayable) {
          error.value = `Cannot pay more than the outstanding debt (${money(maxPayable)}).`;
          return;
        }
      } else {
        if (!f.accountId) {
          error.value = "Select an account.";
          return;
        }
        if (
          f.type === "Expense" &&
          f.category === "__custom__" &&
          !f.customCategory?.trim()
        ) {
          error.value = "Enter a custom category name.";
          return;
        }
      }
    }

    let savedTxName = "";
    let savedTxType = "";
    let savedTxCategory = "";
    let savedTxAmount = 0;
    let savedTxAccountId: string | undefined = "";
    let savedTxTargetAccountId: string | undefined = "";
    let savedTxStatus: TransactionStatus | undefined = undefined;

    if (mode.value === "Add transaction" || mode.value === "Edit transaction") {
      const isFuture = f.date > today();
      const status: TransactionStatus =
        f.status || (isFuture ? "scheduled" : "cleared");
      const kind: TransactionKind =
        f.type === "Transfer"
          ? "transfer"
          : f.type === "Credit Card Payment"
            ? "payment"
            : "standard";

      let txName = name;
      let txCategory = resolvedCategory || "General";
      let txAmount = -amount;

      if (f.type === "Transfer") {
        const dest = (state.value.accounts || []).find(
          (a) => a.id === f.targetAccountId,
        );
        txName = name || (dest ? `Transfer to ${dest.name}` : "Transfer");
        txCategory = "Transfer";
        txAmount = -amount;
      } else if (f.type === "Credit Card Payment") {
        const dest = (state.value.accounts || []).find(
          (a) => a.id === f.targetAccountId,
        );
        txName =
          name || (dest ? `Payment to ${dest.name}` : "Credit Card Payment");
        txCategory = "Payment";
        txAmount = -amount;
      } else if (f.type === "Income") {
        txName = name || "Income";
        txCategory = "Income";
        txAmount = amount;
      } else if (f.type === "Expense") {
        txName = name || resolvedCategory || "Expense";
        txCategory = resolvedCategory || "General";
        txAmount = -amount;
        if (mode.value === "Add transaction") {
          lastUsedSpendingAccountId.value = f.accountId || "";
          lastUsedExpenseCategory.value = resolvedCategory;
        }
      }

      savedTxName = txName;
      savedTxType = f.type;
      savedTxCategory = txCategory;
      savedTxAmount = amount;
      savedTxAccountId = f.accountId;
      savedTxTargetAccountId = f.targetAccountId;
      savedTxStatus = status;

      if (mode.value === "Add transaction") {
        let explicitBillDueDate = f.billDueDate;
        if (f.billId && !explicitBillDueDate) {
          const linkedBill = state.value.bills.find((b) => b.id === f.billId);
          if (linkedBill) {
            explicitBillDueDate = nextUnpaidDueDate(state.value, linkedBill, f.date);
          }
        }

        state.value.transactions.unshift({
          id: uid(),
          name: txName,
          amount: txAmount,
          category: txCategory,
          date: f.date,
          status,
          postedDate: status !== "scheduled" ? f.date : undefined,
          accountId: f.accountId,
          kind,
          targetAccountId:
            kind !== "standard" ? f.targetAccountId : undefined,
          billId: f.billId || undefined,
          billDueDate: f.billId ? explicitBillDueDate : undefined,
          createdAt: new Date().toISOString(),
        });
      } else if (mode.value === "Edit transaction") {
        const existing = state.value.transactions.find(
          (t) => t.id === selected.value,
        );
        if (existing) {
          const billIdExplicitlyProvided = f.billId !== undefined;
          const targetBillId = billIdExplicitlyProvided
            ? f.billId || undefined
            : existing.billId;

          let targetBillDueDate: string | undefined;

          if (!targetBillId) {
            targetBillDueDate = undefined;
          } else if (targetBillId === existing.billId) {
            // Bill association remains unchanged: preserve existing.billDueDate
            // unless the user explicitly provided a different billDueDate
            if (f.billDueDate !== undefined && f.billDueDate !== existing.billDueDate) {
              targetBillDueDate = f.billDueDate || undefined;
            } else {
              targetBillDueDate = existing.billDueDate;
            }
          } else {
            // User assigned a DIFFERENT recurring bill
            if (f.billDueDate && isValidDateString(f.billDueDate)) {
              targetBillDueDate = f.billDueDate;
            } else {
              const newBill = state.value.bills.find((b) => b.id === targetBillId);
              targetBillDueDate = newBill
                ? nextUnpaidDueDate(state.value, newBill, f.date)
                : undefined;
            }
          }

          Object.assign(existing, {
            name: txName,
            amount: txAmount,
            category: txCategory,
            date: f.date,
            status,
            postedDate:
              status !== "scheduled"
                ? existing.postedDate || f.date
                : undefined,
            accountId: f.accountId,
            kind,
            targetAccountId:
              kind !== "standard" ? f.targetAccountId : undefined,
            billId: targetBillId,
            billDueDate: targetBillDueDate,
          });
        }
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
          trackingStartDate: today(),
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
        const targetDue =
          form.value.billDueDate && isValidDateString(form.value.billDueDate)
            ? form.value.billDueDate
            : nextUnpaidDueDate(state.value, b, today());

        if (mode.value === "Settle bill" || payMethod.value === "settled") {
          if (isBillPaid(state.value, b, targetDue)) {
            error.value = `${b.name} (${targetDue}) is already recorded as paid or settled.`;
            return;
          }
          settleBillOccurrence(state.value, b.id, targetDue);
        } else {
          const paymentAmount = cents(Number(form.value.amount));
          if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            error.value = "Enter a valid payment amount greater than zero.";
            return;
          }
          if (paymentAmount > 1000000000) {
            error.value = "Payment amount exceeds maximum supported limit.";
            return;
          }
          if (!isValidDateString(form.value.date)) {
            error.value = "Enter a valid payment date (YYYY-MM-DD).";
            return;
          }
          const chosenAccount = (state.value.accounts || []).find(
            (a) => a.id === form.value.accountId && !a.archived,
          );
          if (!chosenAccount && (state.value.accounts || []).length > 0) {
            error.value = "Select a valid active source account.";
            return;
          }
          const chosenStatus: TransactionStatus =
            form.value.status === "scheduled" || form.value.status === "cleared"
              ? form.value.status
              : "posted";

          if (chosenStatus === "cleared" && form.value.date > today()) {
            error.value =
              "A transaction cannot be marked cleared with a future date.";
            return;
          }

          const defaultChecking =
            (state.value.accounts || []).find(
              (a) => a.type === "checking" && !a.archived,
            )?.id || "acc-default-checking";

          recordBillPayment(state.value, b.id, {
            amount: paymentAmount,
            date: form.value.date,
            dueDate: targetDue,
            accountId: form.value.accountId || defaultChecking,
            status: chosenStatus,
          });

          const postStatus = getBillOccurrenceStatus(state.value, b, targetDue);
          if (chosenStatus === "scheduled") {
            billToastMessage =
              "Scheduled bill payment recorded. Will not affect balance until confirmed.";
          } else if (postStatus.remainingAmount > 0) {
            billToastMessage = `Bill payment recorded. Remaining obligation: $${(postStatus.remainingAmount / 100).toFixed(2)}.`;
          } else {
            billToastMessage = "Bill payment recorded. Paid in full.";
          }
        }
      }
    }

    const currentMode = mode.value;
    const currentMethod = payMethod.value;
    close();

    let confirmationMessage = "Saved. You’re up to date.";
    let toastActionItem: ToastAction | undefined;

    if (currentMode === "Add transaction" || currentMode === "Edit transaction") {
      const acc = (state.value.accounts || []).find((a) => a.id === savedTxAccountId);
      const accName = acc ? acc.name : "Primary Checking";
      const formattedAmt = money(savedTxAmount);
      const isSched = savedTxStatus === "scheduled";
      const verb = isSched ? "Scheduled" : "Saved";

      if (savedTxType === "Expense") {
        confirmationMessage = `${verb} ${formattedAmt} · ${savedTxCategory} · ${accName}`;
      } else if (savedTxType === "Income") {
        confirmationMessage = `${verb} ${formattedAmt} · Income · ${accName}`;
      } else if (savedTxType === "Transfer") {
        const dest = (state.value.accounts || []).find((a) => a.id === savedTxTargetAccountId);
        confirmationMessage = `${verb} ${formattedAmt} · Transfer · ${accName} → ${dest?.name || "Account"}`;
      } else if (savedTxType === "Credit Card Payment") {
        const dest = (state.value.accounts || []).find((a) => a.id === savedTxTargetAccountId);
        confirmationMessage = `${verb} ${formattedAmt} · Payment · ${accName} → ${dest?.name || "Credit Card"}`;
      }

      toastActionItem = {
        label: "View transaction",
        run: () => {
          category.value = "All";
          accountFilter.value = "All";
          statusFilter.value = "All";
          sort.value = "Latest";
          search.value = savedTxName;
          page.value = "Transactions";
        },
      };
    } else if (currentMode === "Pay bill") {
      if (currentMethod === "settled") {
        confirmationMessage = "Marked settled before setup without deducting cash.";
      } else {
        const payAcc = (state.value.accounts || []).find((a) => a.id === form.value.accountId);
        const payAccName = payAcc ? payAcc.name : "Primary Checking";
        const isSched = form.value.status === "scheduled";
        const verb = isSched ? "Scheduled" : "Paid";
        const amt = cents(Number(form.value.amount || 0));
        confirmationMessage = `${verb} ${money(amt)} · ${form.value.name} · ${payAccName}`;
        toastActionItem = {
          label: "View transaction",
          run: () => {
            category.value = "All";
            accountFilter.value = "All";
            statusFilter.value = "All";
            sort.value = "Latest";
            search.value = form.value.name;
            page.value = "Transactions";
          },
        };
      }
    } else if (currentMode === "Start fresh") {
      confirmationMessage = "Ready for your numbers. Set your balance to begin.";
    } else if (currentMode === "Settle bill") {
      confirmationMessage = "Marked settled before setup without deducting cash.";
    }

    if (showCompanion.value && currentMode === "Add transaction") {
      confirmationMessage = `Mika: ${confirmationMessage}`;
    }

    toast(confirmationMessage, toastActionItem);
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
    lastUsedExpenseCategory,
    lastUsedSpendingAccountId,
    resetSessionPreferences,
    open,
    close,
    submit,
  };
}
