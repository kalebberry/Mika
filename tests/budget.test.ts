import test from "node:test";
import assert from "node:assert/strict";
import {
  type State,
  type Bill,
  type Transaction,
  type TransactionKind,
  blank,
  totals,
  reserveBillsBreakdown,
  nextUnpaidDueDate,
  isBillPaid,
  isBillSettled,
  settleBillOccurrence,
  paid,
  isBillUnpaidThisMonth,
  migrateState,
  addDays,
  colors,
  themeColors,
  spent,
  isLedgerStatus,
  getUncoveredScheduledExpenses,
  type Account,
  type AccountType,
  accountTotals,
  getAccountBalance,
  getAvailableCredit,
  getAccountLedgerDelta,
  getAccountTransactionCount,
  canDeleteAccount,
  getAccountDeletionBlockReason,
  type CreditCardCoverage,
  type PaymentReservation,
  getCreditCardCoverage,
  assignCardPaymentReserve,
  releaseCardPaymentReserve,
} from "../src/model.ts";
import { useBudget } from "../src/composables/useBudget.ts";
import { useModal } from "../src/composables/useModal.ts";

test("Test A — Future paycheck: income remains scheduled until confirmed/posted", () => {
  const simulatedToday = "2026-10-13";
  const state: State = blank();
  state.opening = 740543; // $7,405.43
  state.payday = "2026-10-21";
  state.followingPayday = "2026-11-04";

  // Scheduled income: $3,000 on October 21
  const scheduledIncome: Transaction = {
    id: "tx-paycheck-1",
    name: "Work Paycheck",
    amount: 300000, // $3,000.00
    category: "Income",
    date: "2026-10-21",
    status: "scheduled",
  };
  state.transactions.push(scheduledIncome);

  // Before scheduled date / before posting:
  const tBefore = totals(state, simulatedToday);
  assert.equal(tBefore.balance, 740543, "Current balance must remain $7,405.43");
  assert.equal(tBefore.scheduledIncome, 300000, "Scheduled income must report $3,000.00");
  assert.equal(tBefore.safe, 740543, "Safe to spend must not be inflated by unposted future income");

  // On October 21, user confirms receipt of money and transaction is posted
  const simulatedPaydayDate = "2026-10-21";
  scheduledIncome.status = "posted";
  scheduledIncome.postedDate = simulatedPaydayDate;

  const tAfter = totals(state, simulatedPaydayDate);
  assert.equal(tAfter.balance, 1040543, "Current balance must increase to $10,405.43 after posting");
  assert.equal(tAfter.scheduledIncome, 0, "Scheduled income must now be 0 after posting");
  assert.equal(tAfter.safe, 1040543, "Safe to spend must reflect posted income");
});

test("Future expense does not prematurely decrease balance or Safe to Spend", () => {
  const simulatedToday = "2026-10-13";
  const state: State = blank();
  state.opening = 500000; // $5,000.00
  state.payday = "2026-10-21";

  // Enter future scheduled expense of $200 on Oct 25
  state.transactions.push({
    id: "tx-exp-future",
    name: "Flight Tickets",
    amount: -20000,
    category: "Travel",
    date: "2026-10-25",
    status: "scheduled",
  });

  const t = totals(state, simulatedToday);
  assert.equal(t.balance, 500000, "Balance should not decrease before posting");
  assert.equal(t.scheduledExpenses, 20000, "Scheduled expense should be tracked");
  assert.equal(t.safe, 500000, "Safe to spend should not decrease before posting");
});

test("Test B — November rent: recognized, protected for following cycle, not an October obligation", () => {
  const simulatedToday = "2026-10-13";
  const state: State = blank();
  state.opening = 740543; // $7,405.43
  state.payday = "2026-10-21";
  state.followingPayday = "2026-11-04";

  // Recurring rent bill of $1,301 due on the 1st
  const rentBill: Bill = {
    id: "bill-rent",
    name: "Rent",
    amount: 130100, // $1,301.00
    day: 1,
    protected: true, // User chooses to protect rent due before following payday
  };
  state.bills.push(rentBill);

  // October rent has already been paid on 2026-10-01
  state.transactions.push({
    id: "tx-oct-rent",
    name: "Rent",
    amount: -130100,
    category: "Bills",
    date: "2026-10-01",
    billId: "bill-rent",
    billDueDate: "2026-10-01",
    status: "posted",
  });

  // Verify next unpaid due date is recognized as November 1, 2026
  const nextDue = nextUnpaidDueDate(state, rentBill, simulatedToday);
  assert.equal(nextDue, "2026-11-01", "Next unpaid occurrence must be Nov 1, 2026");

  // Check bill reservation breakdown
  const breakdown = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(
    breakdown.currentCycleBills,
    0,
    "November rent must not be counted as an October current-cycle obligation",
  );
  assert.equal(
    breakdown.protectedCycleBills,
    130100,
    "November rent must be protected in protectedCycleBills ($1,301.00)",
  );
  assert.equal(breakdown.total, 130100, "Total reserved bills must be $1,301.00");

  const t = totals(state, simulatedToday);
  // Opening: 740543, Oct rent: -130100 => balance: 610443
  // Safe: 610443 - 130100 = 480343
  assert.equal(t.bills, 130100);
  assert.equal(t.safe, 610443 - 130100);
});

test("Test C — No double-counting: paying protected bill releases reservation cleanly", () => {
  const simulatedToday = "2026-10-13";
  const state: State = blank();
  state.opening = 740543; // $7,405.43
  state.payday = "2026-10-21";
  state.followingPayday = "2026-11-04";

  // Mark Oct rent as already paid so next is Nov 1
  const rentBill: Bill = {
    id: "bill-rent",
    name: "Rent",
    amount: 130100,
    day: 1,
    protected: true,
  };
  state.bills.push(rentBill);
  state.transactions.push({
    id: "tx-oct-rent",
    name: "Rent",
    amount: -130100,
    category: "Bills",
    date: "2026-10-01",
    billId: "bill-rent",
    billDueDate: "2026-10-01",
    status: "posted",
  });

  // Safe to Spend before Nov rent payment
  const beforePay = totals(state, simulatedToday);
  const safeBefore = beforePay.safe;
  const balanceBefore = beforePay.balance;

  // Pay November rent early or on due date
  const novDueDate = nextUnpaidDueDate(state, rentBill, simulatedToday);
  assert.equal(novDueDate, "2026-11-01");

  state.transactions.unshift({
    id: "tx-nov-rent",
    name: "Rent",
    amount: -130100,
    category: "Bills",
    date: simulatedToday,
    billId: rentBill.id,
    billDueDate: novDueDate,
    status: "posted",
  });

  const afterPay = totals(state, simulatedToday);

  // 1. Balance must decrease by exactly $1,301
  assert.equal(afterPay.balance, balanceBefore - 130100);

  // 2. The reservation must be released (now 0 because Nov rent is paid)
  assert.equal(afterPay.bills, 0, "Reservation must be released after payment");

  // 3. Safe to Spend must NOT decrease a second time!
  // Before: balance - 130100 reservation. After: (balance - 130100) - 0 reservation.
  assert.equal(
    afterPay.safe,
    safeBefore,
    "Safe to spend must remain identical before and after paying reserved bill",
  );

  // 4. Next unpaid occurrence advances to December 1, 2026
  assert.equal(
    nextUnpaidDueDate(state, rentBill, simulatedToday),
    "2026-12-01",
  );
});

test("Test D — Persistence & Migration: JSON import and v1 -> v2 schema compatibility", () => {
  // Simulate a legacy v1 saved state with a future transaction and rent bill
  const legacyV1 = {
    version: 1,
    demo: false,
    opening: 740543,
    payday: "2026-10-21",
    transactions: [
      {
        id: "t-past",
        name: "Groceries",
        amount: -5000,
        category: "Groceries",
        date: "2026-10-10",
      },
      {
        id: "t-future",
        name: "Future Bonus",
        amount: 300000,
        category: "Income",
        date: "2026-10-21",
      },
    ],
    budgets: [
      {
        id: "b1",
        category: "Groceries",
        limit: 20000,
        color: "#277c78",
      },
    ],
    pots: [],
    bills: [
      {
        id: "bill-1",
        name: "Rent",
        amount: 130100,
        day: 1,
      },
    ],
  };

  const migrated = migrateState(legacyV1, "2026-10-13");

  assert.equal(migrated.version, 2);
  assert.equal(migrated.followingPayday, "2026-11-04");
  assert.equal(migrated.transactions[0]!.status, "pending");
  assert.equal(migrated.transactions[1]!.status, "scheduled");
  assert.equal(migrated.bills[0]!.protected, false);

  // Test round-trip JSON serialization
  const serialized = JSON.stringify(migrated);
  const parsed = JSON.parse(serialized);
  const reMigrated = migrateState(parsed, "2026-10-13");

  assert.deepEqual(reMigrated, migrated, "Round-trip serialization must preserve state");
});

test("Shortfall is reported separately and Safe to Spend remains nonnegative", () => {
  const simulatedToday = "2026-10-13";
  const state: State = blank();
  state.opening = 10000; // $100.00
  state.payday = "2026-10-21";

  // Reserves: pot of $300, bill of $200 => total commitments $500
  state.pots.push({
    id: "p1",
    name: "Vacation",
    saved: 30000,
    target: 50000,
    color: "#277c78",
  });
  state.bills.push({
    id: "b1",
    name: "Utility",
    amount: 20000,
    day: 15, // due Oct 15 (before payday)
  });

  const t = totals(state, simulatedToday);
  assert.equal(t.balance, 10000);
  assert.equal(t.pots, 30000);
  assert.equal(t.bills, 20000);
  // Raw safe = 10000 - 30000 - 20000 = -40000 (-$400.00)
  assert.equal(t.rawSafe, -40000);
  assert.equal(t.safe, 0, "Safe to spend display must remain >= 0");
  assert.equal(t.shortfall, 40000, "Shortfall must report $400.00");
});

test("Date clamping for shorter months (e.g. day 31 in Feb and Apr)", () => {
  const bill: Bill = { id: "b31", name: "End of month subscription", amount: 1500, day: 31 };
  const febDate = nextUnpaidDueDate(blank(), bill, "2026-02-01");
  assert.equal(febDate, "2026-02-28", "Clamps to Feb 28 in non-leap year");

  const aprDate = nextUnpaidDueDate(blank(), bill, "2026-04-01");
  assert.equal(aprDate, "2026-04-30", "Clamps to Apr 30 in 30-day month");
});

test("Overdue unpaid bill in current month is retained and reserved before payday", () => {
  const simulatedToday = "2026-10-13";
  const state: State = blank();
  state.opening = 500000;
  state.payday = "2026-10-21";

  // Bill was due on Oct 5 (past due), not yet paid
  const overdueBill: Bill = { id: "b-gym", name: "Gym", amount: 5000, day: 5 };
  state.bills.push(overdueBill);

  const due = nextUnpaidDueDate(state, overdueBill, simulatedToday);
  assert.equal(due, "2026-10-05", "Must identify Oct 5 as still unpaid");

  const breakdown = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(breakdown.currentCycleBills, 5000, "Must reserve overdue unpaid bill in current cycle");
});

test("Budget spent ignores scheduled unposted expenses", () => {
  const simulatedToday = "2026-10-13";
  const state: State = blank();
  state.opening = 500000;
  state.budgets.push({ id: "bg1", category: "Dining Out", limit: 30000, color: "#277c78" });

  // Posted dining expense of $50
  state.transactions.push({
    id: "tx-posted-dine",
    name: "Lunch Bistro",
    amount: -5000,
    category: "Dining Out",
    date: "2026-10-10",
    status: "posted",
  });

  // Scheduled dining expense for Oct 25 of $100
  state.transactions.push({
    id: "tx-sched-dine",
    name: "Upcoming Birthday Dinner",
    amount: -10000,
    category: "Dining Out",
    date: "2026-10-25",
    status: "scheduled",
  });

  const t = totals(state, simulatedToday);
  // Remaining budget: limit (30000) - posted spent (5000) = 25000
  assert.equal(t.budgets, 25000, "Budget remaining must only deduct posted expenses");
});

test("Test E — Mid-month onboarding: Bill already paid before setup (October rent settled without transaction)", () => {
  const simulatedToday = "2026-10-13";
  const state: State = blank();
  state.opening = 740543; // Opening balance: $7,405.43
  state.payday = "2026-10-21";
  state.followingPayday = "2026-11-04";

  // Recurring rent bill of $1,301 due on the 1st
  const rentBill: Bill = {
    id: "bill-rent-onboarding",
    name: "Rent",
    amount: 130100, // $1,301.00
    day: 1,
    protected: false,
  };
  state.bills.push(rentBill);

  // 1. Before settlement: October 1 is identified as overdue and reserved
  assert.equal(
    nextUnpaidDueDate(state, rentBill, simulatedToday),
    "2026-10-01",
    "Initially, Oct 1 is the next unpaid occurrence",
  );
  const beforeSettlement = totals(state, simulatedToday);
  assert.equal(beforeSettlement.bills, 130100, "October rent is reserved as overdue before settlement");

  // 2. Mark October rent settled without transaction (e.g. paid before starting Mika)
  const settledOk = settleBillOccurrence(state, rentBill.id, "2026-10-01");
  assert.equal(settledOk, true, "Settlement must succeed");
  assert.equal(isBillSettled(state, rentBill, "2026-10-01"), true);
  assert.equal(isBillPaid(state, rentBill, "2026-10-01"), true);

  // 3. Current balance MUST remain strictly $7,405.43 (no transaction added)
  assert.equal(state.transactions.length, 0, "No transactions should be created by settlement");
  const afterSettlement = totals(state, simulatedToday);
  assert.equal(afterSettlement.balance, 740543, "Cash balance must remain unchanged at $7,405.43");

  // 4. Next rent due date advances to November 1, 2026
  assert.equal(
    nextUnpaidDueDate(state, rentBill, simulatedToday),
    "2026-11-01",
    "Next unpaid occurrence must advance to Nov 1",
  );
  assert.equal(afterSettlement.currentCycleBills, 0, "October rent must no longer be reserved");

  // 5. Protect November rent for following pay cycle
  rentBill.protected = true;
  const withProtection = totals(state, simulatedToday);
  assert.equal(withProtection.currentCycleBills, 0);
  assert.equal(withProtection.protectedCycleBills, 130100, "Nov rent must be protected in protectedCycleBills");
  assert.equal(withProtection.bills, 130100, "Total reserved bills must be $1,301.00");

  // Expected result: Safe to Spend becomes $6,104.43 ($7,405.43 - $1,301.00)
  assert.equal(withProtection.balance, 740543, "Balance remains $7,405.43");
  assert.equal(withProtection.safe, 610443, "Safe to spend must be $6,104.43");

  // 6. Prevent duplicate payment or duplicate settlement of the same occurrence
  const duplicateSettlement = settleBillOccurrence(state, rentBill.id, "2026-10-01");
  assert.equal(duplicateSettlement, false, "Must refuse duplicate settlement of Oct 1 rent");

  // 7. Verify persistence and migration roundtrip
  const serialized = JSON.stringify(state);
  const reloaded = migrateState(JSON.parse(serialized), simulatedToday);
  assert.equal(
    nextUnpaidDueDate(reloaded, reloaded.bills[0]!, simulatedToday),
    "2026-11-01",
    "Persisted state must retain settlement and keep next due date as Nov 1",
  );
  const reloadedTotals = totals(reloaded, simulatedToday);
  assert.equal(reloadedTotals.balance, 740543);
  assert.equal(reloadedTotals.safe, 610443);
});

test("Overview Recurring Bills card: protected next cycle bill is not part of unpaid this month", () => {
  const simulatedToday = "2026-10-13";
  const state: State = blank();
  state.opening = 740543;
  state.payday = "2026-10-21";
  state.followingPayday = "2026-11-04";

  // Bill 1: Rent $1,301 due on 1st. October 1 rent was already settled before setup.
  const rentBill: Bill = {
    id: "b-rent",
    name: "Rent",
    amount: 130100,
    day: 1,
    protected: true,
    settledDueDates: ["2026-10-01"],
  };

  // Bill 2: Internet $100 due on 20th. Unpaid in October.
  const internetBill: Bill = {
    id: "b-internet",
    name: "Internet",
    amount: 10000,
    day: 20,
    protected: false,
    settledDueDates: [],
  };

  // Bill 3: Phone $15.99 due on 12th. Unpaid in October.
  const phoneBill: Bill = {
    id: "b-phone",
    name: "Phone",
    amount: 1599,
    day: 12,
    protected: false,
    settledDueDates: [],
  };

  state.bills.push(rentBill, internetBill, phoneBill);

  // 1. Paid this month should report October rent ($1,301.00)
  assert.equal(paid(state, rentBill, "2026-10"), true, "Rent was settled for October");
  assert.equal(paid(state, internetBill, "2026-10"), false);
  assert.equal(paid(state, phoneBill, "2026-10"), false);
  const paidThisMonthTotal = state.bills
    .filter((b) => paid(state, b, "2026-10"))
    .reduce((n, b) => n + b.amount, 0);
  assert.equal(paidThisMonthTotal, 130100, "Paid this month must be $1,301.00");

  // 2. Unpaid this month: Rent MUST NOT be included because October was settled and next is Nov 1!
  assert.equal(isBillUnpaidThisMonth(state, rentBill, simulatedToday), false, "Rent must NOT be unpaid this month");
  assert.equal(isBillUnpaidThisMonth(state, internetBill, simulatedToday), true, "Internet is unpaid this month");
  assert.equal(isBillUnpaidThisMonth(state, phoneBill, simulatedToday), true, "Phone is unpaid this month");

  const unpaidThisMonthTotal = state.bills
    .filter((b) => isBillUnpaidThisMonth(state, b, simulatedToday))
    .reduce((n, b) => n + b.amount, 0);
  // Unpaid this month should only be Internet ($100) + Phone ($15.99) = $115.99
  assert.equal(unpaidThisMonthTotal, 11599, "Unpaid this month must NOT include protected next-cycle rent");

  // 3. Breakdown
  const t = totals(state, simulatedToday);
  assert.equal(t.currentCycleBills, 11599, "Due before payday is Internet + Phone ($115.99)");
  assert.equal(t.protectedCycleBills, 130100, "Next cycle protected is Rent ($1,301.00)");
  assert.equal(t.bills, 141699, "Total reserved is $1,416.99");
});

test("Theme colors palette: expanded with at least 14 unique valid hex colors", () => {
  assert.ok(themeColors.length >= 14, `Expected at least 14 colors, got ${themeColors.length}`);
  assert.equal(colors.length, themeColors.length, "colors array must match themeColors length");

  // First 5 colors must remain the original 5 colors for backwards compatibility
  assert.equal(colors[0], "#277c78");
  assert.equal(colors[1], "#82c9d7");
  assert.equal(colors[2], "#626070");
  assert.equal(colors[3], "#f2cdac");
  assert.equal(colors[4], "#826cb0");

  // All colors must be valid 7-character hex strings
  const hexRegex = /^#[0-9a-fA-F]{6}$/;
  for (const tc of themeColors) {
    assert.ok(hexRegex.test(tc.value), `Color ${tc.name} (${tc.value}) must be a valid 6-digit hex`);
    assert.ok(tc.name && tc.name.trim().length > 0, "Color must have a non-empty name");
  }

  // All color values must be distinct
  const uniqueValues = new Set(themeColors.map((tc) => tc.value.toLowerCase()));
  assert.equal(uniqueValues.size, themeColors.length, "All theme colors must be distinct");
});

test("Test F — Evergy electricity budget and scheduled payment lifecycle (no double counting)", () => {
  const simulatedToday = "2026-10-13";
  const state: State = blank();
  state.opening = 740543; // $7,405.43
  state.payday = "2026-10-21";
  state.followingPayday = "2026-11-04";

  // Evergy electricity budget: $200.00
  state.budgets.push({
    id: "b-evergy",
    category: "Electricity",
    limit: 20000, // $200.00
    color: "#277c78",
  });

  // Scheduled Evergy payment: $171.30 within current cycle
  const evergyTx: Transaction = {
    id: "tx-evergy-1",
    name: "Evergy Electricity",
    amount: -17130, // -$171.30
    category: "Electricity",
    date: "2026-10-18",
    status: "scheduled",
  };
  state.transactions.push(evergyTx);

  // 1. Initial State: Scheduled status
  let t = totals(state, simulatedToday);
  assert.equal(t.balance, 740543, "Cash balance must remain $7,405.43 while scheduled");
  assert.equal(t.scheduledExpenses, 17130, "Scheduled expenses should report $171.30");
  assert.equal(spent(state, "Electricity", "2026-10"), 0, "Budget spent must be $0 while scheduled");
  assert.equal(t.budgets, 20000, "Remaining electricity budget is $200.00");
  assert.equal(t.uncoveredScheduledExpenses, 0, "Scheduled expense is covered by budget; uncovered must be $0");
  // Total electricity allocation protected is $200.00, NOT $371.30!
  assert.equal(t.safe, 740543 - 20000, "Safe to spend must protect $200.00 total ($7,205.43), not $371.30");

  // 2. Transition to Pending: Payment submitted / authorized
  evergyTx.status = "pending";
  t = totals(state, simulatedToday);
  assert.equal(t.balance, 723413, "Cash balance becomes $7,234.13 ($7,405.43 - $171.30)");
  assert.equal(t.scheduledExpenses, 0, "Scheduled expenses becomes $0");
  assert.equal(spent(state, "Electricity", "2026-10"), 17130, "Electricity spent is now $171.30");
  assert.equal(t.budgets, 2870, "Remaining electricity budget is $28.70 ($200.00 - $171.30)");
  assert.equal(t.safe, 720543, "Safe to spend remains $7,205.43 ($7,234.13 - $28.70)");
  assert.equal(state.transactions.length, 1, "No duplicate transaction created when moving Scheduled -> Pending");

  // 3. Transition to Cleared: Transaction confirmed against bank
  evergyTx.status = "cleared";
  t = totals(state, simulatedToday);
  assert.equal(t.balance, 723413, "Cash balance stays $7,234.13 (ledger affected exactly once)");
  assert.equal(spent(state, "Electricity", "2026-10"), 17130, "Electricity spent remains $171.30");
  assert.equal(t.budgets, 2870, "Remaining electricity budget remains $28.70");
  assert.equal(t.safe, 720543, "Safe to spend stays $7,205.43");
  assert.equal(state.transactions.length, 1, "No duplicate transaction created when moving Pending -> Cleared");
});

test("Test G — Scheduled transaction dated today does not affect cash balance", () => {
  const simulatedToday = "2026-10-13";
  const state: State = blank();
  state.opening = 500000; // $5,000.00
  state.payday = "2026-10-21";

  // Enter scheduled expense dated today
  state.transactions.push({
    id: "tx-today-scheduled",
    name: "Doctor Visit Copay",
    amount: -4000, // -$40.00
    category: "Health",
    date: simulatedToday,
    status: "scheduled",
  });

  const t = totals(state, simulatedToday);
  assert.equal(t.balance, 500000, "Transaction dated today marked scheduled must NOT reduce cash balance");
  assert.equal(t.scheduledExpenses, 4000, "Scheduled expenses must be $40.00");
  assert.equal(t.uncoveredScheduledExpenses, 4000, "Unbudgeted scheduled expense is protected in Safe to Spend");
  assert.equal(t.safe, 496000, "Safe to spend protects the scheduled $40.00 ($4,960.00)");
});

test("Test H — Date & Status rules: future date defaults and legacy posted migrations", () => {
  const simulatedToday = "2026-10-13";

  // Test migration mapping
  const backupData = {
    version: 1,
    opening: 100000,
    transactions: [
      // Old posted past transaction -> should become 'pending', NOT 'cleared'
      { id: "t1", name: "Old Grocery", amount: -2500, category: "Groceries", date: "2026-10-01", status: "posted" },
      // Future transaction with no status -> should become 'scheduled'
      { id: "t2", name: "Upcoming Car Insurance", amount: -15000, category: "Insurance", date: "2026-10-20" },
      // Already reconciled cleared transaction -> should stay 'cleared'
      { id: "t3", name: "Reconciled Rent", amount: -130000, category: "Bills", date: "2026-10-01", status: "cleared" },
      // Old pending transaction -> should stay 'pending'
      { id: "t4", name: "Pending Coffee", amount: -500, category: "Dining Out", date: "2026-10-12", status: "pending" },
    ],
    budgets: [],
    bills: [],
    pots: [],
  };

  const migrated = migrateState(backupData, simulatedToday);
  assert.equal(migrated.transactions[0]!.status, "pending", "Old posted transaction must map to pending, not bank-reconciled");
  assert.equal(migrated.transactions[1]!.status, "scheduled", "Future transaction without status must default to scheduled");
  assert.equal(migrated.transactions[2]!.status, "cleared", "Cleared transaction must remain cleared");
  assert.equal(migrated.transactions[3]!.status, "pending", "Pending transaction must remain pending");

  // Balance verification on migrated state
  const t = totals(migrated, simulatedToday);
  // Opening: $1,000.00. Ledger: t1 (-$25), t3 (-$1,300), t4 (-$5) = -$1,330.00
  // t2 (scheduled -$150) does not affect ledger balance!
  assert.equal(t.balance, 100000 - 2500 - 130000 - 500, "Ledger balance counts pending and cleared, but excludes scheduled");
  assert.equal(t.scheduledExpenses, 15000, "Scheduled expense tracked properly");
});

test("Test I — Recurring bill payments with status transitions preserve reservations correctly", () => {
  const simulatedToday = "2026-10-13";
  const state: State = blank();
  state.opening = 500000;
  state.payday = "2026-10-21";

  const bill: Bill = {
    id: "b-water",
    name: "Water Utility",
    amount: 6000, // $60.00
    day: 15,
    protected: false,
    settledDueDates: [],
  };
  state.bills.push(bill);

  // 1. Initially bill is unpaid and reserved
  assert.equal(isBillPaid(state, bill, "2026-10-15"), false);
  let billBreakdown = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(billBreakdown.currentCycleBills, 6000, "Water bill is reserved for current cycle");

  // 2. Schedule bill payment for Oct 15
  const billTx: Transaction = {
    id: "tx-bill-water",
    name: "Water Utility Payment",
    amount: -6000,
    category: "Bills",
    date: "2026-10-15",
    billId: "b-water",
    billDueDate: "2026-10-15",
    status: "scheduled",
  };
  state.transactions.push(billTx);

  // Scheduled transaction has NOT hit the bank ledger yet, so bill is not considered paid
  assert.equal(isBillPaid(state, bill, "2026-10-15"), false, "Scheduled bill transaction does not mark bill paid yet");
  billBreakdown = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(billBreakdown.currentCycleBills, 6000, "Water bill reservation is maintained while scheduled");
  let t = totals(state, simulatedToday);
  assert.equal(t.balance, 500000, "Balance is not deducted for scheduled bill transaction");
  // Total reserved for the bill is $60.00 (from bills reservation), not double counted with scheduledExpenses!
  assert.equal(t.uncoveredScheduledExpenses, 0, "Scheduled bill payment does not duplicate bill reservation");

  // 3. Mark bill transaction Pending
  billTx.status = "pending";
  assert.equal(isBillPaid(state, bill, "2026-10-15"), true, "Pending bill transaction marks bill paid");
  billBreakdown = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(billBreakdown.currentCycleBills, 0, "Bill reservation released once pending");
  t = totals(state, simulatedToday);
  assert.equal(t.balance, 500000 - 6000, "Balance deducted exactly once by pending transaction");
  assert.equal(t.safe, 500000 - 6000, "Safe to spend accounts for paid bill");

  // 4. Mark bill transaction Cleared
  billTx.status = "cleared";
  assert.equal(isBillPaid(state, bill, "2026-10-15"), true, "Cleared bill transaction keeps bill paid");
  t = totals(state, simulatedToday);
  assert.equal(t.balance, 500000 - 6000, "Balance remains deducted exactly once");
  assert.equal(t.safe, 500000 - 6000, "Safe to spend remains consistent");
});

test("Test J — isLedgerStatus helper correctness", () => {
  assert.equal(isLedgerStatus("scheduled"), false);
  assert.equal(isLedgerStatus("pending"), true);
  assert.equal(isLedgerStatus("cleared"), true);
  assert.equal(isLedgerStatus("posted"), true);
  assert.equal(isLedgerStatus(undefined), false);
  assert.equal(isLedgerStatus("unknown"), false);
});

test("Test K — Account data model: checking, savings, and credit card creation", () => {
  const d = "2026-10-14";
  const checking: Account = {
    id: "acc-1",
    name: "Everyday Checking",
    type: "checking",
    opening: 250000, // $2,500.00
    includeInSafeToSpend: true,
    archived: false,
    createdAt: d,
    updatedAt: d,
  };

  const savings: Account = {
    id: "acc-2",
    name: "High Yield Savings",
    type: "savings",
    opening: 1000000, // $10,000.00
    balance: 1000000,
    includeInSafeToSpend: false,
    archived: false,
    createdAt: d,
    updatedAt: d,
  };

  const creditCard: Account = {
    id: "acc-3",
    name: "Cashback Visa",
    type: "credit",
    opening: 45000, // $450.00 owed
    balance: 45000,
    creditLimit: 300000, // $3,000.00
    dueDay: 18,
    minPayment: 3500, // $35.00
    includeInSafeToSpend: false,
    archived: false,
    createdAt: d,
    updatedAt: d,
  };

  assert.equal(checking.type, "checking");
  assert.equal(checking.includeInSafeToSpend, true);
  assert.equal(savings.type, "savings");
  assert.equal(savings.includeInSafeToSpend, false);
  assert.equal(creditCard.type, "credit");
  assert.equal(creditCard.creditLimit, 300000);
  assert.equal(creditCard.dueDay, 18);
  assert.equal(creditCard.minPayment, 3500);
});

test("Test L — Assets vs Liabilities and available credit calculation", () => {
  const state: State = blank();
  state.opening = 200000; // $2,000.00

  // Replace default accounts with test accounts
  const checking: Account = {
    id: "acc-default-checking",
    name: "Primary Checking",
    type: "checking",
    opening: 200000, // $2,000.00
    includeInSafeToSpend: true,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const savings: Account = {
    id: "acc-savings",
    name: "Vacation Savings",
    type: "savings",
    opening: 800000, // $8,000.00
    balance: 800000,
    includeInSafeToSpend: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const card1: Account = {
    id: "acc-card-1",
    name: "Sapphire Preferred",
    type: "credit",
    opening: 50000, // $500.00 owed
    balance: 50000,
    creditLimit: 500000, // $5,000.00 limit
    includeInSafeToSpend: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const card2: Account = {
    id: "acc-card-2",
    name: "Store Card",
    type: "credit",
    opening: 30000, // $300.00 owed
    balance: 30000,
    creditLimit: 100000, // $1,000.00 limit
    includeInSafeToSpend: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking, savings, card1, card2];

  // Available credit checks: limit - balance owed
  assert.equal(getAvailableCredit(card1, state), 450000, "Card 1 available credit: $5,000 - $500 = $4,500");
  assert.equal(getAvailableCredit(card2, state), 70000, "Card 2 available credit: $1,000 - $300 = $700");
  assert.equal(getAvailableCredit(checking, state), 0, "Non-credit account has 0 available credit");

  // Account summary totals
  const summary = accountTotals(state);
  assert.equal(summary.totalCashAssets, 1000000, "Total cash assets: Checking ($2,000) + Savings ($8,000) = $10,000.00");
  assert.equal(summary.totalCreditDebt, 80000, "Total credit card debt: $500 + $300 = $800.00");
  assert.equal(summary.totalAvailableCredit, 520000, "Total available credit: $4,500 + $700 = $5,200.00");
});

test("Test M — Migration from single-balance v1/v2: prevents double-counting and establishes authoritative checking balance", () => {
  const simulatedToday = "2026-10-14";
  const legacyState = {
    version: 2,
    opening: 740543, // $7,405.43
    payday: "2026-10-21",
    transactions: [
      { id: "t1", name: "Groceries", amount: -15000, category: "Groceries", date: "2026-10-10", status: "pending" },
      { id: "t2", name: "Side gig", amount: 40000, category: "Income", date: "2026-10-11", status: "cleared" },
    ],
    budgets: [],
    pots: [],
    bills: [],
  };

  const migrated = migrateState(legacyState, simulatedToday);

  // 1. Exactly 1 default checking account created
  assert.equal(migrated.accounts.length, 1);
  const defChecking = migrated.accounts[0]!;
  assert.equal(defChecking.id, "acc-default-checking");
  assert.equal(defChecking.type, "checking");
  assert.equal(defChecking.name, "Primary Checking");
  assert.equal(defChecking.includeInSafeToSpend, true);

  // 2. Opening balance must match raw opening ($7,405.43), not the post-transaction balance!
  assert.equal(defChecking.opening, 740543);
  assert.equal(migrated.opening, 740543);

  // 3. Authoritative balance derived via getAccountBalance: opening + (-$150 + $400) = $7,655.43
  const expectedBalance = 740543 - 15000 + 40000;
  assert.equal(getAccountBalance(defChecking, migrated), expectedBalance);
  assert.equal(totals(migrated, simulatedToday).balance, expectedBalance);
});

test("Test N — Migration idempotence: multiple runs preserve exact state and balances", () => {
  const simulatedToday = "2026-10-14";
  const legacyState = {
    version: 2,
    opening: 500000,
    payday: "2026-10-21",
    transactions: [
      { id: "t1", name: "Expense", amount: -2500, category: "General", date: "2026-10-10", status: "pending" },
    ],
    budgets: [],
    pots: [],
    bills: [],
  };

  // Run 1
  const m1 = migrateState(legacyState, simulatedToday);
  assert.equal(m1.accounts.length, 1);

  // Run 2: Re-migrating m1
  const m2 = migrateState(m1, simulatedToday);
  assert.equal(m2.accounts.length, 1, "Idempotent: does not duplicate default checking account");
  assert.deepEqual(m2, m1);

  // Run 3: JSON round-trip serialization then re-migrating
  const json = JSON.stringify(m2);
  const parsed = JSON.parse(json);
  const m3 = migrateState(parsed, simulatedToday);
  assert.deepEqual(m3, m2, "JSON round-trip must preserve identical account structure and balances");
});

test("Test O — Safe to Spend eligibility: savings and credit cards do not inflate Safe to Spend", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  state.opening = 500000; // $5,000.00
  state.payday = "2026-10-21";

  // Primary checking ($5,000)
  const checking: Account = {
    id: "acc-default-checking",
    name: "Primary Checking",
    type: "checking",
    opening: 500000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };

  // Large savings account ($50,000.00) with includeInSafeToSpend: false
  const savings: Account = {
    id: "acc-savings-huge",
    name: "Home Down Payment",
    type: "savings",
    opening: 5000000, // $50,000.00
    balance: 5000000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };

  // Credit card with $20,000 limit and $1,500 owed
  const credit: Account = {
    id: "acc-credit",
    name: "Platinum Card",
    type: "credit",
    opening: 150000, // $1,500 owed
    balance: 150000,
    creditLimit: 2000000, // $20,000 limit
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };

  state.accounts = [checking, savings, credit];

  // Pots: $1,000
  state.pots.push({ id: "p1", name: "Car Fund", saved: 100000, target: 200000, color: "#277c78" });

  const t = totals(state, simulatedToday);
  // Safe to Spend must strictly be based on checking: $5,000 - $1,000 (pots) = $4,000.00
  // NOT $54,000 or $74,000!
  assert.equal(t.balance, 500000, "Totals balance remains strictly the primary cash ledger");
  assert.equal(t.safe, 400000, "Safe to spend is $4,000.00; savings and credit limit do NOT inflate spendable cash");

  // Account totals separately report assets and debts
  const summary = accountTotals(state);
  assert.equal(summary.totalCashAssets, 5500000, "Cash assets report $55,000 total ($5k checking + $50k savings)");
  assert.equal(summary.totalCreditDebt, 150000, "Credit debt reports $1,500 owed");
  assert.equal(summary.totalAvailableCredit, 1850000, "Available credit reports $18,500");
});

test("Test P — Manual balance adjustments vs metadata edits: separation of concerns", () => {
  const state: State = blank();
  state.opening = 400000; // $4,000.00

  // 1. Primary checking with transaction
  const checking: Account = {
    id: "acc-default-checking",
    name: "Primary Checking",
    type: "checking",
    opening: 400000,
    includeInSafeToSpend: true,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.transactions.push({
    id: "t1",
    name: "Coffee",
    amount: -500, // -$5.00
    category: "Dining Out",
    date: "2026-10-14",
    status: "cleared",
  });

  // Current balance is $3,995.00
  assert.equal(getAccountBalance(checking, state), 399500);

  // Manual balance adjustment on primary checking to $4,500.00
  const postedSum = -500;
  const newCheckingBalance = 450000;
  state.opening = newCheckingBalance - postedSum; // $4,500 - (-$5) = $4,505.00
  checking.opening = state.opening;

  // Now checking balance is exactly $4,500.00, preserving transaction history
  assert.equal(getAccountBalance(checking, state), 450000);
  assert.equal(state.transactions.length, 1, "Transaction history preserved");

  // 2. Standalone savings account
  const savings: Account = {
    id: "acc-savings-2",
    name: "Emergency Fund",
    type: "savings",
    opening: 1000000,
    balance: 1000000,
    includeInSafeToSpend: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking, savings];

  // Metadata edit (rename) does NOT change balance
  savings.name = "Rainy Day Savings";
  assert.equal(savings.balance, 1000000, "Metadata edit does not touch balance");

  // Balance adjustment on savings account updates its balance without touching checking opening
  savings.balance = 1250000; // $12,500.00
  assert.equal(getAccountBalance(savings, state), 1250000);
  assert.equal(getAccountBalance(checking, state), 450000, "Checking balance unchanged by savings adjustment");
  assert.equal(state.opening, 450500, "State opening unchanged by savings adjustment");
});

test("Test Q — Archiving and unarchiving accounts preserves records and protects primary checking", () => {
  const state: State = blank();
  const checking: Account = {
    id: "acc-default-checking",
    name: "Primary Checking",
    type: "checking",
    opening: 300000,
    includeInSafeToSpend: true,
    archived: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const oldSavings: Account = {
    id: "acc-old-savings",
    name: "Old Bank Savings",
    type: "savings",
    opening: 50000,
    balance: 50000,
    includeInSafeToSpend: false,
    archived: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking, oldSavings];

  // Initial totals
  let totalsBefore = accountTotals(state);
  assert.equal(totalsBefore.activeCount, 2);
  assert.equal(totalsBefore.archivedCount, 0);
  assert.equal(totalsBefore.totalCashAssets, 350000);

  // Archive old savings
  oldSavings.archived = true;

  let totalsAfter = accountTotals(state);
  assert.equal(totalsAfter.activeCount, 1);
  assert.equal(totalsAfter.archivedCount, 1);
  assert.equal(totalsAfter.totalCashAssets, 300000, "Archived account excluded from active cash assets");
  assert.equal(state.accounts.length, 2, "Archived account is preserved in data model");

  // Restore old savings
  oldSavings.archived = false;
  let totalsRestored = accountTotals(state);
  assert.equal(totalsRestored.activeCount, 2);
  assert.equal(totalsRestored.totalCashAssets, 350000);
});

test("Test R — Edge cases: zero balances, credit limit exceeded, and negative amounts", () => {
  const state: State = blank();
  const zeroChecking: Account = {
    id: "acc-zero",
    name: "Zero Checking",
    type: "checking",
    opening: 0,
    includeInSafeToSpend: true,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const maxedCard: Account = {
    id: "acc-maxed",
    name: "Over-limit Card",
    type: "credit",
    opening: 120000, // $1,200 owed
    balance: 120000,
    creditLimit: 100000, // $1,000 limit
    includeInSafeToSpend: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const zeroLimitCard: Account = {
    id: "acc-zero-limit",
    name: "Secured Card Pending",
    type: "credit",
    opening: 0,
    balance: 0,
    creditLimit: 0,
    includeInSafeToSpend: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };

  state.accounts = [zeroChecking, maxedCard, zeroLimitCard];

  // Zero balance account returns 0
  assert.equal(getAccountBalance(zeroChecking, state), 0);

  // Over-limit card has available credit clamped to 0 (never negative)
  assert.equal(getAvailableCredit(maxedCard, state), 0, "Available credit clamped to 0 when balance exceeds limit");

  // Zero limit card has 0 available credit
  assert.equal(getAvailableCredit(zeroLimitCard, state), 0);
});

// ============================================================================
// Phase 2A: Account-Aware Transactions Test Suite (Tests 2A.1 through 2A.14)
// ============================================================================

test("Test 2A.1 — Checking account income and expenses", () => {
  const state: State = blank();
  const checking: Account = {
    id: "acc-checking-1",
    name: "Main Checking",
    type: "checking",
    opening: 200000, // $2,000.00
    includeInSafeToSpend: true,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking];

  // 1. Initial balance
  assert.equal(getAccountBalance(checking, state), 200000);

  // 2. Clear income transaction: $500.00
  state.transactions.push({
    id: "tx-inc",
    name: "Consulting Pay",
    amount: 50000,
    category: "Income",
    date: "2026-10-14",
    status: "cleared",
    accountId: checking.id,
    kind: "standard",
  });
  assert.equal(getAccountBalance(checking, state), 250000, "Income increases checking balance to $2,500");

  // 3. Clear expense transaction: $150.00
  state.transactions.push({
    id: "tx-exp",
    name: "Target Supplies",
    amount: -15000,
    category: "Groceries",
    date: "2026-10-14",
    status: "cleared",
    accountId: checking.id,
    kind: "standard",
  });
  assert.equal(getAccountBalance(checking, state), 235000, "Expense decreases checking balance to $2,350");
  assert.equal(accountTotals(state).totalCashAssets, 235000);
});

test("Test 2A.2 — Credit card purchases and refunds", () => {
  const state: State = blank();
  const checking: Account = {
    id: "acc-checking-1",
    name: "Main Checking",
    type: "checking",
    opening: 200000, // $2,000.00 cash
    includeInSafeToSpend: true,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const card: Account = {
    id: "acc-card-1",
    name: "Freedom Card",
    type: "credit",
    opening: 30000, // $300.00 balance owed
    creditLimit: 100000, // $1,000.00 limit
    includeInSafeToSpend: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking, card];

  // Starting state
  assert.equal(getAccountBalance(card, state), 30000, "Initial debt owed is $300");
  assert.equal(getAvailableCredit(card, state), 70000, "Initial available credit is $700");
  assert.equal(getAccountBalance(checking, state), 200000, "Cash balance is $2,000");

  // 1. Credit card purchase of $80.00
  state.transactions.push({
    id: "tx-card-buy",
    name: "Online Bookstore",
    amount: -8000,
    category: "Entertainment",
    date: "2026-10-14",
    status: "cleared",
    accountId: card.id,
    kind: "standard",
  });

  assert.equal(getAccountBalance(card, state), 38000, "Purchase increases card balance owed to $380");
  assert.equal(getAvailableCredit(card, state), 62000, "Available credit decreases to $620");
  assert.equal(getAccountBalance(checking, state), 200000, "Credit card purchase must NOT decrease cash balance");
  assert.equal(accountTotals(state).totalCashAssets, 200000);

  // 2. Merchant refund on credit card of $30.00
  state.transactions.push({
    id: "tx-card-refund",
    name: "Bookstore Return",
    amount: 3000,
    category: "Entertainment",
    date: "2026-10-14",
    status: "cleared",
    accountId: card.id,
    kind: "standard",
  });

  assert.equal(getAccountBalance(card, state), 35000, "Refund decreases card balance owed to $350");
  assert.equal(getAvailableCredit(card, state), 65000, "Available credit restored to $650");
  assert.equal(getAccountBalance(checking, state), 200000, "Cash balance remains untouched by card refund");
});

test("Test 2A.3 — Credit card payments (cash to credit card)", () => {
  const state: State = blank();
  const checking: Account = {
    id: "acc-checking-1",
    name: "Checking",
    type: "checking",
    opening: 200000, // $2,000.00
    includeInSafeToSpend: true,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const card: Account = {
    id: "acc-card-1",
    name: "Visa Card",
    type: "credit",
    opening: 50000, // $500.00 balance owed
    creditLimit: 150000, // $1,500.00 limit
    includeInSafeToSpend: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking, card];

  // User records $200.00 payment from Checking to Credit Card
  state.transactions.push({
    id: "tx-cc-pay",
    name: "Card Monthly Payment",
    amount: -20000, // $200.00
    category: "Payment",
    date: "2026-10-14",
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
  });

  assert.equal(getAccountBalance(checking, state), 180000, "Checking balance decreases to $1,800");
  assert.equal(getAccountBalance(card, state), 30000, "Credit card balance owed decreases to $300");
  assert.equal(getAvailableCredit(card, state), 120000, "Available credit increases by $200 to $1,200");

  // Payment must not count as a spending category expense
  assert.equal(spent(state, "Payment"), 0, "Credit card payment does not reduce category spending");
  assert.equal(spent(state, "General"), 0);
});

test("Test 2A.4 — Checking-to-savings transfers", () => {
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 200000, // $2,000.00
    includeInSafeToSpend: true,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const savings: Account = {
    id: "acc-sav",
    name: "Savings",
    type: "savings",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking, savings];

  // Transfer $300 from checking to savings
  state.transactions.push({
    id: "tx-xfer-1",
    name: "Transfer to Savings",
    amount: -30000, // $300.00
    category: "Transfer",
    date: "2026-10-14",
    status: "cleared",
    accountId: checking.id,
    kind: "transfer",
    targetAccountId: savings.id,
  });

  assert.equal(getAccountBalance(checking, state), 170000, "Checking balance decreases to $1,700");
  assert.equal(getAccountBalance(savings, state), 130000, "Savings balance increases to $1,300");
});

test("Test 2A.5 — Transfers that do not change total cash assets", () => {
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 200000,
    includeInSafeToSpend: true,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const savings: Account = {
    id: "acc-sav",
    name: "Savings",
    type: "savings",
    opening: 100000,
    includeInSafeToSpend: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking, savings];

  const beforeSummary = accountTotals(state);
  assert.equal(beforeSummary.totalCashAssets, 300000, "Total cash assets before transfer: $3,000");

  state.transactions.push({
    id: "tx-xfer-2",
    name: "Emergency Fund Top-up",
    amount: -30000,
    category: "Transfer",
    date: "2026-10-14",
    status: "cleared",
    accountId: checking.id,
    kind: "transfer",
    targetAccountId: savings.id,
  });

  const afterSummary = accountTotals(state);
  assert.equal(afterSummary.totalCashAssets, 300000, "Total cash assets after transfer must remain exactly $3,000");
  assert.equal(spent(state, "Transfer"), 0, "Transfers must not count as spending");
});

test("Test 2A.6 — Pending-to-cleared transitions without duplicate balance changes", () => {
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: true,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking];

  // 1. Transaction entered as Pending
  const tx: Transaction = {
    id: "tx-pending-1",
    name: "Grocery Store",
    amount: -10000, // -$100.00
    category: "Groceries",
    date: "2026-10-14",
    status: "pending",
    accountId: checking.id,
    kind: "standard",
  };
  state.transactions.push(tx);

  assert.equal(getAccountBalance(checking, state), 90000, "Pending transaction reflects in balance ($900)");

  // 2. Transition from Pending to Cleared
  tx.status = "cleared";
  assert.equal(getAccountBalance(checking, state), 90000, "Transitioning from pending to cleared must NOT deduct balance twice");
});

test("Test 2A.7 — Scheduled transactions not changing current balances", () => {
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const savings: Account = {
    id: "acc-sav",
    name: "Savings",
    type: "savings",
    opening: 50000,
    includeInSafeToSpend: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const card: Account = {
    id: "acc-crd",
    name: "Card",
    type: "credit",
    opening: 20000,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking, savings, card];

  // Add scheduled transactions
  state.transactions.push(
    { id: "s1", name: "Future Paycheck", amount: 50000, category: "Income", date: "2026-10-25", status: "scheduled", accountId: checking.id, kind: "standard" },
    { id: "s2", name: "Future Expense", amount: -25000, category: "General", date: "2026-10-25", status: "scheduled", accountId: checking.id, kind: "standard" },
    { id: "s3", name: "Scheduled Transfer", amount: -30000, category: "Transfer", date: "2026-10-25", status: "scheduled", accountId: checking.id, kind: "transfer", targetAccountId: savings.id },
    { id: "s4", name: "Scheduled Card Payment", amount: -15000, category: "Payment", date: "2026-10-25", status: "scheduled", accountId: checking.id, kind: "payment", targetAccountId: card.id },
  );

  assert.equal(getAccountBalance(checking, state), 100000, "Checking balance unchanged by scheduled items");
  assert.equal(getAccountBalance(savings, state), 50000, "Savings balance unchanged by scheduled items");
  assert.equal(getAccountBalance(card, state), 20000, "Credit card debt unchanged by scheduled items");
});

test("Test 2A.8 — Transaction editing and deletion", () => {
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: true,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking];

  // 1. Add transaction: $100
  const tx: Transaction = {
    id: "tx-edit",
    name: "Dining",
    amount: -10000,
    category: "Dining Out",
    date: "2026-10-14",
    status: "cleared",
    accountId: checking.id,
    kind: "standard",
  };
  state.transactions.push(tx);
  assert.equal(getAccountBalance(checking, state), 90000, "Balance is $900 after $100 expense");

  // 2. Edit amount to $150
  tx.amount = -15000;
  assert.equal(getAccountBalance(checking, state), 85000, "Balance correctly updates to $850 after edit");

  // 3. Delete transaction
  state.transactions = state.transactions.filter((t) => t.id !== "tx-edit");
  assert.equal(getAccountBalance(checking, state), 100000, "Balance correctly reverts to $1,000 after deletion");
});

test("Test 2A.9 — Safe to Spend using only eligible cash accounts", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();

  const checking: Account = {
    id: "acc-chk-main",
    name: "Primary Checking",
    type: "checking",
    opening: 200000, // $2,000.00
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const savings: Account = {
    id: "acc-sav-hysa",
    name: "High-Yield Savings",
    type: "savings",
    opening: 1000000, // $10,000.00
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-crd-visa",
    name: "Credit Card",
    type: "credit",
    opening: 40000, // $400.00 debt owed
    creditLimit: 500000, // $5,000.00 limit
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  state.accounts = [checking, savings, card];

  // Pot with $500 saved
  state.pots.push({ id: "p1", name: "Vacation", saved: 50000, target: 100000, color: "#277c78" });

  const t = totals(state, simulatedToday);

  // Safe to Spend must strictly be Checking ($2,000) minus Pot ($500) = $1,500.00
  // Savings ($10k) and Credit Card ($5k limit / $400 debt) must NOT be included!
  assert.equal(t.balance, 200000, "Totals balance strictly equals eligible checking cash balance");
  assert.equal(t.pots, 50000);
  assert.equal(t.safe, 150000, "Safe to spend is $1,500.00 (eligible cash minus pot)");
});

test("Test 2A.10 — Existing pots and recurring bills remaining intact", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  state.payday = "2026-10-28";
  state.followingPayday = "2026-11-11";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 500000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const savings: Account = {
    id: "acc-sav",
    name: "Savings",
    type: "savings",
    opening: 200000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  state.accounts = [checking, savings];

  // Pot: $500 saved
  state.pots.push({ id: "pot-1", name: "Car Maintenance", saved: 50000, target: 150000, color: "#277c78" });

  // Bill: Internet $100 due on the 20th (within current cycle)
  state.bills.push({ id: "bill-net", name: "Internet", amount: 10000, day: 20, protected: false, settledDueDates: [] });

  const beforeTotals = totals(state, simulatedToday);
  assert.equal(beforeTotals.pots, 50000);
  assert.equal(beforeTotals.bills, 10000);

  // Perform checking-to-savings transfer
  state.transactions.push({
    id: "tx-xfer",
    name: "Transfer to Savings",
    amount: -100000,
    category: "Transfer",
    date: simulatedToday,
    status: "cleared",
    accountId: checking.id,
    kind: "transfer",
    targetAccountId: savings.id,
  });

  const afterTotals = totals(state, simulatedToday);
  assert.equal(afterTotals.pots, 50000, "Pots remain intact");
  assert.equal(afterTotals.bills, 10000, "Bill reservations remain intact");
  assert.equal(afterTotals.balance, 400000, "Checking balance reduced by transfer");
  assert.equal(afterTotals.safe, 340000, "Safe to spend correctly updates ($4,000 - $500 - $100 = $3,400)");
});

test("Test 2A.11 — Legacy transaction migration without double-counting", () => {
  const simulatedToday = "2026-10-14";
  const legacyV2 = {
    version: 2,
    demo: false,
    opening: 150000, // $1,500.00
    payday: "2026-10-28",
    transactions: [
      { id: "leg-1", name: "Freelance", amount: 50000, category: "Income", date: "2026-10-10", status: "posted" },
      { id: "leg-2", name: "Groceries", amount: -20000, category: "Groceries", date: "2026-10-11", status: "posted" },
    ],
    budgets: [],
    pots: [],
    bills: [],
  };

  const migrated1 = migrateState(legacyV2, simulatedToday);
  const checking1 = migrated1.accounts.find((a) => a.id === "acc-default-checking")!;
  assert.ok(checking1, "Primary checking created");
  assert.equal(checking1.includeInSafeToSpend, true);
  assert.equal(migrated1.transactions[0]!.accountId, "acc-default-checking");
  assert.equal(migrated1.transactions[0]!.kind, "standard");

  // Balance: opening $1,500 + $500 - $200 = $1,800
  assert.equal(getAccountBalance(checking1, migrated1), 180000, "Authoritative balance is $1,800");

  // Idempotent migration: running again must not apply transactions twice
  const migrated2 = migrateState(migrated1, simulatedToday);
  const checking2 = migrated2.accounts.find((a) => a.id === "acc-default-checking")!;
  assert.equal(getAccountBalance(checking2, migrated2), 180000, "Idempotent re-migration preserves exact balance without double-counting");
});

test("Test 2A.12 — Backup export/import round trips", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 300000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const savings: Account = {
    id: "acc-sav",
    name: "Savings",
    type: "savings",
    opening: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Mika Card",
    type: "credit",
    opening: 25000,
    creditLimit: 200000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  state.accounts = [checking, savings, card];

  state.transactions.push(
    { id: "t1", name: "Transfer to Savings", amount: -50000, category: "Transfer", date: simulatedToday, status: "cleared", accountId: checking.id, kind: "transfer", targetAccountId: savings.id },
    { id: "t2", name: "Card Payment", amount: -10000, category: "Payment", date: simulatedToday, status: "cleared", accountId: checking.id, kind: "payment", targetAccountId: card.id },
  );

  const exported = JSON.stringify(state);
  const imported = migrateState(JSON.parse(exported), simulatedToday);

  assert.equal(imported.accounts.length, 3);
  assert.equal(imported.transactions.length, 2);

  const impChecking = imported.accounts.find((a) => a.id === checking.id)!;
  const impSavings = imported.accounts.find((a) => a.id === savings.id)!;
  const impCard = imported.accounts.find((a) => a.id === card.id)!;

  assert.equal(getAccountBalance(impChecking, imported), 240000, "Checking balance preserved ($3,000 - $500 - $100 = $2,400)");
  assert.equal(getAccountBalance(impSavings, imported), 150000, "Savings balance preserved ($1,000 + $500 = $1,500)");
  assert.equal(getAccountBalance(impCard, imported), 15000, "Card debt preserved ($250 - $100 = $150)");
  assert.equal(getAvailableCredit(impCard, imported), 185000, "Available credit preserved ($2,000 - $150 = $1,850)");
});

test("Test 2A.13 — Balance adjustments after transaction history exists", () => {
  const state: State = blank();
  const checking: Account = {
    id: "acc-default-checking",
    name: "Primary Checking",
    type: "checking",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: true,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking];

  // Historical transactions: +$200 income, -$50 expense
  state.transactions.push(
    { id: "tx-hist-1", name: "Side gig", amount: 20000, category: "Income", date: "2026-10-10", status: "cleared", accountId: checking.id, kind: "standard" },
    { id: "tx-hist-2", name: "Snacks", amount: -5000, category: "Groceries", date: "2026-10-11", status: "cleared", accountId: checking.id, kind: "standard" },
  );

  assert.equal(getAccountBalance(checking, state), 115000, "Current balance with history is $1,150.00");

  // Adjust balance to $1,500.00
  const targetBalance = 150000;
  const currentDelta = getAccountLedgerDelta(checking, state); // +15000
  checking.opening = targetBalance - currentDelta; // $1,500 - $150 = $1,350
  state.opening = checking.opening;

  assert.equal(getAccountBalance(checking, state), 150000, "Adjusted balance is immediately $1,500.00");

  // Subsequent transaction: -$100 expense
  state.transactions.push({
    id: "tx-subsequent",
    name: "Gas Station",
    amount: -10000,
    category: "Transport",
    date: "2026-10-14",
    status: "cleared",
    accountId: checking.id,
    kind: "standard",
  });

  assert.equal(getAccountBalance(checking, state), 140000, "New transaction applies from adjusted baseline ($1,500 - $100 = $1,400)");
});

test("Test 2A.14 — Insufficient funds, invalid transfers, and missing or archived accounts", () => {
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    archived: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const savings: Account = {
    id: "acc-sav",
    name: "Savings",
    type: "savings",
    opening: 50000,
    includeInSafeToSpend: false,
    archived: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  const card: Account = {
    id: "acc-crd",
    name: "Card",
    type: "credit",
    opening: 150000, // $1,500 owed
    creditLimit: 100000, // $1,000 limit (over-limit)
    includeInSafeToSpend: false,
    archived: false,
    createdAt: "2026-10-14",
    updatedAt: "2026-10-14",
  };
  state.accounts = [checking, savings, card];

  // 1. Over-limit card available credit remains clamped to 0
  assert.equal(getAvailableCredit(card, state), 0, "Available credit clamped to 0 when over limit");

  // 2. Archive savings account
  savings.archived = true;
  const summary = accountTotals(state);
  assert.equal(summary.totalCashAssets, 100000, "Archived account cash excluded from active totals");

  // 3. Transactions on archived accounts do not crash and remain calculated
  state.transactions.push({
    id: "tx-archived-hist",
    name: "Old Interest",
    amount: 500,
    category: "Income",
    date: "2026-10-14",
    status: "cleared",
    accountId: savings.id,
    kind: "standard",
  });
  assert.equal(getAccountBalance(savings, state), 50500, "Archived account balance continues calculating accurately");

  // 4. Missing / unmatched account reference does not crash
  state.transactions.push({
    id: "tx-orphan",
    name: "Unknown Transaction",
    amount: -2500,
    category: "General",
    date: "2026-10-14",
    status: "cleared",
    accountId: "acc-non-existent",
    kind: "standard",
  });
  assert.equal(getAccountBalance(checking, state), 100000, "Orphan transaction does not alter existing checking balance");
});

test("Test 2A.15 — Account deletion guards: $0 balance and 0 linked transactions required; archiving preserves history", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();

  const checking: Account = {
    id: "acc-default-checking",
    name: "Primary Checking",
    type: "checking",
    opening: 200000, // $2,000.00
    includeInSafeToSpend: true,
    archived: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };

  const cleanSavings: Account = {
    id: "acc-clean-sav",
    name: "Vacation Fund",
    type: "savings",
    opening: 0, // $0.00 balance
    includeInSafeToSpend: false,
    archived: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };

  const fundedSavings: Account = {
    id: "acc-funded-sav",
    name: "Rainy Day",
    type: "savings",
    opening: 50000, // $500.00 balance, but 0 transactions
    includeInSafeToSpend: false,
    archived: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };

  const transferSavings: Account = {
    id: "acc-transfer-sav",
    name: "Emergency Savings",
    type: "savings",
    opening: 0,
    includeInSafeToSpend: false,
    archived: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };

  const creditCard: Account = {
    id: "acc-rewards-visa",
    name: "Mika Visa",
    type: "credit",
    opening: 0,
    creditLimit: 500000,
    includeInSafeToSpend: false,
    archived: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };

  state.accounts = [checking, cleanSavings, fundedSavings, transferSavings, creditCard];

  // Rule 1 & 5: Primary checking cannot be deleted
  assert.equal(canDeleteAccount(checking, state), false, "Primary checking cannot be deleted");
  assert.equal(getAccountDeletionBlockReason(checking, state), "primary_checking", "Block reason is primary_checking");

  // Rule 1: Permanent deletion allowed ONLY when account has $0 balance and 0 linked transactions
  assert.equal(getAccountBalance(cleanSavings, state), 0, "Clean savings balance is $0");
  assert.equal(getAccountTransactionCount(cleanSavings, state), 0, "Clean savings has 0 transactions");
  assert.equal(canDeleteAccount(cleanSavings, state), true, "Clean savings can be deleted");
  assert.equal(getAccountDeletionBlockReason(cleanSavings, state), null, "Block reason is null");

  // Rule 4: Nonzero balance blocks deletion even with 0 transactions
  assert.equal(getAccountTransactionCount(fundedSavings, state), 0, "Funded savings has 0 transactions");
  assert.equal(getAccountBalance(fundedSavings, state), 50000, "Funded savings has $500 balance");
  assert.equal(canDeleteAccount(fundedSavings, state), false, "Funded savings cannot be deleted");
  assert.equal(getAccountDeletionBlockReason(fundedSavings, state), "has_balance", "Block reason is has_balance");

  // Rule 1 & 2: Linked transfers block deletion
  state.transactions.push({
    id: "tx-transfer-1",
    name: "Transfer to Emergency",
    amount: -30000,
    category: "Transfer",
    date: simulatedToday,
    status: "cleared",
    accountId: checking.id,
    kind: "transfer",
    targetAccountId: transferSavings.id,
  });

  assert.equal(getAccountTransactionCount(transferSavings, state), 1, "Transfer savings has 1 linked transfer");
  assert.equal(canDeleteAccount(transferSavings, state), false, "Transfer savings cannot be deleted due to linked transfer");
  assert.equal(getAccountDeletionBlockReason(transferSavings, state), "has_balance", "Balance is now $300 (nonzero)");

  // Even if balance were brought to $0, linked transaction blocks deletion
  transferSavings.opening = -30000; // Offsets the +$300 transfer to make balance $0
  assert.equal(getAccountBalance(transferSavings, state), 0, "Balance adjusted to $0");
  assert.equal(canDeleteAccount(transferSavings, state), false, "Account with 0 balance but linked transfer cannot be deleted");
  assert.equal(getAccountDeletionBlockReason(transferSavings, state), "has_transactions", "Block reason is has_transactions");

  // Rule 1 & 2: Linked credit card payments block deletion
  state.transactions.push({
    id: "tx-payment-1",
    name: "Visa Payment",
    amount: -10000,
    category: "Payment",
    date: simulatedToday,
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: creditCard.id,
  });

  assert.equal(getAccountTransactionCount(creditCard, state), 1, "Credit card has 1 linked payment");
  assert.equal(canDeleteAccount(creditCard, state), false, "Credit card cannot be deleted due to linked payment");

  // Rule 3: Transactions must NEVER be deleted, modified, or reassigned when checking deletion
  const txCountBefore = state.transactions.length;
  assert.equal(txCountBefore, 2, "2 transactions exist");
  assert.equal(canDeleteAccount(transferSavings, state), false);
  assert.equal(state.transactions.length, txCountBefore, "Transaction list is completely untouched");
  assert.equal(state.transactions[0]!.targetAccountId, transferSavings.id, "Transfer targetAccountId is unchanged");

  // Rule 6 & 7: Archiving preserves accounts for reporting and reconciliation without breaking balance math
  transferSavings.archived = true;
  assert.equal(transferSavings.archived, true, "Account is successfully archived");
  // Checking remains accurate ($2,000 - $300 transfer - $100 payment = $1,600)
  assert.equal(getAccountBalance(checking, state), 160000, "Checking balance intact with archived accounts");
  // Archived account balance remains accurate ($0 opening + $300 transfer delta = $300)
  transferSavings.opening = 0;
  assert.equal(getAccountBalance(transferSavings, state), 30000, "Archived account balance reconciles accurately");
});

test("Test 2B.1 — Chronological sequence: Owe $100, pay $40 uncovered, then reserve $60. Ready to Pay must equal $60", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-checking-1",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-card-1",
    name: "Credit Card",
    type: "credit",
    opening: 10000, // $100.00 pre-baseline debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];

  // Initial check: card owes $100, Ready to Pay = 0, Uncovered = $100
  let cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 10000, "Card owes $100.00");
  assert.equal(cov.readyToPay, 0, "Ready to Pay is $0.00 before reserve");
  assert.equal(cov.uncoveredDebt, 10000, "Uncovered debt is $100.00");

  // Step 1: User pays $40 uncovered from checking to credit card
  state.transactions.push({
    id: "tx-pay-40",
    name: "Card payment",
    amount: -4000,
    category: "Payment",
    date: simulatedToday,
    createdAt: `${simulatedToday}T10:00:00.000Z`,
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
  });

  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(getAccountBalance(checking, state), 96000, "Checking balance decreases to $960.00");
  assert.equal(cov.totalOwed, 6000, "Total owed decreases to $60.00");
  assert.equal(cov.readyToPay, 0, "Ready to pay remains $0 (payment was uncovered)");
  assert.equal(cov.uncoveredDebt, 6000, "Uncovered debt decreases to $60.00");

  // Step 2: User assigns $60 manual reserve to pay remaining debt
  assignCardPaymentReserve(card, 6000, `${simulatedToday}T14:00:00.000Z`);

  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 6000, "Total owed is $60.00");
  assert.equal(cov.readyToPay, 6000, "Ready to Pay MUST equal $60.00 (past payment did not consume it)");
  assert.equal(cov.uncoveredDebt, 0, "Uncovered debt is $0.00");

  // Safe to spend check: $960 checking - $60 Ready to Pay = $900
  const t = totals(state, simulatedToday);
  assert.equal(t.totalReadyToPay, 6000);
  assert.equal(t.totalCreditOwed, 6000);
  assert.equal(t.totalUncoveredDebt, 0);
  assert.equal(t.safe, 90000, "Safe to spend correctly reserves $60 ($960 - $60 = $900)");
});

test("Test 2B.2 — Reverse sequence: Reserve $100 first, then pay $40. Ready to Pay must equal $60", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-checking-2",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-card-2",
    name: "Credit Card",
    type: "credit",
    opening: 10000, // $100.00 debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];

  // User reserves $100 first
  assignCardPaymentReserve(card, 10000, `${simulatedToday}T09:00:00.000Z`);
  let cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.readyToPay, 10000, "Ready to Pay is $100.00");
  assert.equal(cov.uncoveredDebt, 0, "Fully covered");

  const tBefore = totals(state, simulatedToday);
  assert.equal(tBefore.safe, 90000, "Safe to Spend is $1,000 - $100 = $900");

  // User pays $40
  state.transactions.push({
    id: "tx-pay-40-rev",
    name: "Card payment",
    amount: -4000,
    category: "Payment",
    date: simulatedToday,
    createdAt: `${simulatedToday}T15:00:00.000Z`,
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
  });

  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 6000, "Total owed drops to $60.00");
  assert.equal(cov.readyToPay, 6000, "Ready to Pay is exactly $60.00");
  assert.equal(cov.uncoveredDebt, 0, "Uncovered debt remains $0");

  // Safe to Spend is 100% stable across payment: $960 checking - $60 Ready to Pay = $900
  const tAfter = totals(state, simulatedToday);
  assert.equal(tAfter.safe, 90000, "Safe to Spend is completely invariant across payment ($900.00)");
});

test("Test 2B.3 — Reservation release limits and payment deletion reversibility", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-checking-3",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-card-3",
    name: "Credit Card",
    type: "credit",
    opening: 10000, // $100 debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];

  assignCardPaymentReserve(card, 10000, `${simulatedToday}T09:00:00.000Z`);

  const payment: Transaction = {
    id: "tx-pay-delete",
    name: "Card payment",
    amount: -4000,
    category: "Payment",
    date: simulatedToday,
    createdAt: `${simulatedToday}T11:00:00.000Z`,
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
  };
  state.transactions.push(payment);

  let cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.readyToPay, 6000, "Ready to Pay is $60.00");

  // Release $20 from reserve
  const released = releaseCardPaymentReserve(card, 2000, state, `${simulatedToday}T16:00:00.000Z`);
  assert.equal(released, true, "Release of $20 is successful");

  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.readyToPay, 4000, "Ready to Pay is reduced to $40.00");
  assert.equal(cov.uncoveredDebt, 2000, "Uncovered debt is now $20.00");

  // Cannot release more than currently Ready to Pay ($40)
  const overRelease = releaseCardPaymentReserve(card, 5000, state, `${simulatedToday}T17:00:00.000Z`);
  assert.equal(overRelease, false, "Over-release beyond readyToPay is rejected");

  // Reversibility: delete the $40 payment
  state.transactions = state.transactions.filter((t) => t.id !== payment.id);
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 10000, "Total owed returns to $100.00");
  assert.equal(cov.readyToPay, 8000, "Ready to Pay returns to $80.00 ($100 assigned - $20 released)");
  assert.equal(cov.uncoveredDebt, 2000, "Uncovered debt is $20.00");
});

test("Test 2B.4 — Safeguard 2: Refund-after-payment statement credit does not create cash-backed spending availability", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-checking-4",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-card-4",
    name: "Credit Card",
    type: "credit",
    opening: 0,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  const groceriesBudget: Budget = {
    id: "b-groc",
    category: "Groceries",
    limit: 10000, // $100.00
    color: "#277c78",
  };
  state.accounts = [checking, card];
  state.budgets = [groceriesBudget];

  // 1. Buy $50 groceries on Credit Card
  state.transactions.push({
    id: "tx-groc-card",
    name: "Trader Joe's",
    amount: -5000,
    category: "Groceries",
    date: simulatedToday,
    createdAt: `${simulatedToday}T09:00:00.000Z`,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
  });

  let cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 5000, "Card owes $50.00");
  assert.equal(cov.readyToPay, 5000, "Auto-covered by Groceries budget into Ready to Pay");

  // 2. Pay card $50 from checking
  state.transactions.push({
    id: "tx-pay-groc",
    name: "Pay Card",
    amount: -5000,
    category: "Payment",
    date: simulatedToday,
    createdAt: `${simulatedToday}T11:00:00.000Z`,
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
  });

  assert.equal(getAccountBalance(checking, state), 95000, "Checking cash is now $950.00");
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 0, "Card is fully paid off");
  assert.equal(cov.readyToPay, 0, "Ready to Pay is $0.00");

  // 3. Store issues $50 refund to Credit Card
  state.transactions.push({
    id: "tx-refund-card",
    name: "Store Refund",
    amount: 5000,
    category: "Groceries",
    date: simulatedToday,
    createdAt: `${simulatedToday}T14:00:00.000Z`,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
  });

  assert.equal(getAccountBalance(checking, state), 95000, "Checking cash did NOT increase ($950.00)");
  assert.equal(getAccountBalance(card, state), -5000, "Card balance is -$50.00 (Statement Credit)");
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 0, "Total owed is $0.00");
  assert.equal(cov.statementCredit, 5000, "Statement credit is $50.00");
  assert.equal(cov.readyToPay, 0, "Ready to pay remains $0.00");

  // 4. Checking account purchase in Groceries:
  // User spends $100 on groceries with checking debit card
  state.transactions.push({
    id: "tx-checking-groc",
    name: "Costco Debit",
    amount: -10000,
    category: "Groceries",
    date: simulatedToday,
    createdAt: `${simulatedToday}T16:00:00.000Z`,
    status: "cleared",
    accountId: checking.id,
    kind: "standard",
  });

  // Account isolation check: credit card statement credit cannot reduce cash spent from checking
  assert.equal(spent(state, "Groceries", "2026-10"), 10000, "Groceries spent tracks $100.00 cash spent honestly");
  assert.equal(getAccountBalance(checking, state), 85000, "Checking cash accurately drops by $100 ($850.00)");
  const tFinal = totals(state, simulatedToday);
  assert.equal(tFinal.budgets, 0, "Remaining budget is $0.00 ($100 limit - $100 cash spent)");
  assert.equal(tFinal.safe, 85000, "Safe to Spend is strictly backed by actual checking cash ($850.00)");
});

test("Test 2B.5 — Statement credit absorption on future credit card purchases", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-checking-5",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-card-5",
    name: "Credit Card",
    type: "credit",
    opening: -5000, // -$50 statement credit
    balance: -5000,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  const diningBudget: Budget = {
    id: "b-dine",
    category: "Dining Out",
    limit: 10000, // $100.00
    color: "#82c9d7",
  };
  state.accounts = [checking, card];
  state.budgets = [diningBudget];

  // Purchase 1: $30 on credit card in Dining Out
  state.transactions.push({
    id: "tx-dine-1",
    name: "Bistro lunch",
    amount: -3000,
    category: "Dining Out",
    date: simulatedToday,
    createdAt: `${simulatedToday}T12:00:00.000Z`,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
  });

  let cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(getAccountBalance(card, state), -2000, "Card balance absorbed: -$20.00 remaining credit");
  assert.equal(cov.totalOwed, 0, "Total owed is $0.00");
  assert.equal(cov.readyToPay, 0, "Ready to Pay is $0.00 (no cash diverted from checking)");
  assert.equal(getAccountBalance(checking, state), 100000, "Checking cash untouched");

  // Purchase 2: $30 on credit card (exceeds remaining $20 credit by $10)
  state.transactions.push({
    id: "tx-dine-2",
    name: "Bistro dinner",
    amount: -3000,
    category: "Dining Out",
    date: simulatedToday,
    createdAt: `${simulatedToday}T19:00:00.000Z`,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
  });

  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(getAccountBalance(card, state), 1000, "Card balance is now +$10.00 debt");
  assert.equal(cov.totalOwed, 1000, "Total owed is $10.00");
  assert.equal(cov.readyToPay, 1000, "Exactly $10.00 is moved to Ready to Pay");
  assert.equal(cov.uncoveredDebt, 0, "Remaining $10 is fully covered by budget");
});

test("Test 2B.6 — Month rollover: Covered credit reservations persist across month boundaries", () => {
  const state: State = blank();
  const checking: Account = {
    id: "acc-checking-6",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: "2026-09-01",
    updatedAt: "2026-09-01",
  };
  const card: Account = {
    id: "acc-card-6",
    name: "Credit Card",
    type: "credit",
    opening: 0,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: "2026-09-01",
    updatedAt: "2026-09-01",
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: "2026-09-01",
  };
  const sepBudget: Budget = {
    id: "b-sep",
    category: "Groceries",
    limit: 10000,
    color: "#277c78",
  };
  state.accounts = [checking, card];
  state.budgets = [sepBudget];

  // In September: $50 groceries purchased on card
  state.transactions.push({
    id: "tx-sep-purchase",
    name: "September Groceries",
    amount: -5000,
    category: "Groceries",
    date: "2026-09-20",
    createdAt: "2026-09-20T10:00:00.000Z",
    status: "cleared",
    accountId: card.id,
    kind: "standard",
  });

  // Verify covered in September
  let covSep = getCreditCardCoverage(card, state, "2026-09-25");
  assert.equal(covSep.totalOwed, 5000);
  assert.equal(covSep.readyToPay, 5000);

  // Month rolls over to October 14, 2026 (card has not been paid yet)
  const covOct = getCreditCardCoverage(card, state, "2026-10-14");
  assert.equal(covOct.totalOwed, 5000, "Liability carries into October");
  assert.equal(covOct.readyToPay, 5000, "Ready to Pay reservation carries into October deterministically");
  assert.equal(covOct.uncoveredDebt, 0, "Debt remains 100% covered across rollover");
});

test("Test 2B.7 — Schema v4 migration idempotence: Pre-baseline transactions marked legacy", () => {
  const simulatedToday = "2026-10-14";
  const rawV3State = {
    version: 3,
    opening: 100000,
    payday: "2026-10-21",
    budgets: [{ id: "b1", category: "Groceries", limit: 20000, color: "#277c78" }],
    accounts: [
      {
        id: "acc-chk",
        name: "Checking",
        type: "checking",
        opening: 100000,
        includeInSafeToSpend: true,
      },
      {
        id: "acc-cc",
        name: "Credit Card",
        type: "credit",
        opening: 5000,
        creditLimit: 100000,
        includeInSafeToSpend: false,
      },
    ],
    transactions: [
      {
        id: "tx-existing-cc",
        name: "Pre-migration lunch",
        amount: -2500,
        category: "Groceries",
        date: "2026-10-14",
        status: "cleared",
        accountId: "acc-cc",
        kind: "standard",
      },
    ],
  };

  const migrated = migrateState(rawV3State, simulatedToday);
  assert.equal(migrated.version, 4, "Version bumped to 4");

  const migratedCard = migrated.accounts.find((a) => a.id === "acc-cc")!;
  assert.equal(migratedCard.coveredCreditBaselineAt, simulatedToday, "Baseline established at migration");
  assert.equal(migratedCard.assignedPaymentReserve, 0, "Manual reserve starts at $0");

  const existingTx = migrated.transactions.find((t) => t.id === "tx-existing-cc")!;
  assert.equal(existingTx.isLegacyDebt, true, "Existing transaction marked as legacy debt");

  const cov = getCreditCardCoverage(migratedCard, migrated, simulatedToday);
  assert.equal(cov.totalOwed, 7500, "Total owed includes opening $50 + $25 purchase = $75.00");
  assert.equal(cov.readyToPay, 0, "Ready to Pay is $0 (pre-migration debt is not auto-funded)");
  assert.equal(cov.uncoveredDebt, 7500, "100% uncovered debt");

  // Safe to Spend is preserved: $1,000 checking - $200 budget - $0 Ready to Pay = $800
  const t = totals(migrated, simulatedToday);
  assert.equal(t.safe, 80000, "Safe to Spend does not drop upon migration ($800.00)");

  // Re-export and re-import round trip preserves state identically
  const reImported = migrateState(JSON.parse(JSON.stringify(migrated)), simulatedToday);
  assert.equal(reImported.version, 4);
  const reCov = getCreditCardCoverage(reImported.accounts.find((a) => a.id === "acc-cc")!, reImported, simulatedToday);
  assert.equal(reCov.readyToPay, 0);
  assert.equal(reCov.uncoveredDebt, 7500);
});

test("Test 2B.8 — Newly entered transactions: Current active month vs prior closed month", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-8",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
  };
  const card: Account = {
    id: "acc-cc-8",
    name: "Credit Card",
    type: "credit",
    opening: 0,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: "2026-10-01",
  };
  const groceriesBudget: Budget = {
    id: "b-groc-8",
    category: "Groceries",
    limit: 10000, // $100
    color: "#277c78",
  };
  state.accounts = [checking, card];
  state.budgets = [groceriesBudget];

  // 1. Transaction entered with date in prior closed month (August 2026)
  state.transactions.push({
    id: "tx-past-month",
    name: "Old receipt from August",
    amount: -3000,
    category: "Groceries",
    date: "2026-08-15",
    status: "cleared",
    accountId: card.id,
    kind: "standard",
  });

  let cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 3000, "Total owed includes the $30 charge");
  assert.equal(cov.readyToPay, 0, "Prior closed month purchase is uncovered debt (cannot spend closed envelopes)");
  assert.equal(cov.uncoveredDebt, 3000);
  assert.equal(spent(state, "Groceries", "2026-10"), 0, "October groceries budget is unaffected");

  // 2. Transaction entered with date in current active month (October 2026)
  state.transactions.push({
    id: "tx-current-month",
    name: "Current groceries",
    amount: -4000,
    category: "Groceries",
    date: "2026-10-05",
    status: "cleared",
    accountId: card.id,
    kind: "standard",
  });

  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 7000, "Total owed is $70.00");
  assert.equal(cov.readyToPay, 4000, "Active month purchase is auto-covered ($40.00)");
  assert.equal(cov.uncoveredDebt, 3000, "Prior month debt remains uncovered ($30.00)");
  assert.equal(spent(state, "Groceries", "2026-10"), 4000, "October groceries spent is $40.00");
});

test("Test 2B.9 — Multi-card isolation: Card A reserves and payments do not affect Card B", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-9",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const cardA: Account = {
    id: "acc-card-a",
    name: "Card A (Visa)",
    type: "credit",
    opening: 10000, // $100
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  const cardB: Account = {
    id: "acc-card-b",
    name: "Card B (Mastercard)",
    type: "credit",
    opening: 20000, // $200
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, cardA, cardB];

  // User reserves $50 on Card A only
  assignCardPaymentReserve(cardA, 5000, simulatedToday);

  const covA = getCreditCardCoverage(cardA, state, simulatedToday);
  const covB = getCreditCardCoverage(cardB, state, simulatedToday);

  assert.equal(covA.readyToPay, 5000, "Card A has $50.00 Ready to Pay");
  assert.equal(covA.uncoveredDebt, 5000, "Card A has $50.00 uncovered");
  assert.equal(covB.readyToPay, 0, "Card B Ready to Pay is $0.00");
  assert.equal(covB.uncoveredDebt, 20000, "Card B has $200.00 uncovered");

  // Payment of $50 to Card A
  state.transactions.push({
    id: "tx-pay-a",
    name: "Pay Card A",
    amount: -5000,
    category: "Payment",
    date: simulatedToday,
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: cardA.id,
  });

  const covAAfter = getCreditCardCoverage(cardA, state, simulatedToday);
  const covBAfter = getCreditCardCoverage(cardB, state, simulatedToday);

  assert.equal(covAAfter.totalOwed, 5000);
  assert.equal(covAAfter.readyToPay, 0);
  assert.equal(covBAfter.totalOwed, 20000, "Card B is completely unaffected");
  assert.equal(covBAfter.readyToPay, 0, "Card B is completely unaffected");
});

test("Test 2B.10 — Cash reconciliation, excluded savings, and shortfall visibility", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-10",
    name: "Checking",
    type: "checking",
    opening: 50000, // $500.00
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const savings: Account = {
    id: "acc-sav-10",
    name: "Emergency Savings",
    type: "savings",
    opening: 500000, // $5,000.00
    includeInSafeToSpend: false, // EXCLUDED from Safe to Spend
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-card-10",
    name: "Card",
    type: "credit",
    opening: 30000, // $300.00 debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, savings, card];

  // Obligations:
  // Pots = $100
  state.pots = [{ id: "p1", name: "Vacation", saved: 10000, target: 50000, color: "#277c78" }];
  // Bills = $200
  state.bills = [{ id: "b1", name: "Internet", amount: 20000, day: 20, protected: false }];
  state.payday = "2026-10-25";
  // Card reserve = $300
  assignCardPaymentReserve(card, 30000, simulatedToday);

  // Total obligations = $100 (pots) + $200 (bills) + $300 (Ready to Pay) = $600.00
  // Eligible cash = $500.00 (Checking). Savings ($5,000) is excluded.
  const t = totals(state, simulatedToday);
  assert.equal(t.balance, 50000, "Eligible cash balance is strictly $500.00");
  assert.equal(t.pots, 10000);
  assert.equal(t.bills, 20000);
  assert.equal(t.totalReadyToPay, 30000);
  assert.equal(t.rawSafe, -10000, "Deficit rawSafe is -$100.00");
  assert.equal(t.safe, 0, "Safe to Spend is clamped to $0.00");
  assert.equal(t.shortfall, 10000, "Shortfall is visibly reported as $100.00 deficit");
});

test("Test 2B.11 — Transaction entered today with earlier date: Historical payment on Oct 10 does not consume manual reserve assigned on Oct 14, even if payment entered after reserve", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-11",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
  };
  const card: Account = {
    id: "acc-card-11",
    name: "Card",
    type: "credit",
    opening: 10000, // $100.00 pre-baseline debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: "2026-10-01",
  };
  state.accounts = [checking, card];

  // 1. User assigns $60 manual reserve on October 14 at 12:00 PM
  assignCardPaymentReserve(card, 6000, "2026-10-14T12:00:00.000Z");

  let cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 10000);
  assert.equal(cov.readyToPay, 6000);
  assert.equal(cov.uncoveredDebt, 4000);

  // 2. Later that evening (6:00 PM), user enters a payment of $40 that actually occurred on October 10
  // Note: createdAt is 18:00 (after the reserve), but transaction date is 2026-10-10 (earlier date)
  state.transactions.push({
    id: "tx-backdated-pay",
    name: "Backdated payment from Oct 10",
    amount: -4000,
    category: "Payment",
    date: "2026-10-10",
    createdAt: "2026-10-14T18:00:00.000Z", // entered into app after the reserve
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
  });

  // Event ordering verification:
  // Transaction date (2026-10-10) is before reservation date (2026-10-14).
  // Therefore, the payment of $40 was uncovered on Oct 10, dropping debt from $100 to $60.
  // The reserve on Oct 14 remains intact for the remaining $60 debt!
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 6000, "Total owed is now $60.00");
  assert.equal(cov.readyToPay, 6000, "Ready to Pay remains $60.00 (not consumed by earlier historical payment)");
  assert.equal(cov.uncoveredDebt, 0, "Uncovered debt is $0.00");
});

test("Test 2B.12 — Scheduled transactions and Pending-to-Cleared transitions: No premature reserves, no duplicate reservations", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-12",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-card-12",
    name: "Card",
    type: "credit",
    opening: 0,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  const budget: Budget = {
    id: "b-groc-12",
    category: "Groceries",
    limit: 20000, // $200
    color: "#277c78",
  };
  state.accounts = [checking, card];
  state.budgets = [budget];

  // 1. Scheduled transaction: future credit purchase on October 20
  const tx: Transaction = {
    id: "tx-future-card",
    name: "Upcoming Groceries",
    amount: -5000, // $50
    category: "Groceries",
    date: "2026-10-20",
    status: "scheduled",
    accountId: card.id,
    kind: "standard",
    createdAt: `${simulatedToday}T09:00:00.000Z`,
  };
  state.transactions.push(tx);

  let cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 0, "Scheduled transaction does not increase current liability");
  assert.equal(cov.readyToPay, 0, "Scheduled transaction does NOT prematurely create Ready to Pay");

  let t = totals(state, simulatedToday);
  assert.equal(t.totalReadyToPay, 0);
  assert.equal(t.budgets, 20000, "Scheduled transaction does not consume category budget");

  // 2. Transaction becomes pending
  tx.status = "pending";
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 5000, "Pending transaction establishes current liability ($50.00)");
  assert.equal(cov.readyToPay, 5000, "Pending transaction creates Ready to Pay ($50.00)");

  t = totals(state, simulatedToday);
  assert.equal(t.totalReadyToPay, 5000);
  assert.equal(t.budgets, 15000, "Pending transaction consumes $50 of category budget");

  // 3. Transaction transitions from pending to cleared
  tx.status = "cleared";
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 5000, "Total owed remains $50.00");
  assert.equal(cov.readyToPay, 5000, "Ready to Pay remains exactly $50.00 (NO duplicate reservation)");

  t = totals(state, simulatedToday);
  assert.equal(t.totalReadyToPay, 5000, "No duplication in totals");
  assert.equal(t.budgets, 15000, "Budget remaining remains $150.00");
});

test("Test 2B.13 — Editing and deleting credit purchases and refunds: Deterministic recalculation", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-13",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-card-13",
    name: "Card",
    type: "credit",
    opening: 0,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  const budget: Budget = {
    id: "b-groc-13",
    category: "Groceries",
    limit: 20000, // $200
    color: "#277c78",
  };
  state.accounts = [checking, card];
  state.budgets = [budget];

  // Initial purchase: $50
  const purchase: Transaction = {
    id: "tx-edit-purchase",
    name: "Groceries",
    amount: -5000,
    category: "Groceries",
    date: simulatedToday,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
    createdAt: `${simulatedToday}T10:00:00.000Z`,
  };
  state.transactions.push(purchase);

  let cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 5000);
  assert.equal(cov.readyToPay, 5000);

  // 1. Edit purchase amount from $50 to $80
  purchase.amount = -8000;
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 8000, "Total owed updates to $80.00");
  assert.equal(cov.readyToPay, 8000, "Ready to Pay updates to $80.00");

  // 2. Add refund of $20
  const refund: Transaction = {
    id: "tx-edit-refund",
    name: "Refund partial",
    amount: 2000,
    category: "Groceries",
    date: simulatedToday,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
    createdAt: `${simulatedToday}T12:00:00.000Z`,
  };
  state.transactions.push(refund);

  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 6000, "Total owed drops from $80 to $60");
  assert.equal(cov.readyToPay, 6000, "Ready to Pay drops to $60");

  // 3. Edit refund from $20 to $30
  refund.amount = 3000;
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 5000, "Total owed drops to $50.00");
  assert.equal(cov.readyToPay, 5000, "Ready to Pay drops to $50.00");

  // 4. Delete refund
  state.transactions = state.transactions.filter((t) => t.id !== refund.id);
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 8000, "Total owed returns to $80.00");
  assert.equal(cov.readyToPay, 8000, "Ready to Pay returns to $80.00");

  // 5. Delete purchase
  state.transactions = state.transactions.filter((t) => t.id !== purchase.id);
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 0, "Total owed is $0.00");
  assert.equal(cov.readyToPay, 0, "Ready to Pay is $0.00");
});

test("Test 2B.14 — Editing and deleting credit card payments: Deterministic recalculation", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-14",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-card-14",
    name: "Card",
    type: "credit",
    opening: 10000, // $100.00 debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];

  assignCardPaymentReserve(card, 10000, `${simulatedToday}T08:00:00.000Z`);

  const payment: Transaction = {
    id: "tx-edit-payment",
    name: "Card payment",
    amount: -4000,
    category: "Payment",
    date: simulatedToday,
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
    createdAt: `${simulatedToday}T11:00:00.000Z`,
  };
  state.transactions.push(payment);

  let cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 6000, "Owed drops to $60.00");
  assert.equal(cov.readyToPay, 6000, "Ready to Pay is $60.00");

  // 1. Edit payment amount from $40 to $70
  payment.amount = -7000;
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 3000, "Owed drops to $30.00");
  assert.equal(cov.readyToPay, 3000, "Ready to Pay drops to $30.00");

  // 2. Edit payment amount to $100 (full payoff)
  payment.amount = -10000;
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 0, "Owed is $0.00");
  assert.equal(cov.readyToPay, 0, "Ready to Pay is $0.00");

  // 3. Delete payment
  state.transactions = state.transactions.filter((t) => t.id !== payment.id);
  cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 10000, "Owed returns to $100.00");
  assert.equal(cov.readyToPay, 10000, "Ready to Pay returns to $100.00");
});

test("Test 2B.15 — Double-counting prevention and createdAt consistency across JSON export/import", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-15",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-card-15",
    name: "Card",
    type: "credit",
    opening: 0,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  const budget: Budget = {
    id: "b-groc-15",
    category: "Groceries",
    limit: 20000,
    color: "#277c78",
  };
  state.accounts = [checking, card];
  state.budgets = [budget];

  // Add purchase with explicit createdAt ISO string
  const testIso = "2026-10-14T10:30:45.123Z";
  state.transactions.push({
    id: "tx-iso-test",
    name: "Groceries with ISO",
    amount: -5000,
    category: "Groceries",
    date: simulatedToday,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
    createdAt: testIso,
  });

  assignCardPaymentReserve(card, 2500, `${simulatedToday}T11:00:00.000Z`);

  // Verify initial calculations
  let cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 5000);
  assert.equal(cov.readyToPay, 5000, "Ready to Pay clamped to Total Owed ($50.00)");
  assert.equal(cov.grossReserve, 7500, "Gross reserve tracks $50 purchase + $25 manual = $75.00");

  // Export to JSON string and re-import via migrateState
  const jsonStr = JSON.stringify(state);
  const parsed = JSON.parse(jsonStr);
  const reimported = migrateState(parsed, simulatedToday);

  // Verify createdAt preservation
  const reTx = reimported.transactions.find((t) => t.id === "tx-iso-test")!;
  assert.equal(reTx.createdAt, testIso, "createdAt ISO timestamp is strictly preserved through JSON serialization");

  // Verify manual reservation preservation
  const reCard = reimported.accounts.find((a) => a.id === card.id)!;
  assert.equal(reCard.paymentReservations?.length, 1);
  assert.equal(reCard.paymentReservations?.[0]?.amount, 2500);

  // Verify coverage calculation is completely identical with zero double counting
  const reCov = getCreditCardCoverage(reCard, reimported, simulatedToday);
  assert.equal(reCov.totalOwed, 5000);
  assert.equal(reCov.readyToPay, 5000);
  assert.equal(reCov.grossReserve, 7500);
  assert.equal(reCov.uncoveredDebt, 0);

  const tOrig = totals(state, simulatedToday);
  const tRe = totals(reimported, simulatedToday);
  assert.equal(tRe.safe, tOrig.safe, "Safe to Spend is identical across export/import");
  assert.equal(tRe.totalReadyToPay, tOrig.totalReadyToPay);
});

test("Test 2B.16 — Composable Reservation Assignment and Release (useBudget)", () => {
  const b = useBudget();
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-16",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000 cash
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-crd-16",
    name: "Card",
    type: "credit",
    opening: 30000, // $300 opening debt
    creditLimit: 200000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];
  state.payday = "2026-10-31";
  b.state.value = state;

  // 1. Verify exposed coverage properties
  const covInitial = b.getCreditCardCoverage(card.id, simulatedToday);
  assert.equal(covInitial.totalOwed, 30000);
  assert.equal(covInitial.readyToPay, 0);
  assert.equal(covInitial.uncoveredDebt, 30000);
  assert.equal(covInitial.availableCredit, 170000);
  assert.equal(covInitial.status, "uncovered");
  assert.equal(b.getCreditCardCoverageStatus(card.id, simulatedToday), "uncovered");

  // Summary computed exposes aggregates
  assert.equal(b.creditCardSummary.value.totalOwed, 30000);
  assert.equal(b.creditCardSummary.value.readyToPay, 0);
  assert.equal(b.creditCardSummary.value.uncoveredDebt, 30000);
  assert.equal(b.creditCardSummary.value.cardCount, 1);
  assert.equal(b.sum.value.safe, 100000, "Initial Safe to Spend is $1,000");

  // 2. Wire assignCardPaymentReserve
  const okAssign = b.assignCardPaymentReserve(card.id, 10000, simulatedToday); // Reserve $100
  assert.equal(okAssign, true);

  // Coverage updates reactively
  const covAfterAssign = b.getCreditCardCoverage(card.id, simulatedToday);
  assert.equal(covAfterAssign.readyToPay, 10000);
  assert.equal(covAfterAssign.uncoveredDebt, 20000);
  assert.equal(covAfterAssign.status, "partially_covered");
  assert.equal(b.creditCardSummary.value.readyToPay, 10000);
  assert.equal(b.creditCardSummary.value.uncoveredDebt, 20000);
  assert.equal(b.sum.value.safe, 90000, "Safe to Spend decreases by exact reserved amount ($100)");

  // Assert card balance and transactions are completely untouched
  assert.equal(b.getAccountBalance(card), 30000, "Card debt balance unmodified by reservation");
  assert.equal(b.state.value.transactions.length, 0, "No expense transactions created");

  // 3. Wire releaseCardPaymentReserve
  const okRelease = b.releaseCardPaymentReserve(card.id, 4000, simulatedToday); // Release $40
  assert.equal(okRelease, true);

  const covAfterRelease = b.getCreditCardCoverage(card.id, simulatedToday);
  assert.equal(covAfterRelease.readyToPay, 6000);
  assert.equal(covAfterRelease.uncoveredDebt, 24000);
  assert.equal(b.creditCardSummary.value.readyToPay, 6000);
  assert.equal(b.creditCardSummary.value.uncoveredDebt, 24000);
  assert.equal(b.sum.value.safe, 94000, "Safe to Spend restored by released amount ($40)");
  assert.equal(b.getAccountBalance(card), 30000, "Card balance untouched");
});

test("Test 2B.17 — Validation: Invalid amounts, insufficient funds, and excess reservations", () => {
  const b = useBudget();
  const m = useModal();
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-17",
    name: "Checking",
    type: "checking",
    opening: 5000, // Only $50 cash
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-crd-17",
    name: "Sapphire Card",
    type: "credit",
    opening: 20000, // $200 debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];
  state.payday = "2026-10-31";
  b.state.value = state;

  // 1. Amount <= 0 validation
  assert.equal(b.assignCardPaymentReserve(card.id, 0, simulatedToday), false);
  assert.equal(b.assignCardPaymentReserve(card.id, -500, simulatedToday), false);
  m.open("Reserve for payment", card.id);
  m.form.value.amount = "0";
  m.submit();
  assert.equal(m.error.value, "Enter an amount greater than zero.");

  // 2. Insufficient Safe to Spend validation (Cash has $50, attempting to reserve $100)
  assert.equal(b.assignCardPaymentReserve(card.id, 10000, simulatedToday), false);
  m.form.value.amount = "100";
  m.submit();
  assert.equal(m.error.value, "This amount exceeds your available Safe to Spend.");

  // Increase cash to $1,000 for uncovered debt limit tests
  b.state.value.accounts.find((a) => a.id === checking.id)!.opening = 100000;

  // 3. Reserving more than uncovered debt ($200 owed, attempting to reserve $250)
  assert.equal(b.assignCardPaymentReserve(card.id, 25000, simulatedToday), false);
  m.form.value.amount = "250";
  m.submit();
  assert.match(m.error.value, /Cannot reserve more than the uncovered debt/);

  // 4. Fully covered card: reserve full $200
  assert.equal(b.assignCardPaymentReserve(card.id, 20000, simulatedToday), true);
  assert.equal(b.getCreditCardCoverage(card.id, simulatedToday).status, "fully_covered");
  // Attempt to reserve further on fully covered card
  assert.equal(b.assignCardPaymentReserve(card.id, 1000, simulatedToday), false);
  m.form.value.amount = "10";
  m.submit();
  assert.match(m.error.value, /already fully covered/);

  // 5. Releasing more than manual reserve ($200 ready to pay, attempting to release $250)
  assert.equal(b.releaseCardPaymentReserve(card.id, 25000, simulatedToday), false);
  m.form.value.reserveAction = "release";
  m.form.value.amount = "250";
  m.submit();
  assert.equal(
    m.error.value,
    "Cannot release more than the manually assigned reserve ($200.00).",
  );

  // 6. Non-credit account rejection
  assert.equal(b.assignCardPaymentReserve(checking.id, 1000, simulatedToday), false);
  m.form.value.accountId = checking.id;
  m.form.value.amount = "10";
  m.form.value.reserveAction = "reserve";
  m.submit();
  assert.equal(m.error.value, "Selected account is not a valid credit card.");
});

test("Test 2B.18 — Modal 'Reserve for payment' Action Flow (useModal)", () => {
  const b = useBudget();
  const m = useModal();
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-18",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-crd-18",
    name: "Freedom Card",
    type: "credit",
    opening: 15000, // $150 debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];
  state.payday = "2026-10-31";
  b.state.value = state;

  // Open modal in reserve mode
  m.open("Reserve for payment", card.id);
  assert.equal(m.mode.value, "Reserve for payment");
  assert.equal(m.form.value.accountId, card.id);
  assert.equal(m.form.value.amount, "150", "Defaults amount to current uncovered debt ($150)");
  assert.equal(m.form.value.reserveAction, "reserve");

  // Reserve $50
  m.form.value.amount = "50";
  m.submit();
  assert.equal(m.error.value, "", "No errors on valid submit");

  let cov = b.getCreditCardCoverage(card.id, simulatedToday);
  assert.equal(cov.readyToPay, 5000);
  assert.equal(cov.uncoveredDebt, 10000);
  assert.equal(b.sum.value.safe, 95000);

  // Open modal in release mode
  m.open("Reserve for payment", card.id, "release");
  assert.equal(m.form.value.reserveAction, "release");
  assert.equal(m.form.value.amount, "50", "Defaults amount to current Ready to Pay ($50)");

  // Release $20
  m.form.value.amount = "20";
  m.submit();
  assert.equal(m.error.value, "");

  cov = b.getCreditCardCoverage(card.id, simulatedToday);
  assert.equal(cov.readyToPay, 3000);
  assert.equal(cov.uncoveredDebt, 12000);
  assert.equal(b.sum.value.safe, 97000);
});

test("Test 2B.19 — Reactive updates after transactions through composables", () => {
  const b = useBudget();
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-19",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-crd-19",
    name: "Card",
    type: "credit",
    opening: 20000, // $200 historical debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  const budget: Budget = {
    id: "b-dining-19",
    category: "Dining Out",
    limit: 10000,
    color: "#277c78",
  };
  state.accounts = [checking, card];
  state.budgets = [budget];
  state.payday = "2026-10-31";
  b.state.value = state;

  // Manual reserve of $100
  b.assignCardPaymentReserve(card.id, 10000, simulatedToday);
  assert.equal(b.creditCardSummary.value.readyToPay, 10000);
  assert.equal(b.creditCardSummary.value.uncoveredDebt, 10000);

  // 1. Post a new credit card purchase of $40 (funded by Dining Out budget)
  b.state.value.transactions.unshift({
    id: "tx-dine-1",
    name: "Restaurant",
    amount: -4000,
    category: "Dining Out",
    date: simulatedToday,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
    createdAt: `${simulatedToday}T12:00:00.000Z`,
  });

  // Reactive verification:
  // Total Owed = $200 + $40 = $240
  // Ready to Pay = $100 manual + $40 budget-funded = $140
  // Uncovered Debt = $240 - $140 = $100
  assert.equal(b.creditCardSummary.value.totalOwed, 24000);
  assert.equal(b.creditCardSummary.value.readyToPay, 14000);
  assert.equal(b.creditCardSummary.value.uncoveredDebt, 10000);

  // 2. Make a credit card payment of $140 from checking to card
  b.state.value.transactions.unshift({
    id: "tx-pay-1",
    name: "Payment to Card",
    amount: -14000,
    category: "Payment",
    date: simulatedToday,
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
    createdAt: `${simulatedToday}T14:00:00.000Z`,
  });

  // Reactive verification:
  // Card debt reduced by $140: Total Owed = $240 - $140 = $100
  // Payment consumed the $140 reserved cash: Ready to Pay = $0
  // Uncovered debt remains $100
  // Checking balance dropped from $1,000 to $860
  assert.equal(b.creditCardSummary.value.totalOwed, 10000);
  assert.equal(b.creditCardSummary.value.readyToPay, 0);
  assert.equal(b.creditCardSummary.value.uncoveredDebt, 10000);
  assert.equal(b.getAccountBalance(checking), 86000);
});

test("Test 2B.20 — Multiple Credit Cards via composables", () => {
  const b = useBudget();
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-20",
    name: "Checking",
    type: "checking",
    opening: 200000, // $2,000
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const cardA: Account = {
    id: "acc-crd-20a",
    name: "Card Alpha",
    type: "credit",
    opening: 20000, // $200
    creditLimit: 500000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  const cardB: Account = {
    id: "acc-crd-20b",
    name: "Card Beta",
    type: "credit",
    opening: 40000, // $400
    creditLimit: 200000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, cardA, cardB];
  state.payday = "2026-10-31";
  b.state.value = state;

  assert.equal(b.activeCreditCards.value.length, 2);
  assert.equal(b.creditCardSummary.value.cardCount, 2);
  assert.equal(b.creditCardSummary.value.totalOwed, 60000);
  assert.equal(b.creditCardSummary.value.readyToPay, 0);
  assert.equal(b.creditCardSummary.value.uncoveredDebt, 60000);

  // Assign $150 to Card A only
  b.assignCardPaymentReserve(cardA.id, 15000, simulatedToday);
  const covA = b.getCreditCardCoverage(cardA.id, simulatedToday);
  const covB = b.getCreditCardCoverage(cardB.id, simulatedToday);

  assert.equal(covA.readyToPay, 15000);
  assert.equal(covA.uncoveredDebt, 5000);
  assert.equal(covA.status, "partially_covered");

  // Card B is completely untouched
  assert.equal(covB.readyToPay, 0);
  assert.equal(covB.uncoveredDebt, 40000);
  assert.equal(covB.status, "uncovered");

  // Summary reflects combined values
  assert.equal(b.creditCardSummary.value.readyToPay, 15000);
  assert.equal(b.creditCardSummary.value.uncoveredDebt, 45000);
  assert.equal(b.creditCardSummary.value.totalOwed, 60000);

  // Assign $400 to Card B (fully covering it)
  b.assignCardPaymentReserve(cardB.id, 40000, simulatedToday);
  assert.equal(b.getCreditCardCoverage(cardB.id, simulatedToday).status, "fully_covered");
  assert.equal(b.creditCardSummary.value.readyToPay, 55000);
  assert.equal(b.creditCardSummary.value.uncoveredDebt, 5000);
  assert.equal(b.sum.value.safe, 200000 - 55000, "Safe to spend reduced by exact sum of ready to pay ($550)");
});

test("Test 2B.21 — State persistence and backup restoration with schema v4 composables", () => {
  const b = useBudget();
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-21",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-crd-21",
    name: "Card",
    type: "credit",
    opening: 30000,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];
  state.payday = "2026-10-31";
  b.state.value = state;

  b.assignCardPaymentReserve(card.id, 12000, simulatedToday); // Reserve $120
  const origSummary = { ...b.creditCardSummary.value };
  const origSafe = b.sum.value.safe;

  // Serialize to JSON string (simulating backup export)
  const jsonExport = JSON.stringify(b.state.value);

  // Parse and restore via migrateState
  const parsed = JSON.parse(jsonExport);
  assert.equal(parsed.version, 4);
  const restored = migrateState(parsed, simulatedToday);

  // Load restored state back into composable
  b.state.value = restored;

  assert.equal(b.state.value.version, 4);
  assert.equal(b.creditCardSummary.value.totalOwed, origSummary.totalOwed);
  assert.equal(b.creditCardSummary.value.readyToPay, origSummary.readyToPay);
  assert.equal(b.creditCardSummary.value.uncoveredDebt, origSummary.uncoveredDebt);
  assert.equal(b.sum.value.safe, origSafe);

  const restoredCard = b.state.value.accounts.find((a) => a.id === card.id)!;
  assert.equal(restoredCard.paymentReservations?.length, 1);
  assert.equal(restoredCard.paymentReservations?.[0]?.amount, 12000);
});

test("Test 2B.22 — Invariant: Releasing manual reservation must NEVER release automatically reserved budget funds", () => {
  const b = useBudget();
  const m = useModal();
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-22",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000 cash
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-crd-22",
    name: "Card",
    type: "credit",
    opening: 0,
    creditLimit: 200000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  const groceriesBudget: Budget = {
    id: "b-groc-22",
    category: "Groceries",
    limit: 30000, // $300 budget
    color: "#277c78",
  };
  state.accounts = [checking, card];
  state.budgets = [groceriesBudget];
  state.payday = "2026-10-31";
  b.state.value = state;

  // SCENARIO 1: Automatic-Only Funding
  // Add $100 credit card purchase fully covered by Groceries budget
  b.state.value.transactions.push({
    id: "tx-groc-auto",
    name: "Supermarket",
    amount: -10000, // -$100.00
    category: "Groceries",
    date: simulatedToday,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
    createdAt: `${simulatedToday}T10:00:00.000Z`,
  });

  let cov = b.getCreditCardCoverage(card.id, simulatedToday);
  assert.equal(cov.totalOwed, 10000, "Total owed is $100");
  assert.equal(cov.readyToPay, 10000, "Ready to Pay is $100 from automatic budget coverage");
  assert.equal(cov.manualReleasable, 0, "manualReleasable MUST be $0 because funds were auto-reserved");

  // Attempting to release via composable MUST fail
  const okReleaseAuto = b.releaseCardPaymentReserve(card.id, 10000, simulatedToday);
  assert.equal(okReleaseAuto, false, "Releasing automatic reserve must be rejected by composable");

  // Attempting to release via modal MUST fail with clear error
  m.open("Reserve for payment", card.id, "release");
  assert.equal(m.form.value.amount, "", "Default release amount is empty because manualReleasable is 0");
  m.form.value.amount = "100";
  m.submit();
  assert.equal(m.error.value, "There are no manual reserved funds to release.");

  // Verify Ready to Pay was untouched
  cov = b.getCreditCardCoverage(card.id, simulatedToday);
  assert.equal(cov.readyToPay, 10000, "Ready to Pay remains $100");

  // SCENARIO 2: Mixed Funding (Auto + Manual)
  // Set opening debt to $100 legacy debt, so total debt becomes $100 legacy + $100 groceries = $200
  b.state.value.accounts.find((a) => a.id === card.id)!.opening = 10000;
  cov = b.getCreditCardCoverage(card.id, simulatedToday);
  assert.equal(cov.totalOwed, 20000);
  assert.equal(cov.readyToPay, 10000, "Ready to Pay has $100 auto");
  assert.equal(cov.uncoveredDebt, 10000, "Uncovered debt is $100");

  // Manually reserve $60 for the legacy debt
  b.assignCardPaymentReserve(card.id, 6000, simulatedToday);
  cov = b.getCreditCardCoverage(card.id, simulatedToday);
  assert.equal(cov.readyToPay, 16000, "Ready to pay is $160 ($100 auto + $60 manual)");
  assert.equal(cov.manualReleasable, 6000, "manualReleasable is exactly $60");

  // Attempt to release $70 (exceeds $60 manual) MUST fail
  m.open("Reserve for payment", card.id, "release");
  assert.equal(m.form.value.amount, "60", "Default release amount is $60 (manualReleasable)");
  m.form.value.amount = "70";
  m.submit();
  assert.equal(
    m.error.value,
    "Cannot release more than the manually assigned reserve ($60.00).",
  );

  // Releasing $60 manual succeeds
  m.form.value.amount = "60";
  m.submit();
  assert.equal(m.error.value, "");

  cov = b.getCreditCardCoverage(card.id, simulatedToday);
  assert.equal(cov.readyToPay, 10000, "Ready to Pay returns to $100 auto");
  assert.equal(cov.manualReleasable, 0, "manualReleasable is now $0");

  // Any further release attempt is blocked
  assert.equal(b.releaseCardPaymentReserve(card.id, 1000, simulatedToday), false);

  // SCENARIO 3: Payment Consuming Auto vs Manual Reserves Chronologically
  // Clear previous scenario reservations for isolation
  card.paymentReservations = [];
  card.assignedPaymentReserve = 0;
  // Assign $50 manual reserve at 11:00:00 (after 10:00:00 purchase)
  b.assignCardPaymentReserve(card.id, 5000, `${simulatedToday}T11:00:00.000Z`);
  cov = b.getCreditCardCoverage(card.id, simulatedToday);
  assert.equal(cov.readyToPay, 15000, "Ready to Pay = $150 ($100 auto + $50 manual)");

  // Make a payment of $80 from checking to card
  b.state.value.transactions.push({
    id: "tx-pay-consume",
    name: "Payment to Card",
    amount: -8000,
    category: "Payment",
    date: simulatedToday,
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
    createdAt: `${simulatedToday}T15:00:00.000Z`,
  });

  cov = b.getCreditCardCoverage(card.id, simulatedToday);
  assert.equal(cov.readyToPay, 7000);
  assert.equal(cov.manualReleasable, 5000);

  // SCENARIO 4: Statement Credit Refund Reducing Debt Below Manual Reserve
  // Total debt is currently $120.
  // Merchant issues a $100 statement credit refund.
  b.state.value.transactions.push({
    id: "tx-refund-stmt",
    name: "Store Refund",
    amount: 10000, // +$100.00 refund on card
    category: "Groceries",
    date: simulatedToday,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
    createdAt: `${simulatedToday}T16:00:00.000Z`,
  });

  cov = b.getCreditCardCoverage(card.id, simulatedToday);
  // Debt drops to $120 - $100 = $20!
  assert.equal(cov.totalOwed, 2000, "Total owed drops to $20");
  assert.equal(cov.readyToPay, 2000, "Ready to Pay is clamped to Total Owed ($20)");
  // Since the remaining $20 Ready to Pay is exactly the $20 remaining auto reserve,
  // manualReleasable MUST be $0 to protect the auto reserve!
  assert.equal(cov.manualReleasable, 0, "manualReleasable is 0 because the entire $20 Ready to Pay is auto reserve");
  assert.equal(b.releaseCardPaymentReserve(card.id, 2000, simulatedToday), false);

  // SCENARIO 5: Refund On Card with Pure Manual Reserve Clamps Releasable to Total Owed
  const card2: Account = {
    id: "acc-crd-refund-clamp",
    name: "Refund Card",
    type: "credit",
    opening: 10000, // $100 legacy debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  b.state.value.accounts.push(card2);
  // Assign $100 manual reserve
  b.assignCardPaymentReserve(card2.id, 10000, simulatedToday);
  assert.equal(b.getCreditCardCoverage(card2.id, simulatedToday).manualReleasable, 10000);

  // Statement credit refund of $70 on card2
  b.state.value.transactions.push({
    id: "tx-refund-card2",
    name: "Card Refund",
    amount: 7000, // +$70 refund
    category: "General",
    date: simulatedToday,
    status: "cleared",
    accountId: card2.id,
    kind: "standard",
    createdAt: `${simulatedToday}T18:00:00.000Z`,
  });

  const cov2 = b.getCreditCardCoverage(card2.id, simulatedToday);
  assert.equal(cov2.totalOwed, 3000, "Total owed drops from $100 to $30");
  assert.equal(cov2.readyToPay, 3000, "Ready to Pay is clamped to Total Owed ($30)");
  assert.equal(cov2.manualReleasable, 3000, "manualReleasable is clamped to Ready to Pay ($30)");

  // Attempting to release $40 fails (exceeds $30)
  assert.equal(b.releaseCardPaymentReserve(card2.id, 4000, simulatedToday), false);
  // Releasing $30 succeeds
  assert.equal(b.releaseCardPaymentReserve(card2.id, 3000, simulatedToday), true);
});

test("Test 2B.23 — Stage 4: Safe to Spend breakdown & double-deduction prevention across purchase, reserve, and payment", () => {
  const b = useBudget();
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-23",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000 cash
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-crd-23",
    name: "Card",
    type: "credit",
    opening: 5000, // $50 legacy debt awaiting manual reserve
    creditLimit: 200000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  const pot: Pot = {
    id: "pot-23",
    name: "Holiday",
    target: 20000,
    saved: 10000, // $100 saved in pot
    color: "#277c78",
  };
  const bill: RecurringBill = {
    id: "bill-23",
    name: "Internet",
    amount: 10000, // $100 bill
    day: 20, // due before payday (payday Oct 31)
  };
  const groceriesBudget: Budget = {
    id: "b-groc-23",
    category: "Groceries",
    limit: 30000, // $300 limit
    color: "#277c78",
  };
  state.accounts = [checking, card];
  state.pots = [pot];
  state.bills = [bill];
  state.budgets = [groceriesBudget];
  state.payday = "2026-10-31";
  b.state.value = state;

  // Initial State:
  // Eligible cash: $1,000
  // Pots: -$100, Bills: -$100, Remaining budgets: -$300, Card reserves: -$0
  // Safe to Spend = $1,000 - $100 - $100 - $300 = $500.00
  assert.equal(b.sum.value.balance, 100000);
  assert.equal(b.sum.value.pots, 10000);
  assert.equal(b.sum.value.bills, 10000);
  assert.equal(b.sum.value.budgets, 30000);
  assert.equal(b.sum.value.totalReadyToPay, 0);
  assert.equal(b.sum.value.safe, 50000);
  assert.equal(b.sum.value.shortfall, 0);

  // 1. Post a $100 credit card purchase in Groceries
  b.state.value.transactions.push({
    id: "tx-groc-23",
    name: "Whole Foods",
    amount: -10000, // -$100.00
    category: "Groceries",
    date: simulatedToday,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
    createdAt: `${simulatedToday}T10:00:00.000Z`,
  });

  // Verify Safe to Spend is NOT deducted twice:
  // - Cash balance is still $1,000
  // - Remaining budget drops from $300 to $200
  // - Payment reserve increases from $0 to $100
  // Safe to Spend remains EXACTLY $500.00!
  assert.equal(b.sum.value.balance, 100000);
  assert.equal(b.sum.value.budgets, 20000, "Remaining budget is now $200");
  assert.equal(b.sum.value.totalReadyToPay, 10000, "Credit card payment reserve is now $100");
  assert.equal(b.sum.value.safe, 50000, "Safe to Spend is unchanged at $500 (no double deduction)");

  // 2. Add an explicit manual payment reserve of $50 for additional card buffer
  b.assignCardPaymentReserve(card.id, 5000, `${simulatedToday}T11:00:00.000Z`);
  assert.equal(b.sum.value.totalReadyToPay, 15000, "Total Ready to Pay is $150 ($100 auto + $50 manual)");
  assert.equal(b.sum.value.safe, 45000, "Safe to Spend drops by $50 to $450");

  // 3. Make a $150 credit card payment from checking
  b.state.value.transactions.push({
    id: "tx-pay-23",
    name: "Card Repayment",
    amount: -15000, // -$150.00 from checking to card
    category: "Payment",
    date: simulatedToday,
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
    createdAt: `${simulatedToday}T12:00:00.000Z`,
  });

  // Cash drops by $150 (from $1,000 to $850)
  // Payment reserve drops by $150 (from $150 to $0)
  // Safe to Spend: $850 - $100 (pots) - $100 (bills) - $200 (budget) - $0 (reserves) = $450.00
  assert.equal(b.sum.value.balance, 85000, "Checking balance is $850");
  assert.equal(b.sum.value.totalReadyToPay, 0, "Payment reserve cleanly consumed to $0");
  assert.equal(b.sum.value.safe, 45000, "Safe to Spend remains $450.00 (no double deduction on payment)");
});

test("Test 2B.24 — Stage 4: Shortfall reporting when protected allocations exceed eligible cash", () => {
  const b = useBudget();
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-24",
    name: "Checking",
    type: "checking",
    opening: 25000, // Only $250 cash
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-crd-24",
    name: "Card",
    type: "credit",
    opening: 0,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  const pot: Pot = {
    id: "pot-24",
    name: "Emergency",
    target: 50000,
    saved: 15000, // $150 in pot
    color: "#277c78",
  };
  const bill: RecurringBill = {
    id: "bill-24",
    name: "Electric",
    amount: 10000, // $100 bill
    day: 22,
  };
  const budget: Budget = {
    id: "b-dining-24",
    category: "Dining Out",
    limit: 10000, // $100 budget
    color: "#277c78",
  };
  state.accounts = [checking, card];
  state.pots = [pot];
  state.bills = [bill];
  state.budgets = [budget];
  state.payday = "2026-10-31";
  b.state.value = state;

  // Total obligations: $150 pot + $100 bill + $100 budget = $350.
  // Cash available: $250.
  // Deficit is $100.
  let sum = b.sum.value;
  assert.equal(sum.balance, 25000);
  assert.equal(sum.rawSafe, -10000, "rawSafe is -$100.00");
  assert.equal(sum.safe, 0, "Safe to Spend is clamped to $0.00");
  assert.equal(sum.shortfall, 10000, "Shortfall reports exact $100.00 deficit");

  // Now add a credit card charge of $50 covered by Dining Out budget
  b.state.value.transactions.push({
    id: "tx-dine-24",
    name: "Cafe",
    amount: -5000,
    category: "Dining Out",
    date: simulatedToday,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
    createdAt: `${simulatedToday}T10:00:00.000Z`,
  });

  sum = b.sum.value;
  // Remaining dining budget drops by $50 (to $50), while totalReadyToPay increases by $50 (to $50)
  // Overall obligations remain $350 ($150 + $100 + $50 + $50)
  assert.equal(sum.budgets, 5000);
  assert.equal(sum.totalReadyToPay, 5000);
  assert.equal(sum.rawSafe, -10000);
  assert.equal(sum.safe, 0);
  assert.equal(sum.shortfall, 10000, "Shortfall remains consistent with protected payment reserves");
});

test("Test 2B.25 — Stage 4: Record Payment pre-fill verification and positive debt constraint", () => {
  const b = useBudget();
  const m = useModal();
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-25",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  // Card 1: Covered debt ($150 debt, $100 Ready to Pay)
  const card1: Account = {
    id: "acc-crd-25-1",
    name: "Card 1",
    type: "credit",
    opening: 15000, // $150 debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  // Card 2: Uncovered debt ($80 debt, $0 Ready to Pay)
  const card2: Account = {
    id: "acc-crd-25-2",
    name: "Card 2",
    type: "credit",
    opening: 8000, // $80 debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  // Card 3: Zero balance ($0 debt)
  const card3: Account = {
    id: "acc-crd-25-3",
    name: "Card 3",
    type: "credit",
    opening: 0,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  // Card 4: Statement credit (-$50 debt / credit balance)
  const card4: Account = {
    id: "acc-crd-25-4",
    name: "Card 4",
    type: "credit",
    opening: -5000, // -$50 statement credit
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card1, card2, card3, card4];
  b.state.value = state;

  // Assign $100 manual reserve to Card 1
  b.assignCardPaymentReserve(card1.id, 10000, simulatedToday);

  // 1. Record payment for Card 1 (covered debt)
  m.open("Add transaction", card1.id, "Credit Card Payment");
  assert.equal(m.form.value.type, "Credit Card Payment");
  assert.equal(m.form.value.targetAccountId, card1.id);
  assert.equal(m.form.value.amount, "100", "Prefills exact Ready to Pay ($100.00)");
  assert.ok(Number(m.form.value.amount) * 100 <= 15000, "Prefilled amount does not exceed positive card debt");

  // 2. Record payment for Card 2 (uncovered debt, ready to pay = 0)
  m.open("Add transaction", card2.id, "Credit Card Payment");
  assert.equal(m.form.value.type, "Credit Card Payment");
  assert.equal(m.form.value.targetAccountId, card2.id);
  assert.equal(m.form.value.amount, "80", "Prefills positive debt balance ($80.00)");
  assert.ok(Number(m.form.value.amount) * 100 <= 8000, "Prefilled amount never exceeds positive card debt");

  // 3. Record payment for Card 3 (zero balance)
  m.open("Add transaction", card3.id, "Credit Card Payment");
  assert.equal(m.form.value.type, "Credit Card Payment");
  assert.equal(m.form.value.targetAccountId, card3.id);
  assert.equal(m.form.value.amount, "", "Leaves amount empty when card has zero balance");

  // 4. Record payment for Card 4 (statement credit)
  m.open("Add transaction", card4.id, "Credit Card Payment");
  assert.equal(m.form.value.type, "Credit Card Payment");
  assert.equal(m.form.value.targetAccountId, card4.id);
  assert.equal(m.form.value.amount, "", "Leaves amount empty when card is in statement credit");
});

test("Test 2B.26 — Compact Accounts UI: Record Payment execution for covered/uncovered debt and debt ceiling guard", () => {
  const b = useBudget();
  const m = useModal();
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-26",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000 cash
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  // Card Uncovered: $80 debt, $0 Ready to Pay
  const cardUncovered: Account = {
    id: "acc-crd-uncovered",
    name: "Card Uncovered",
    type: "credit",
    opening: 8000, // $80 debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  // Card Zero: $0 debt
  const cardZero: Account = {
    id: "acc-crd-zero",
    name: "Card Zero",
    type: "credit",
    opening: 0,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  // Card Credit: -$30 statement credit
  const cardCredit: Account = {
    id: "acc-crd-credit",
    name: "Card Credit",
    type: "credit",
    opening: -3000,
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, cardUncovered, cardZero, cardCredit];
  b.state.value = state;

  // 1. Open Record Payment on uncovered card -> Prefills $80 (Total Owed)
  m.open("Add transaction", cardUncovered.id, "Credit Card Payment");
  assert.equal(m.form.value.type, "Credit Card Payment");
  assert.equal(m.form.value.targetAccountId, cardUncovered.id);
  assert.equal(m.form.value.amount, "80", "Prefilled amount is Total Owed ($80.00)");

  // 2. Attempt payment exceeding outstanding debt ($100 > $80) -> rejected by submit
  m.form.value.amount = "100";
  m.submit();
  assert.equal(m.error.value, "Cannot pay more than the outstanding debt ($80.00).");

  // 3. Submit valid uncovered payment ($50 of $80 debt) -> succeeds
  m.form.value.amount = "50";
  m.submit();
  assert.equal(m.error.value, "");

  // Verify accounts after uncovered payment
  const covAfterPay = b.getCreditCardCoverage(cardUncovered.id);
  assert.equal(covAfterPay.totalOwed, 3000, "Card debt reduced from $80 to $30");
  assert.equal(covAfterPay.readyToPay, 0, "Ready to Pay remains 0 for uncovered card");
  assert.equal(covAfterPay.uncoveredDebt, 3000, "Uncovered debt reduced to $30");
  assert.equal(b.getAccountBalance(checking), 95000, "Checking cash reduced by $50 from $1,000 to $950");

  // 4. Attempt payment on Card with $0 debt -> rejected
  m.open("Add transaction", cardZero.id, "Credit Card Payment");
  m.form.value.amount = "25";
  m.submit();
  assert.equal(m.error.value, "This credit card has no positive outstanding balance to pay.");

  // 5. Attempt payment on Card with statement credit -> rejected
  m.open("Add transaction", cardCredit.id, "Credit Card Payment");
  m.form.value.amount = "25";
  m.submit();
  assert.equal(m.error.value, "This credit card has no positive outstanding balance to pay.");

  // 6. Test editing payment: can adjust up to max debt before payment, but not beyond
  const paymentTx = b.state.value.transactions.find((t) => t.kind === "payment");
  assert.ok(paymentTx, "Payment transaction exists");
  m.open("Edit transaction", paymentTx.id);
  assert.equal(m.form.value.type, "Credit Card Payment");
  // Total owed is currently $30, original payment was $50 -> max allowable is $80
  m.form.value.amount = "80";
  m.submit();
  assert.equal(m.error.value, "", "Editing payment to full $80 succeeds");

  // Editing payment beyond $80 (e.g. $85) fails
  m.open("Edit transaction", paymentTx.id);
  m.form.value.amount = "85";
  m.submit();
  assert.equal(m.error.value, "Cannot pay more than the outstanding debt ($80.00).");
});

test("Test 2B.27 — Comprehensive Phase 2B Verification: Partial budget split, mixed payment Safe to Spend tracking, and partial coverage explanation", () => {
  const b = useBudget();
  const m = useModal();
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  const checking: Account = {
    id: "acc-chk-27",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000 cash
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-crd-27",
    name: "Credit Card",
    type: "credit",
    opening: 0, // $0 starting debt
    creditLimit: 100000,
    includeInSafeToSpend: false,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];
  state.budgets = [
    {
      id: "b-groc",
      category: "Groceries",
      limit: 10000, // $100 budget
      color: "#277c78",
    },
  ];
  b.state.value = state;

  // Initial Safe to Spend: $1,000 checking - $100 Groceries budget = $900
  assert.equal(b.sum.value.safe, 90000, "Initial Safe to Spend is $900");

  // Step 1: Partially budgeted credit purchase ($160 on Groceries with $100 budget)
  state.transactions.push({
    id: "tx-purchase-1",
    name: "Whole Foods",
    amount: -16000, // -$160
    category: "Groceries",
    date: simulatedToday,
    status: "cleared",
    postedDate: simulatedToday,
    accountId: card.id,
    kind: "standard",
    createdAt: `${simulatedToday}T10:00:00.000Z`,
  });

  const covAfterPurchase = b.getCreditCardCoverage(card.id);
  assert.equal(covAfterPurchase.totalOwed, 16000, "Total owed is $160.00");
  assert.equal(covAfterPurchase.readyToPay, 10000, "Ready to Pay is $100.00 (auto-covered from Groceries budget)");
  assert.equal(covAfterPurchase.uncoveredDebt, 6000, "Uncovered debt is $60.00 (excess over $100 budget)");
  assert.equal(covAfterPurchase.status, "partially_covered", "Status is partially_covered");
  assert.equal(b.getAccountBalance(checking), 100000, "Checking cash remains $1,000 (credit purchase does not affect checking)");

  // Safe to Spend check:
  // Cash: $1,000. Groceries budget remaining: $0. Ready to Pay: $100.
  // Safe to Spend = $1,000 - $0 - $100 = $900.
  // Note: Safe to Spend remains $900! The $100 was already deducted when budgeted; the $60 excess is uncovered debt awaiting cash allocation.
  assert.equal(b.sum.value.safe, 90000, "Safe to Spend remains $900 without double deduction");

  // Step 2: Open modal for Credit Card Payment
  m.open("Add transaction", card.id, "Credit Card Payment");
  assert.equal(m.form.value.type, "Credit Card Payment");
  assert.equal(m.form.value.targetAccountId, card.id);
  // Prefills from Ready to Pay when positive
  assert.equal(m.form.value.amount, "100", "Prefills reserved Ready to Pay amount ($100.00)");

  // Step 3: Enter a mixed payment of $140 ($100 covered + $40 uncovered)
  m.form.value.amount = "140";
  const paymentAmountCents = 14000;
  const coveredPortion = Math.min(paymentAmountCents, covAfterPurchase.readyToPay);
  const uncoveredPortion = Math.max(0, paymentAmountCents - covAfterPurchase.readyToPay);
  assert.equal(coveredPortion, 10000, "Covered portion is exactly $100.00");
  assert.equal(uncoveredPortion, 4000, "Uncovered portion is exactly $40.00");

  // Submit the mixed payment
  m.submit();
  assert.equal(m.error.value, "", "Mixed payment submission succeeds");

  // Step 4: Verify post-payment invariants
  const covAfterPay = b.getCreditCardCoverage(card.id);
  assert.equal(covAfterPay.totalOwed, 2000, "Total owed drops from $160 to $20 ($160 - $140)");
  assert.equal(covAfterPay.readyToPay, 0, "Ready to Pay is $0 (consumed all $100 reserved funds first)");
  assert.equal(covAfterPay.uncoveredDebt, 2000, "Remaining debt ($20) is uncovered");
  assert.equal(b.getAccountBalance(checking), 86000, "Checking cash reduced by exactly $140 from $1,000 to $860");

  // Safe to Spend post-payment:
  // Checking cash: $860. Ready to Pay: $0. Groceries remaining: $0.
  // Safe to Spend = $860.
  // Notice: Safe to Spend decreased from $900 to $860, exactly by $40 (the uncovered portion)!
  // The $100 covered portion did not decrease Safe to Spend again!
  assert.equal(b.sum.value.safe, 86000, "Safe to Spend reduced only by the $40 uncovered portion, not the $100 covered portion");

  // Step 5: Test remaining debt prefill
  // Now Ready to Pay is $0, but Total Owed is $20.
  m.open("Add transaction", card.id, "Credit Card Payment");
  assert.equal(m.form.value.amount, "20", "When Ready to Pay is $0, prefills positive Total Owed ($20.00)");

  // Attempting to pay above $20 fails
  m.form.value.amount = "25";
  m.submit();
  assert.equal(m.error.value, "Cannot pay more than the outstanding debt ($20.00).");

  // Pay remaining $20 uncovered
  m.form.value.amount = "20";
  m.submit();
  assert.equal(m.error.value, "");

  const covFinal = b.getCreditCardCoverage(card.id);
  assert.equal(covFinal.totalOwed, 0, "Card is completely paid off ($0 debt)");
  assert.equal(covFinal.readyToPay, 0, "Ready to Pay is $0");
  assert.equal(covFinal.status, "zero_balance");
  assert.equal(b.getAccountBalance(checking), 84000, "Checking cash reduced to $840");
  assert.equal(b.sum.value.safe, 84000, "Safe to Spend is $840");
});








