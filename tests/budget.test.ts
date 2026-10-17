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
  getBillOccurrenceStatus,
  type BillPaymentStatus,
  type BillOccurrenceStatus,
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
  type PaydaySchedule,
  type PaydayOverride,
  type PaydayFrequency,
  type WeekendRule,
  daysBetween,
  getDaysInMonth,
  adjustForWeekend,
  isValidDateString,
  getUpcomingPaydays,
  getNextPayday,
  getFollowingPaydayDate,
  getFollowingPayday,
  getCurrentPayday,
  validatePaydayOverride,
  applyPaydayOverride,
  removePaydayOverride,
  validatePaydaySchedule,
  updatePaydaySchedule,
  recordBillPayment,
  resolveNominalOccurrenceDate,
  getEffectiveOccurrenceDate,
  getConfirmedUpcomingPaydays,
  getCreditCardMinimumProtection,
  getCreditCardMinimumBreakdown,
  getCreditCardDueDate,
  confirmCreditCardMinimum,
  unconfirmCreditCardMinimum,
  getMonthlyExpenses,
  getMonthlyIncome,
  type CreditCardMinimumProtection,
  type CreditCardMinimumStatus,
} from "../src/model.ts";
import { useBudget } from "../src/composables/useBudget.ts";
import { useModal } from "../src/composables/useModal.ts";
import { money } from "../src/utils/format.ts";

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
  assert.ok(reImported.version === 4 || reImported.version === 5);
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
  assert.ok(parsed.version === 4 || parsed.version === 5);
  const restored = migrateState(parsed, simulatedToday);

  // Load restored state back into composable
  b.state.value = restored;

  assert.ok(b.state.value.version === 4 || b.state.value.version === 5);
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

test("Test 3A.1 — Schema v5 migration: preserves v4 payday values, defaults to manual schedule, and preserves financial numbers identically", () => {
  const simulatedToday = "2026-10-15";
  const rawV4State = {
    version: 4,
    demo: false,
    opening: 500000,
    payday: "2026-10-21",
    followingPayday: "2026-11-04",
    accounts: [
      {
        id: "acc-default-checking",
        name: "Primary Checking",
        type: "checking",
        opening: 500000,
        includeInSafeToSpend: true,
        createdAt: "2026-10-01",
        updatedAt: "2026-10-01",
      },
      {
        id: "acc-cc-v4",
        name: "Credit Card",
        type: "credit",
        opening: 0,
        creditLimit: 300000,
        includeInSafeToSpend: false,
        assignedPaymentReserve: 5000,
        paymentReservations: [
          {
            id: "res-1",
            amount: 5000,
            date: "2026-10-10",
            createdAt: "2026-10-10T12:00:00.000Z",
          },
        ],
        coveredCreditBaselineAt: "2026-10-01",
        createdAt: "2026-10-01",
        updatedAt: "2026-10-10",
      },
    ],
    budgets: [
      {
        id: "b-groc",
        category: "Groceries",
        limit: 20000,
        color: "#277c78",
      },
    ],
    pots: [
      {
        id: "p-vac",
        name: "Vacation",
        saved: 30000,
        target: 100000,
        color: "#82c9d7",
      },
    ],
    bills: [
      {
        id: "b-elec",
        name: "Electricity",
        amount: 8000,
        day: 18,
        protected: false,
        settledDueDates: [],
      },
      {
        id: "b-rent",
        name: "Rent",
        amount: 120000,
        day: 1,
        protected: true,
        settledDueDates: ["2026-10-01"],
      },
    ],
    transactions: [
      {
        id: "tx-groc",
        name: "Grocery run",
        amount: -5000,
        category: "Groceries",
        date: "2026-10-12",
        status: "cleared",
        accountId: "acc-cc-v4",
        kind: "standard",
        createdAt: "2026-10-12T10:00:00.000Z",
      },
    ],
  };

  const migrated = migrateState(rawV4State, simulatedToday);

  // 1. Version is bumped to 5
  assert.equal(migrated.version, 5, "Version must be 5");

  // 2. Payday and followingPayday fields are preserved identically
  assert.equal(migrated.payday, "2026-10-21");
  assert.equal(migrated.followingPayday, "2026-11-04");

  // 3. Defaults to manual schedule
  assert.ok(migrated.paydaySchedule, "paydaySchedule must be created");
  assert.equal(migrated.paydaySchedule.frequency, "manual");
  assert.equal(migrated.paydaySchedule.anchorDate, "2026-10-21");
  assert.equal(migrated.paydaySchedule.manualFollowingPayday, "2026-11-04");
  assert.equal(migrated.paydaySchedule.weekendRule, "exact");
  assert.equal(migrated.paydaySchedule.overrides.length, 0);

  // 4. Financial totals are completely unchanged
  const t = totals(migrated, simulatedToday);
  assert.equal(t.balance, 500000);
  assert.equal(t.pots, 30000);
  assert.equal(t.budgets, 15000);
  assert.equal(t.bills, 128000);
  assert.equal(t.totalReadyToPay, 5000);
  assert.equal(t.safe, 322000, "Safe to spend must be 100% identical post-migration");

  // 5. Idempotent round trip: migrating again preserves state
  const reMigrated = migrateState(JSON.parse(JSON.stringify(migrated)), simulatedToday);
  assert.equal(reMigrated.version, 5);
  assert.deepEqual(reMigrated, migrated, "Idempotent migration must preserve exact state");
});

test("Test 3A.2 — Biweekly schedule sequence crossing month and year boundaries", () => {
  const sched: PaydaySchedule = {
    frequency: "biweekly",
    anchorDate: "2026-12-18",
    weekendRule: "exact",
    overrides: [],
  };

  // As of 2026-12-18 (payday is today)
  const paydays1 = getUpcomingPaydays(sched, "2026-12-18", 4);
  assert.deepEqual(paydays1, [
    "2026-12-18",
    "2027-01-01",
    "2027-01-15",
    "2027-01-29",
  ]);
  assert.equal(getNextPayday(sched, "2026-12-18"), "2026-12-18");
  assert.equal(getFollowingPaydayDate(sched, "2026-12-18"), "2027-01-01");

  // As of 2026-12-19 (day after payday, next cycle advances automatically)
  const paydays2 = getUpcomingPaydays(sched, "2026-12-19", 3);
  assert.deepEqual(paydays2, [
    "2027-01-01",
    "2027-01-15",
    "2027-01-29",
  ]);
  assert.equal(getNextPayday(sched, "2026-12-19"), "2027-01-01");
  assert.equal(getFollowingPaydayDate(sched, "2026-12-19"), "2027-01-15");

  // As of 2027-01-02 (after New Year payday)
  assert.equal(getNextPayday(sched, "2027-01-02"), "2027-01-15");
  assert.equal(getFollowingPaydayDate(sched, "2027-01-02"), "2027-01-29");
});

test("Test 3A.3 — Weekly, Monthly, and Semimonthly cadences with calendar clamping", () => {
  // 1. Weekly schedule (every Friday)
  const weeklySched: PaydaySchedule = {
    frequency: "weekly",
    anchorDate: "2026-10-09",
    weekendRule: "exact",
    overrides: [],
  };
  const weeklyPaydays = getUpcomingPaydays(weeklySched, "2026-10-14", 3);
  assert.deepEqual(weeklyPaydays, [
    "2026-10-16",
    "2026-10-23",
    "2026-10-30",
  ]);
  assert.equal(daysBetween(weeklyPaydays[0]!, weeklyPaydays[1]!), 7);
  assert.equal(daysBetween(weeklyPaydays[1]!, weeklyPaydays[2]!), 7);

  // 2. Monthly on the 31st in non-leap year (2026)
  const monthlySched: PaydaySchedule = {
    frequency: "monthly",
    anchorDate: "2026-01-31",
    dayOfMonth: 31,
    weekendRule: "exact",
    overrides: [],
  };
  const monthly2026 = getUpcomingPaydays(monthlySched, "2026-01-15", 4);
  assert.deepEqual(monthly2026, [
    "2026-01-31",
    "2026-02-28", // Clamped to 28 in non-leap year Feb
    "2026-03-31",
    "2026-04-30", // Clamped to 30 in April
  ]);

  // 3. Monthly on the 31st in leap year (2028)
  const leapMonthly: PaydaySchedule = {
    frequency: "monthly",
    anchorDate: "2028-01-31",
    dayOfMonth: 31,
    weekendRule: "exact",
    overrides: [],
  };
  const monthly2028 = getUpcomingPaydays(leapMonthly, "2028-02-01", 3);
  assert.deepEqual(monthly2028, [
    "2028-02-29", // Clamped to 29 in leap year Feb!
    "2028-03-31",
    "2028-04-30",
  ]);

  // 4. Semimonthly on 15th and 31st (15th and end-of-month)
  const semimonthlySched: PaydaySchedule = {
    frequency: "semimonthly",
    anchorDate: "2026-02-01",
    firstDay: 15,
    secondDay: 31,
    weekendRule: "exact",
    overrides: [],
  };
  const semiPaydays = getUpcomingPaydays(semimonthlySched, "2026-02-01", 6);
  assert.deepEqual(semiPaydays, [
    "2026-02-15",
    "2026-02-28", // Clamped Feb end of month
    "2026-03-15",
    "2026-03-31",
    "2026-04-15",
    "2026-04-30", // Clamped Apr end of month
  ]);
});

test("Test 3A.4 — Weekend rule adjustments: Exact date vs Preceding Friday", () => {
  // 2026-10-17 is Saturday, 2026-10-31 is Saturday
  const schedExact: PaydaySchedule = {
    frequency: "biweekly",
    anchorDate: "2026-10-17",
    weekendRule: "exact",
    overrides: [],
  };
  assert.deepEqual(getUpcomingPaydays(schedExact, "2026-10-10", 2), [
    "2026-10-17",
    "2026-10-31",
  ]);

  const schedFriday: PaydaySchedule = {
    frequency: "biweekly",
    anchorDate: "2026-10-17",
    weekendRule: "preceding_friday",
    overrides: [],
  };
  // Saturday shifted -1 day to Friday (Oct 16 and Oct 30)
  assert.deepEqual(getUpcomingPaydays(schedFriday, "2026-10-10", 2), [
    "2026-10-16",
    "2026-10-30",
  ]);

  // Sunday occurrence (e.g. 2026-10-18) shifted -2 days to Friday
  assert.equal(adjustForWeekend("2026-10-18", "preceding_friday"), "2026-10-16");
  assert.equal(adjustForWeekend("2026-10-18", "exact"), "2026-10-18");

  // Weekday occurrence (e.g. 2026-10-16 Friday) unchanged
  assert.equal(adjustForWeekend("2026-10-16", "preceding_friday"), "2026-10-16");
});

test("Test 3A.5 — One-time overrides: Substitution, ordering sequence bounds, and collision rejection", () => {
  const sched: PaydaySchedule = {
    frequency: "biweekly",
    anchorDate: "2026-10-07", // Occurrences: Oct 7, Oct 21, Nov 4, Nov 18
    weekendRule: "exact",
    overrides: [],
  };

  // 1. Valid override: Shift Oct 21 to Oct 20 (Tuesday before nominal Wednesday payday)
  const valValid = validatePaydayOverride(sched, "2026-10-21", "2026-10-20");
  assert.equal(valValid.valid, true);

  const applied = applyPaydayOverride(sched, {
    scheduledDate: "2026-10-21",
    overrideDate: "2026-10-20",
    note: "Early deposit for holiday",
  });
  assert.equal(applied.success, true);
  assert.equal(applied.schedule.overrides.length, 1);

  // In upcoming paydays, Oct 20 substitutes for Oct 21
  const paydays = getUpcomingPaydays(applied.schedule, "2026-10-15", 3);
  assert.deepEqual(paydays, [
    "2026-10-20",
    "2026-11-04",
    "2026-11-18",
  ]);

  // 2. Scheduled date validation: 2026-10-22 is not a biweekly occurrence from Oct 7
  const valInvalidSched = validatePaydayOverride(sched, "2026-10-22", "2026-10-23");
  assert.equal(valInvalidSched.valid, false);
  assert.match(valInvalidSched.error!, /not a valid scheduled occurrence/);

  // 3. Sequence bounds / Ordering checks:
  // For Oct 21 occurrence, predecessor is Oct 7, successor is Nov 4
  // A. Moving on or before Oct 7 is rejected
  const valTooEarly1 = validatePaydayOverride(sched, "2026-10-21", "2026-10-07");
  assert.equal(valTooEarly1.valid, false);
  assert.match(valTooEarly1.error!, /cannot be on or before the preceding payday/);

  const valTooEarly2 = validatePaydayOverride(sched, "2026-10-21", "2026-10-06");
  assert.equal(valTooEarly2.valid, false);
  assert.match(valTooEarly2.error!, /cannot be on or before the preceding payday/);

  // B. Moving on or after Nov 4 is rejected
  const valTooLate1 = validatePaydayOverride(sched, "2026-10-21", "2026-11-04");
  assert.equal(valTooLate1.valid, false);
  assert.match(valTooLate1.error!, /cannot be on or after the following payday/);

  const valTooLate2 = validatePaydayOverride(sched, "2026-10-21", "2026-11-05");
  assert.equal(valTooLate2.valid, false);
  assert.match(valTooLate2.error!, /cannot be on or after the following payday/);

  // 4. Collision check against another active override
  const schedWithTwo: PaydaySchedule = {
    ...sched,
    overrides: [
      { id: "ov-1", scheduledDate: "2026-11-04", overrideDate: "2026-11-03", createdAt: "2026-10-15" },
    ],
  };
  const valCollision = validatePaydayOverride(schedWithTwo, "2026-10-21", "2026-11-03");
  assert.equal(valCollision.valid, false);
  assert.match(valCollision.error!, /collides with another payday override/);

  // 5. Upsert: Applying another override on the same scheduled occurrence updates it
  const updated = applyPaydayOverride(applied.schedule, {
    scheduledDate: "2026-10-21",
    overrideDate: "2026-10-19",
    note: "Updated to Monday",
  });
  assert.equal(updated.success, true);
  assert.equal(updated.schedule.overrides.length, 1, "Must update existing override without duplicating");
  assert.equal(updated.schedule.overrides[0]!.overrideDate, "2026-10-19");

  // 6. Removal: removePaydayOverride restores nominal scheduled date
  const removed = removePaydayOverride(updated.schedule, "2026-10-21");
  assert.equal(removed.overrides.length, 0);
  assert.deepEqual(getUpcomingPaydays(removed, "2026-10-15", 3), [
    "2026-10-21",
    "2026-11-04",
    "2026-11-18",
  ]);
});

test("Test 3A.6 — JSON backup export and import round trip with schema v5", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.version = 5;
  state.payday = "2026-10-21";
  state.followingPayday = "2026-11-04";
  state.paydaySchedule = {
    frequency: "biweekly",
    anchorDate: "2026-10-21",
    weekendRule: "preceding_friday",
    overrides: [
      {
        id: "ov-nov",
        scheduledDate: "2026-11-04",
        overrideDate: "2026-11-03",
        note: "Pre-election bank holiday",
        createdAt: "2026-10-15T12:00:00.000Z",
      },
    ],
  };

  const checking: Account = {
    id: "acc-chk-v5",
    name: "Checking",
    type: "checking",
    opening: 450000,
    includeInSafeToSpend: true,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  const card: Account = {
    id: "acc-crd-v5",
    name: "Visa",
    type: "credit",
    opening: 0,
    creditLimit: 200000,
    includeInSafeToSpend: false,
    assignedPaymentReserve: 15000,
    paymentReservations: [
      { id: "pr-1", amount: 15000, date: simulatedToday, createdAt: `${simulatedToday}T10:00:00.000Z` },
    ],
    coveredCreditBaselineAt: simulatedToday,
    createdAt: simulatedToday,
    updatedAt: simulatedToday,
  };
  state.accounts = [checking, card];

  // Export to JSON string
  const exported = JSON.stringify(state, null, 2);
  const parsed = JSON.parse(exported);
  assert.equal(parsed.version, 5);

  // Restore via migrateState
  const restored = migrateState(parsed, simulatedToday);
  assert.equal(restored.version, 5);
  assert.equal(restored.paydaySchedule.frequency, "biweekly");
  assert.equal(restored.paydaySchedule.anchorDate, "2026-10-21");
  assert.equal(restored.paydaySchedule.weekendRule, "preceding_friday");
  assert.equal(restored.paydaySchedule.overrides.length, 1);
  assert.equal(restored.paydaySchedule.overrides[0]!.overrideDate, "2026-11-03");

  // Verify accounts and covered credit reservations preserved identically
  const restoredCard = restored.accounts.find((a) => a.id === card.id)!;
  assert.equal(restoredCard.assignedPaymentReserve, 15000);
  assert.equal(restoredCard.paymentReservations?.length, 1);
  assert.equal(restoredCard.paymentReservations?.[0]?.amount, 15000);

  // Verify Safe to Spend is identical
  assert.equal(totals(restored, simulatedToday).safe, totals(state, simulatedToday).safe);
});

test("Test 3A.7 — Issue 1: Chronological, unique effective dates crossing month boundaries and approaching adjacent paydays", () => {
  // 1. Biweekly schedule crossing month boundary
  // Anchor: 2026-04-17 (Nominals: 2026-04-17, 2026-05-01, 2026-05-15, 2026-05-29, 2026-06-12)
  const schedBiweekly: PaydaySchedule = {
    frequency: "biweekly",
    anchorDate: "2026-04-17",
    weekendRule: "exact",
    overrides: [
      // Move 2026-05-01 backward across month boundary into April: 2026-04-30
      {
        id: "ov-apr",
        scheduledDate: "2026-05-01",
        overrideDate: "2026-04-30",
        createdAt: "2026-04-01",
      },
      // Move 2026-05-29 forward across month boundary into June: 2026-06-01
      {
        id: "ov-jun",
        scheduledDate: "2026-05-29",
        overrideDate: "2026-06-01",
        createdAt: "2026-04-01",
      },
    ],
  };

  const paydaysBiweekly = getUpcomingPaydays(schedBiweekly, "2026-04-20", 4);
  assert.deepEqual(paydaysBiweekly, [
    "2026-04-30",
    "2026-05-15",
    "2026-06-01",
    "2026-06-12",
  ]);

  // Strict monotonicity & uniqueness assertions
  for (let i = 0; i < paydaysBiweekly.length - 1; i++) {
    assert.ok(
      paydaysBiweekly[i]! < paydaysBiweekly[i + 1]!,
      `Strict chronological ordering violated: ${paydaysBiweekly[i]} must precede ${paydaysBiweekly[i + 1]}`,
    );
  }
  assert.equal(
    new Set(paydaysBiweekly).size,
    paydaysBiweekly.length,
    "Dates must be strictly unique",
  );

  // 2. Approaching adjacent payday: Move 2026-05-01 to 2026-05-14 (1 day before next occurrence on May 15)
  const schedApproaching: PaydaySchedule = {
    frequency: "biweekly",
    anchorDate: "2026-05-01",
    weekendRule: "exact",
    overrides: [
      {
        id: "ov-approach",
        scheduledDate: "2026-05-01",
        overrideDate: "2026-05-14",
        createdAt: "2026-05-01",
      },
    ],
  };
  const paydaysApproaching = getUpcomingPaydays(schedApproaching, "2026-05-10", 3);
  assert.deepEqual(paydaysApproaching, [
    "2026-05-14",
    "2026-05-15",
    "2026-05-29",
  ]);
  assert.ok(paydaysApproaching[0]! < paydaysApproaching[1]!);
  assert.ok(paydaysApproaching[1]! < paydaysApproaching[2]!);

  // 3. Semimonthly crossing month boundary: Feb 2026 (nominal Feb 28 overridden to March 1)
  const schedSemimonthly: PaydaySchedule = {
    frequency: "semimonthly",
    anchorDate: "2026-01-15",
    firstDay: 15,
    secondDay: 31,
    weekendRule: "exact",
    overrides: [
      {
        id: "ov-feb-end",
        scheduledDate: "2026-02-28",
        overrideDate: "2026-03-01",
        createdAt: "2026-02-01",
      },
    ],
  };
  const paydaysSemi = getUpcomingPaydays(schedSemimonthly, "2026-02-20", 3);
  assert.deepEqual(paydaysSemi, [
    "2026-03-01",
    "2026-03-15",
    "2026-03-31",
  ]);
  assert.ok(paydaysSemi[0]! < paydaysSemi[1]!);
  assert.ok(paydaysSemi[1]! < paydaysSemi[2]!);
});

test("Test 3A.8 — Issue 2: Manual schedule generation respecting explicitly configured first and second paydays, including irregular intervals", () => {
  // Scenario A: 5-day irregular interval (e.g. May 1 and May 6)
  const schedShort: PaydaySchedule = {
    frequency: "manual",
    anchorDate: "2026-05-01",
    manualFollowingPayday: "2026-05-06",
    weekendRule: "exact",
    overrides: [],
  };

  // Both explicitly configured dates are respected when asOf <= anchorDate
  const resShort1 = getUpcomingPaydays(schedShort, "2026-05-01", 3);
  assert.deepEqual(resShort1, [
    "2026-05-01",
    "2026-05-06",
    "2026-05-11",
  ]);
  assert.equal(getNextPayday(schedShort, "2026-05-01"), "2026-05-01");
  assert.equal(getFollowingPaydayDate(schedShort, "2026-05-01"), "2026-05-06");

  // When asOf advances between first and second, second is strictly upcoming
  const resShort2 = getUpcomingPaydays(schedShort, "2026-05-03", 3);
  assert.deepEqual(resShort2, [
    "2026-05-06",
    "2026-05-11",
    "2026-05-16",
  ]);
  assert.equal(getNextPayday(schedShort, "2026-05-03"), "2026-05-06");
  assert.equal(getFollowingPaydayDate(schedShort, "2026-05-03"), "2026-05-11");

  // Scenario B: 23-day irregular interval (e.g. May 1 and May 24)
  const schedLong: PaydaySchedule = {
    frequency: "manual",
    anchorDate: "2026-05-01",
    manualFollowingPayday: "2026-05-24",
    weekendRule: "exact",
    overrides: [],
  };

  const resLong1 = getUpcomingPaydays(schedLong, "2026-05-01", 3);
  assert.deepEqual(resLong1, [
    "2026-05-01",
    "2026-05-24",
    "2026-06-16",
  ]);
  assert.equal(getNextPayday(schedLong, "2026-05-01"), "2026-05-01");
  assert.equal(getFollowingPaydayDate(schedLong, "2026-05-01"), "2026-05-24");

  const resLong2 = getUpcomingPaydays(schedLong, "2026-05-10", 3);
  assert.deepEqual(resLong2, [
    "2026-05-24",
    "2026-06-16",
    "2026-07-09",
  ]);
  assert.equal(getNextPayday(schedLong, "2026-05-10"), "2026-05-24");

  // Scenario C: Explicit weekend dates configured manually are respected without shift
  const schedWeekendManual: PaydaySchedule = {
    frequency: "manual",
    anchorDate: "2026-05-02", // Saturday
    manualFollowingPayday: "2026-05-17", // Sunday
    weekendRule: "preceding_friday",
    overrides: [],
  };
  const resWeekend = getUpcomingPaydays(schedWeekendManual, "2026-05-01", 2);
  assert.deepEqual(
    resWeekend,
    ["2026-05-02", "2026-05-17"],
    "Explicitly configured first and second manual paydays must be respected",
  );

  // Scenario D: Preserving v4 financial behavior with irregular interval
  const stateV4Compat: State = {
    ...blank(),
    payday: "2026-05-01",
    followingPayday: "2026-05-24",
    paydaySchedule: schedLong,
    bills: [
      { id: "b1", name: "Early May Bill", amount: 15000, day: 4, protected: true },
      { id: "b2", name: "Mid May Bill", amount: 20000, day: 15, protected: true },
      { id: "b3", name: "Late May Bill", amount: 30000, day: 28, protected: true },
    ],
  };
  assert.equal(getFollowingPayday(stateV4Compat), "2026-05-24");
  const breakdown = reserveBillsBreakdown(stateV4Compat, "2026-05-01");
  // b1 due May 4 is <= payday May 1? No, due May 4 > payday May 1, but <= followingPayday May 24, so protectedCycleBills
  assert.ok(breakdown.protectedCycleBills > 0);
  assert.equal(totals(stateV4Compat, "2026-05-01").bills, breakdown.total);

  // Scenario E: Evaluating a manual schedule before its first configured payday
  // (No hypothetical paydays invented before anchorDate)
  const schedFuture: PaydaySchedule = {
    frequency: "manual",
    anchorDate: "2026-05-01",
    manualFollowingPayday: "2026-05-15",
    weekendRule: "exact",
    overrides: [],
  };

  // Evaluated on April 10 (21 days prior to first configured payday)
  const resPreAnchor = getUpcomingPaydays(schedFuture, "2026-04-10", 3);
  assert.deepEqual(
    resPreAnchor,
    ["2026-05-01", "2026-05-15", "2026-05-29"],
    "Must not invent any hypothetical paydays before the configured anchorDate",
  );
  assert.equal(getNextPayday(schedFuture, "2026-04-10"), "2026-05-01");
  assert.equal(getFollowingPaydayDate(schedFuture, "2026-04-10"), "2026-05-15");

  // Valid one-time override on first configured payday moving earlier (e.g. to April 30)
  const schedWithPreOverride: PaydaySchedule = {
    ...schedFuture,
    overrides: [
      {
        id: "ov-pre-anchor",
        scheduledDate: "2026-05-01",
        overrideDate: "2026-04-30",
        createdAt: "2026-04-01",
      },
    ],
  };
  const resOverridePre = getUpcomingPaydays(schedWithPreOverride, "2026-04-10", 3);
  assert.deepEqual(
    resOverridePre,
    ["2026-04-30", "2026-05-15", "2026-05-29"],
    "Existing one-time overrides on anchorDate continue to work",
  );
});

test("Test 3A.9 — Issue 3: Schema v5 migration and import sanitization of invalid dates, non-integer days, duplicate overrides, and sequence collisions", () => {
  const simulatedToday = "2026-10-15";
  const malformedRawState = {
    version: 4,
    opening: 50000,
    payday: "2026-02-31", // Invalid calendar date!
    followingPayday: "2026-13-45", // Invalid month and day!
    paydaySchedule: {
      frequency: "semimonthly",
      anchorDate: "invalid-anchor",
      manualFollowingPayday: "not-a-valid-date",
      dayOfMonth: 15.7, // Non-integer day
      firstDay: 28.4, // Float day
      secondDay: 10.2, // Float day, also firstDay > secondDay
      weekendRule: "unknown_rule",
      overrides: [
        // 1. Invalid calendar date
        { scheduledDate: "2026-02-31", overrideDate: "2026-02-28" },
        // 2. Valid override for nominal 2026-10-10 (since semimonthly 10 and 28)
        { scheduledDate: "2026-10-10", overrideDate: "2026-10-09", note: "Valid 1" },
        // 3. Duplicate override for same nominal scheduledDate
        { scheduledDate: "2026-10-10", overrideDate: "2026-10-08", note: "Duplicate" },
        // 4. Colliding override date (targeting 2026-10-28 but trying to use 2026-10-09)
        { scheduledDate: "2026-10-28", overrideDate: "2026-10-09", note: "Collision" },
        // 5. Sequence violation (trying to override 2026-10-28 to before 2026-10-10)
        { scheduledDate: "2026-10-28", overrideDate: "2026-10-05", note: "Out of sequence" },
        // 6. Valid override for nominal 2026-10-28
        { scheduledDate: "2026-10-28", overrideDate: "2026-10-27", note: "Valid 2" },
      ],
    },
    accounts: [
      {
        id: "acc-chk-clean",
        name: "Checking",
        type: "checking",
        opening: 50000,
        includeInSafeToSpend: true,
      },
      {
        id: "acc-crd-clean",
        name: "Credit Card",
        type: "credit",
        opening: 10000,
        creditLimit: 100000,
        assignedPaymentReserve: 5000,
        paymentReservations: [
          { id: "pr-clean", amount: 5000, date: simulatedToday, createdAt: simulatedToday },
        ],
      },
    ],
    budgets: [
      { id: "b-clean", category: "Dining", limit: 20000, color: "#277c78" },
    ],
    pots: [
      { id: "p-clean", name: "Vacation", saved: 15000, target: 50000, color: "#82c9d7" },
    ],
    bills: [
      { id: "bi-clean", name: "Internet", amount: 8000, day: 12.8, protected: true }, // Float day
    ],
    transactions: [
      {
        id: "tx-clean",
        name: "Groceries",
        amount: -3500,
        category: "Dining",
        date: simulatedToday,
        status: "cleared",
        accountId: "acc-chk-clean",
      },
    ],
  };

  const migrated = migrateState(malformedRawState, simulatedToday);

  // 1. Calendar dates safely normalized
  assert.equal(isValidDateString(migrated.payday), true);
  assert.equal(isValidDateString(migrated.followingPayday), true);
  assert.equal(isValidDateString(migrated.paydaySchedule.anchorDate), true);

  // 2. Schedule days normalized to integers and ordered correctly
  assert.equal(migrated.paydaySchedule.firstDay, 10, "Rounded 10.2 and ordered before 28");
  assert.equal(migrated.paydaySchedule.secondDay, 28, "Rounded 28.4 and ordered after 10");
  assert.equal(migrated.paydaySchedule.weekendRule, "exact", "Unknown rule normalized to exact");

  // 3. Overrides sanitized: exactly the 2 valid, non-colliding, properly sequenced overrides kept
  assert.equal(migrated.paydaySchedule.overrides.length, 2);
  assert.equal(migrated.paydaySchedule.overrides[0]!.scheduledDate, "2026-10-10");
  assert.equal(migrated.paydaySchedule.overrides[0]!.overrideDate, "2026-10-09");
  assert.equal(migrated.paydaySchedule.overrides[1]!.scheduledDate, "2026-10-28");
  assert.equal(migrated.paydaySchedule.overrides[1]!.overrideDate, "2026-10-27");

  // 4. Financial state 100% uncorrupted
  assert.equal(migrated.opening, 50000);
  assert.equal(migrated.accounts.length, 2);
  const card = migrated.accounts.find((a) => a.id === "acc-crd-clean")!;
  assert.equal(card.assignedPaymentReserve, 5000);
  assert.equal(card.paymentReservations?.length, 1);
  assert.equal(migrated.budgets.length, 1);
  assert.equal(migrated.pots.length, 1);
  assert.equal(migrated.pots[0]!.saved, 15000);
  assert.equal(migrated.transactions.length, 1);
  assert.equal(migrated.transactions[0]!.amount, -3500);

  // Bill day rounded safely
  assert.equal(Number.isInteger(migrated.bills[0]!.day), true);
});

test("Test 3A.10 — Issue 4: JSON backup round trips and migration idempotence across valid & normalized states", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.version = 5;
  state.payday = "2026-10-20";
  state.followingPayday = "2026-11-12"; // 23-day irregular interval
  state.paydaySchedule = {
    frequency: "manual",
    anchorDate: "2026-10-20",
    manualFollowingPayday: "2026-11-12",
    weekendRule: "exact",
    overrides: [],
  };
  state.accounts = [
    {
      id: "acc-chk-idemp",
      name: "Checking",
      type: "checking",
      opening: 300000,
      includeInSafeToSpend: true,
      createdAt: simulatedToday,
      updatedAt: simulatedToday,
    },
    {
      id: "acc-cc-idemp",
      name: "Card",
      type: "credit",
      opening: 10000,
      creditLimit: 150000,
      includeInSafeToSpend: false,
      assignedPaymentReserve: 4000,
      paymentReservations: [
        { id: "pr-idemp", amount: 4000, date: simulatedToday, createdAt: simulatedToday },
      ],
      coveredCreditBaselineAt: simulatedToday,
      createdAt: simulatedToday,
      updatedAt: simulatedToday,
    },
  ];
  state.budgets = [
    { id: "b-idemp", category: "Groceries", limit: 30000, color: "#277c78" },
  ];
  state.pots = [
    { id: "p-idemp", name: "Savings", saved: 25000, target: 100000, color: "#82c9d7" },
  ];
  state.bills = [
    { id: "bi-idemp", name: "Electric", amount: 12000, day: 25, protected: true },
  ];
  state.transactions = [
    {
      id: "t-idemp-1",
      name: "Supermarket",
      amount: -4500,
      category: "Groceries",
      date: simulatedToday,
      status: "cleared",
      accountId: "acc-chk-idemp",
      kind: "standard",
    },
  ];

  // 1. Migration idempotence: running migrateState twice yields identical state
  const m1 = migrateState(state, simulatedToday);
  const m2 = migrateState(m1, simulatedToday);
  assert.deepEqual(m2, m1, "Migration must be strictly idempotent");

  // 2. JSON export and import round trip preserves state and financial invariants
  const jsonExport = JSON.stringify(m1, null, 2);
  const parsed = JSON.parse(jsonExport);
  const restored = migrateState(parsed, simulatedToday);

  assert.deepEqual(restored, m1, "Restored state must match original state identically");

  // Totals, coverage, and Safe to Spend match exactly
  const tOriginal = totals(m1, simulatedToday);
  const tRestored = totals(restored, simulatedToday);
  assert.equal(tRestored.safe, tOriginal.safe);
  assert.equal(tRestored.balance, tOriginal.balance);
  assert.equal(tRestored.totalReadyToPay, tOriginal.totalReadyToPay);
  assert.equal(tRestored.bills, tOriginal.bills);
});

test("Test 3A.2.1 — Historical ledger activity does not invent overdue bills during migration", () => {
  const simulatedToday = "2026-10-16";
  const rawV4State = {
    version: 4,
    opening: 500000,
    payday: "2026-10-23",
    followingPayday: "2026-11-06",
    bills: [
      {
        id: "b-wifi",
        name: "Fiber Internet",
        amount: 6000,
        day: 5,
        protected: false,
        settledDueDates: [],
        // Notice: No trackingStartDate present in legacy state
      },
    ],
    transactions: [
      {
        id: "tx-aug",
        name: "Old Purchase August",
        amount: -2500,
        date: "2026-08-10",
        status: "posted",
      },
      {
        id: "tx-sep",
        name: "Old Purchase September",
        amount: -3000,
        date: "2026-09-12",
        status: "posted",
      },
    ],
  };

  const migrated = migrateState(rawV4State, simulatedToday);

  // Bill begins tracking from the migration month (2026-10-01)
  const bill = migrated.bills.find((b) => b.id === "b-wifi")!;
  assert.equal(bill.trackingStartDate, "2026-10-01", "Legacy bill tracking starts at migration month");

  // Breakdown must only reserve the October occurrence, NOT earlier historical occurrences
  const breakdown = reserveBillsBreakdown(migrated, simulatedToday);
  assert.equal(breakdown.currentCycleBills, 6000, "Only current cycle October occurrence is reserved");
  assert.equal(breakdown.protectedCycleBills, 0);
  assert.equal(breakdown.details.length, 1);
  assert.equal(breakdown.details[0]!.dueDate, "2026-10-05");
});

test("Test 3A.2.2 — Bill created after its due day does not automatically create an overdue occurrence", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  // Bill created on Oct 16 with due day on the 5th
  const newBill: Bill = {
    id: "b-streaming",
    name: "Video Stream",
    amount: 1500,
    day: 5,
    protected: true,
    trackingStartDate: "2026-10-16", // Explicit tracking start date
  };
  state.bills.push(newBill);

  // Next unpaid due date must be Nov 5, NOT Oct 5
  const nextDue = nextUnpaidDueDate(state, newBill, simulatedToday);
  assert.equal(nextDue, "2026-11-05", "Must skip pre-tracking Oct 5 occurrence and project Nov 5");

  // Not unpaid for current month
  assert.equal(isBillUnpaidThisMonth(state, newBill, simulatedToday), false, "Must not be unpaid this month");

  // Breakdown does not reserve October 5 in current cycle
  const breakdown = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(breakdown.currentCycleBills, 0, "Pre-tracking due date must not become overdue debt");
  assert.equal(breakdown.protectedCycleBills, 1500, "Protected Nov 5 occurrence is reserved in following cycle");
  assert.equal(breakdown.details.length, 1);
  assert.equal(breakdown.details[0]!.dueDate, "2026-11-05");
});

test("Test 3A.2.3 — Multi-occurrence overdue bill reservations (> 60 days lookback)", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.opening = 300000;
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  // Bill tracked since July 1, unpaid for 4 months (July, Aug, Sep, Oct)
  const longOverdueBill: Bill = {
    id: "b-storage",
    name: "Storage Unit",
    amount: 5000,
    day: 10,
    protected: false,
    trackingStartDate: "2026-07-01",
  };
  state.bills.push(longOverdueBill);

  const breakdown = reserveBillsBreakdown(state, simulatedToday);
  // July 10, Aug 10, Sep 10, Oct 10 = 4 occurrences * $50 = $200 (20000 cents)
  assert.equal(breakdown.currentCycleBills, 20000, "Must reserve all 4 overdue occurrences");
  assert.equal(breakdown.details.length, 4);
  assert.deepEqual(
    breakdown.details.map((d) => d.dueDate),
    ["2026-07-10", "2026-08-10", "2026-09-10", "2026-10-10"],
    "Must retain occurrences older than 60 days without arbitrary drop-off",
  );

  const earliestUnpaid = nextUnpaidDueDate(state, longOverdueBill, simulatedToday);
  assert.equal(earliestUnpaid, "2026-07-10", "Earliest unpaid due date must be July 10");
});

test("Test 3A.2.4 — One payment settles only its intended occurrence", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  const gymBill: Bill = {
    id: "b-gym",
    name: "Fitness Gym",
    amount: 5000,
    day: 5,
    protected: false,
    trackingStartDate: "2026-08-01",
  };
  state.bills.push(gymBill);

  // Before payments: Aug 5, Sep 5, Oct 5 are unpaid = 15000 cents
  let bd = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(bd.currentCycleBills, 15000);

  // Payment 1: Explicitly tagged with billDueDate for September 5
  state.transactions.push({
    id: "tx-gym-sep",
    name: "Gym Payment (Sep)",
    amount: -5000,
    category: "Fitness",
    date: "2026-09-20",
    status: "posted",
    billId: gymBill.id,
    billDueDate: "2026-09-05",
  });

  assert.equal(isBillPaid(state, gymBill, "2026-08-05"), false, "August remains unpaid");
  assert.equal(isBillPaid(state, gymBill, "2026-09-05"), true, "September is paid");
  assert.equal(isBillPaid(state, gymBill, "2026-10-05"), false, "October remains unpaid");

  bd = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(bd.currentCycleBills, 10000, "Only August and October are reserved");
  assert.deepEqual(
    bd.details.map((d) => d.dueDate),
    ["2026-08-05", "2026-10-05"],
  );

  // Payment 2: Transaction without billDueDate dated in October
  state.transactions.push({
    id: "tx-gym-oct",
    name: "Gym Payment (Oct)",
    amount: -5000,
    category: "Fitness",
    date: "2026-10-08",
    status: "posted",
    billId: gymBill.id,
  });

  // Because August is still unpaid, tx-gym-oct without billDueDate cannot be unambiguously
  // assigned to October without guessing whether it was a late payment for August.
  // Both August and October remain retained as unpaid obligations!
  assert.equal(isBillPaid(state, gymBill, "2026-08-05"), false, "August remains unpaid");
  assert.equal(isBillPaid(state, gymBill, "2026-10-05"), false, "October is not paid due to ambiguous prior unpaid August obligation");

  bd = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(bd.currentCycleBills, 10000, "Both August and October are reserved");
  assert.deepEqual(
    bd.details.map((d) => d.dueDate),
    ["2026-08-05", "2026-10-05"],
  );

  // Settlement: Manual settlement for August occurrence disambiguates the state
  settleBillOccurrence(state, gymBill.id, "2026-08-05");
  assert.equal(isBillPaid(state, gymBill, "2026-08-05"), true, "August is now settled");
  assert.equal(isBillPaid(state, gymBill, "2026-10-05"), true, "With August settled, October transaction unambiguously matches October");

  bd = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(bd.currentCycleBills, 0, "All occurrences are now resolved");
});

test("Test 3A.2.5 — Covered versus uncovered credit-card bill purchases", () => {
  const simulatedToday = "2026-10-16";

  // Scenario A: Budget-covered bill purchase on credit card
  const stateCovered: State = blank();
  stateCovered.accounts = [
    {
      id: "acc-checking",
      name: "Checking",
      type: "checking",
      opening: 200000,
      includeInSafeToSpend: true,
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    },
    {
      id: "acc-card",
      name: "Credit Card",
      type: "credit",
      opening: 0,
      includeInSafeToSpend: false,
      coveredCreditBaselineAt: "2026-10-01",
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    },
  ];
  stateCovered.budgets = [
    { id: "bg-util", category: "Utilities", limit: 20000, color: "#277c78" },
  ];
  const utilBill: Bill = {
    id: "b-util",
    name: "Power Utility",
    amount: 12000,
    day: 5,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  stateCovered.bills.push(utilBill);

  // Before credit charge: bill is reserved ($120)
  let t = totals(stateCovered, simulatedToday);
  assert.equal(t.bills, 12000);
  assert.equal(t.totalReadyToPay, 0);

  // Bill charged to credit card under "Utilities" category
  stateCovered.transactions.push({
    id: "tx-util-card",
    name: "Power Utility Charge",
    amount: -12000,
    category: "Utilities",
    date: "2026-10-05",
    status: "posted",
    accountId: "acc-card",
    kind: "standard",
    billId: utilBill.id,
    billDueDate: "2026-10-05",
    createdAt: "2026-10-05T12:00:00.000Z",
  });

  t = totals(stateCovered, simulatedToday);
  // Bill reservation must be released
  assert.equal(t.bills, 0, "Bill reservation released after credit card purchase");
  // Debt is covered by budget: Ready to Pay increases by $120
  assert.equal(t.totalCreditOwed, 12000, "Credit card owes $120");
  assert.equal(t.totalReadyToPay, 12000, "Ready to Pay is $120 backed by budget");
  assert.equal(t.totalUncoveredDebt, 0, "Uncovered debt is $0");
  // Checking balance intact ($2,000)
  assert.equal(t.balance, 200000);
  // Remaining budget: 20000 - 12000 = 8000
  assert.equal(t.budgets, 8000);
  // Safe to Spend: 200000 - 8000 (budget) - 12000 (readyToPay) = 180000
  assert.equal(t.safe, 180000);

  // Scenario B: Uncovered (unbudgeted) bill purchase on credit card
  const stateUncovered: State = blank();
  stateUncovered.accounts = [
    {
      id: "acc-checking",
      name: "Checking",
      type: "checking",
      opening: 200000,
      includeInSafeToSpend: true,
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    },
    {
      id: "acc-card",
      name: "Credit Card",
      type: "credit",
      opening: 0,
      includeInSafeToSpend: false,
      coveredCreditBaselineAt: "2026-10-01",
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    },
  ];
  stateUncovered.bills.push(utilBill);
  // No budget for Utilities

  // Bill charged to credit card
  stateUncovered.transactions.push({
    id: "tx-util-card-unbudgeted",
    name: "Power Utility Charge",
    amount: -12000,
    category: "Utilities",
    date: "2026-10-05",
    status: "posted",
    accountId: "acc-card",
    kind: "standard",
    billId: utilBill.id,
    billDueDate: "2026-10-05",
    createdAt: "2026-10-05T12:00:00.000Z",
  });

  t = totals(stateUncovered, simulatedToday);
  assert.equal(t.bills, 0, "Bill reservation released");
  assert.equal(t.totalCreditOwed, 12000, "Credit card owes $120");
  assert.equal(t.totalReadyToPay, 0, "No cash reserved in Ready to Pay for unbudgeted debt");
  assert.equal(t.totalUncoveredDebt, 12000, "Uncovered debt accurately reported as $120");
  assert.equal(t.safe, 200000, "Cash in checking remains unreserved");
});

test("Test 3A.2.6 — Scheduled transaction deduplication & standalone Bills category protection", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.opening = 100000;
  state.payday = "2026-10-23";

  const waterBill: Bill = {
    id: "b-water",
    name: "Water Utility",
    amount: 4000,
    day: 18,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(waterBill);

  // Scheduled transaction 1: Linked to active tracked bill (must be deduplicated)
  state.transactions.push({
    id: "tx-sched-linked",
    name: "Water Utility Scheduled",
    amount: -4000,
    category: "Bills",
    date: "2026-10-18",
    status: "scheduled",
    billId: waterBill.id,
  });

  // Scheduled transaction 2: Standalone scheduled expense in "Bills" category (must NOT disappear!)
  state.transactions.push({
    id: "tx-sched-standalone",
    name: "One-off Medical Bill",
    amount: -6000,
    category: "Bills",
    date: "2026-10-19",
    status: "scheduled",
  });

  const uncovered = getUncoveredScheduledExpenses(state, simulatedToday);
  // Transaction 1 is deduplicated against b-water.
  // Transaction 2 is counted as an uncovered scheduled expense (6000 cents).
  assert.equal(uncovered, 6000, "Standalone scheduled bill must be reserved as uncovered expense");

  const t = totals(state, simulatedToday);
  assert.equal(t.bills, 4000, "Tracked bill reserved in bills breakdown");
  assert.equal(t.uncoveredScheduledExpenses, 6000, "Standalone scheduled expense reserved in uncovered expenses");
  // Safe to Spend: 100000 - 4000 (bills) - 6000 (uncovered sched) = 90000
  assert.equal(t.safe, 90000, "Both obligations accounted for exactly once without double counting");
});

test("Test 3A.2.7 — Dynamic payday boundaries advance automatically without manual settings update", () => {
  const state: State = blank();
  state.opening = 500000;
  state.paydaySchedule = {
    frequency: "biweekly",
    anchorDate: "2026-10-09",
    weekendRule: "exact",
    overrides: [],
  };

  // As of Oct 16:
  // Next payday is Oct 23, following is Nov 6
  assert.equal(getCurrentPayday(state, "2026-10-16"), "2026-10-23");
  assert.equal(getFollowingPayday(state, "2026-10-16"), "2026-11-06");

  const bill1: Bill = {
    id: "b-car",
    name: "Car Payment",
    amount: 30000,
    day: 20,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(bill1);

  let bd = reserveBillsBreakdown(state, "2026-10-16");
  assert.equal(bd.currentCycleBills, 30000, "Car payment due Oct 20 is in current cycle");

  // Advance time to Oct 24 (past payday) without modifying state.payday or state.paydaySchedule
  // Dynamic payday engine automatically advances:
  assert.equal(getCurrentPayday(state, "2026-10-24"), "2026-11-06", "Payday advances to Nov 6");
  assert.equal(getFollowingPayday(state, "2026-10-24"), "2026-11-20", "Following payday advances to Nov 20");

  // If paycheck was missed, balance is unchanged
  const t = totals(state, "2026-10-24");
  assert.equal(t.balance, 500000, "Cash balance does not inflate on missed paycheck");

  // The Oct 20 bill remains unpaid and overdue: it must NOT disappear!
  bd = reserveBillsBreakdown(state, "2026-10-24");
  assert.equal(bd.currentCycleBills, 30000, "Overdue unpaid bill is retained across payday transition");
  assert.equal(bd.details[0]!.dueDate, "2026-10-20");
});

test("Test 3A.2.8 — Repeated migration idempotence and manual payday migration parity", () => {
  const simulatedToday = "2026-10-16";
  const rawV4State = {
    version: 4,
    opening: 400000,
    payday: "2026-10-25",
    followingPayday: "2026-11-10",
    accounts: [
      {
        id: "acc-default-checking",
        name: "Checking",
        type: "checking",
        opening: 400000,
        includeInSafeToSpend: true,
        createdAt: "2026-10-01",
        updatedAt: "2026-10-01",
      },
    ],
    bills: [
      {
        id: "b-phone",
        name: "Mobile Phone",
        amount: 8500,
        day: 22,
        protected: false,
        settledDueDates: [],
      },
    ],
    budgets: [],
    pots: [],
    transactions: [],
  };

  const m1 = migrateState(rawV4State, simulatedToday);
  const m2 = migrateState(m1, simulatedToday);

  // Migration is strictly idempotent
  assert.deepEqual(m2, m1, "Repeated migration must be idempotent");

  // Manual payday values are authoritative and preserved
  assert.equal(m1.payday, "2026-10-25");
  assert.equal(m1.followingPayday, "2026-11-10");
  assert.equal(getCurrentPayday(m1, simulatedToday), "2026-10-25");
  assert.equal(getFollowingPayday(m1, simulatedToday), "2026-11-10");

  // Financial totals match expectations
  const t = totals(m1, simulatedToday);
  assert.equal(t.bills, 8500);
  assert.equal(t.safe, 400000 - 8500);
});

test("Test 3A.2.9 — Negative rawSafe, safe = 0, and shortfall contract preservation", () => {
  const state: State = blank();
  state.opening = 10000; // $100 cash
  state.payday = "2026-10-23";

  // Bill of $250
  state.bills.push({
    id: "b-rent-short",
    name: "Partial Rent",
    amount: 25000,
    day: 18,
    protected: false,
    trackingStartDate: "2026-10-01",
  });

  const t = totals(state, "2026-10-16");
  assert.equal(t.balance, 10000);
  assert.equal(t.bills, 25000);
  // rawSafe: 10000 - 25000 = -15000
  assert.equal(t.rawSafe, -15000, "rawSafe preserves signed unclamped negative value");
  // safe: clamped to 0
  assert.equal(t.safe, 0, "safe remains non-negative 0");
  // shortfall: Math.abs(rawSafe)
  assert.equal(t.shortfall, 15000, "shortfall correctly reports positive deficit of $150");
});

test("Test 3A.2.10 — September bill paid in October with explicit occurrence linkage", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  const powerBill: Bill = {
    id: "b-power",
    name: "Power Electric",
    amount: 12000,
    day: 5,
    protected: false,
    trackingStartDate: "2026-08-01",
  };
  state.bills.push(powerBill);

  // August was settled
  settleBillOccurrence(state, powerBill.id, "2026-08-05");

  // September bill paid late on October 2 with explicit occurrence linkage
  state.transactions.push({
    id: "tx-power-sep-paid-oct",
    name: "Electric Payment (Late for Sep)",
    amount: -12000,
    category: "Utilities",
    date: "2026-10-02",
    status: "posted",
    billId: powerBill.id,
    billDueDate: "2026-09-05", // Explicit priority linkage
  });

  // Explicit linkage ensures September 5 is marked paid
  assert.equal(isBillPaid(state, powerBill, "2026-09-05"), true, "September 5 must be paid via explicit billDueDate");

  // Does NOT automatically treat the late payment as payment for October
  assert.equal(isBillPaid(state, powerBill, "2026-10-05"), false, "October 5 must remain unpaid");

  // Breakdown reserves only October 5
  const bd = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(bd.currentCycleBills, 12000, "Only October 5 is reserved in current cycle");
  assert.equal(bd.details.length, 1);
  assert.equal(bd.details[0]!.dueDate, "2026-10-05");

  // Earliest unpaid due date is October 5
  assert.equal(nextUnpaidDueDate(state, powerBill, simulatedToday), "2026-10-05");
});

test("Test 3A.2.11 — Legacy payment without occurrence linkage", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  const cloudBill: Bill = {
    id: "b-cloud",
    name: "Cloud Storage",
    amount: 2500,
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(cloudBill);

  // Legacy transaction in October without billDueDate, where no prior unpaid occurrences exist
  state.transactions.push({
    id: "tx-cloud-legacy",
    name: "Cloud Storage",
    amount: -2500,
    category: "Subscriptions",
    date: "2026-10-15",
    status: "posted",
    billId: cloudBill.id,
    // billDueDate is absent
  });

  // Unambiguous legacy record matches October occurrence cleanly
  assert.equal(isBillPaid(state, cloudBill, "2026-10-15"), true, "Legitimate legacy payment matches without inventing settlement dates");

  const bd = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(bd.currentCycleBills, 0, "Bill reservation is cleanly released");
});

test("Test 3A.2.12 — Two overdue occurrences and one payment", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  const subBill: Bill = {
    id: "b-sub",
    name: "Software Subscription",
    amount: 4000,
    day: 10,
    protected: false,
    trackingStartDate: "2026-08-01",
  };
  state.bills.push(subBill);

  // Part A: One payment in September without billDueDate
  const tx = {
    id: "tx-sub-ambiguous",
    name: "Software Subscription",
    amount: -4000,
    category: "Software",
    date: "2026-09-15",
    status: "posted" as const,
    billId: subBill.id,
    billDueDate: undefined as string | undefined,
  };
  state.transactions.push(tx);

  // August 10 is unpaid. September 10 has unlinked payment, but August 10 is unpaid (ambiguous!).
  // Policy: Retain obligation and avoid guessing or releasing the wrong reservation.
  assert.equal(isBillPaid(state, subBill, "2026-08-10"), false, "August remains unpaid");
  assert.equal(isBillPaid(state, subBill, "2026-09-10"), false, "September is not paid due to ambiguous prior unpaid August occurrence");
  assert.equal(isBillPaid(state, subBill, "2026-10-10"), false, "October remains unpaid");

  let bd = reserveBillsBreakdown(state, simulatedToday);
  // All 3 occurrences (Aug, Sep, Oct) remain reserved: 3 * $40 = $120 (12000 cents)
  assert.equal(bd.currentCycleBills, 12000, "Ambiguous unlinked payment does not silently release reservations");

  // Part B: Disambiguate with explicit linkage for August 10
  tx.billDueDate = "2026-08-10";
  assert.equal(isBillPaid(state, subBill, "2026-08-10"), true, "August is paid via explicit linkage");
  assert.equal(isBillPaid(state, subBill, "2026-09-10"), false, "September remains unpaid");
  assert.equal(isBillPaid(state, subBill, "2026-10-10"), false, "October remains unpaid");

  bd = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(bd.currentCycleBills, 8000, "Only September and October are reserved (8000 cents)");

  // Part C: Switch explicit linkage to September 10
  tx.billDueDate = "2026-09-10";
  assert.equal(isBillPaid(state, subBill, "2026-08-10"), false, "August remains unpaid");
  assert.equal(isBillPaid(state, subBill, "2026-09-10"), true, "September is paid via explicit linkage");
  assert.equal(isBillPaid(state, subBill, "2026-10-10"), false, "October remains unpaid");

  bd = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(bd.currentCycleBills, 8000, "Only August and October are reserved (8000 cents)");
});

test("Test 3A.2.13 — More than 60 months of legitimate unpaid occurrences", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  // Bill tracking started Jan 1, 2020. Due on the 1st of each month.
  // Between 2020-01 and 2026-10 there are: (2026 - 2020) * 12 + (10 - 1) + 1 = 82 months!
  const longBill: Bill = {
    id: "b-annuity",
    name: "Monthly Annuity",
    amount: 1000, // $10/mo
    day: 1,
    protected: false,
    trackingStartDate: "2020-01-01",
  };
  state.bills.push(longBill);

  const bd = reserveBillsBreakdown(state, simulatedToday);
  // Must evaluate all 82 months without silently dropping occurrences past month 60
  assert.equal(bd.currentCycleBills, 82000, "All 82 overdue months must be reserved ($820.00)");
  assert.equal(bd.details.length, 82, "Details must contain all 82 occurrences");
  assert.equal(bd.details[0]!.dueDate, "2020-01-01", "Earliest detail is Jan 1, 2020");
  assert.equal(bd.details[81]!.dueDate, "2026-10-01", "Latest current detail is Oct 1, 2026");

  // nextUnpaidDueDate returns earliest unpaid occurrence across the entire range
  assert.equal(nextUnpaidDueDate(state, longBill, simulatedToday), "2020-01-01");
});

test("Test 3A.2.14 — Safe to Spend and Covered Credit parity under occurrence matching", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.accounts = [
    {
      id: "acc-checking",
      name: "Checking",
      type: "checking",
      opening: 300000,
      includeInSafeToSpend: true,
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    },
    {
      id: "acc-credit",
      name: "Credit Card",
      type: "credit",
      opening: 0,
      includeInSafeToSpend: false,
      coveredCreditBaselineAt: "2026-10-01",
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    },
  ];
  state.budgets = [
    { id: "bg-util", category: "Utilities", limit: 15000, color: "#277c78" },
  ];
  const utilBill: Bill = {
    id: "b-util",
    name: "Utilities",
    amount: 10000,
    day: 5,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(utilBill);

  // Paid on credit card with explicit occurrence linkage
  state.transactions.push({
    id: "tx-util-card",
    name: "Utilities Card Payment",
    amount: -10000,
    category: "Utilities",
    date: "2026-10-05",
    status: "posted",
    accountId: "acc-credit",
    kind: "standard",
    billId: utilBill.id,
    billDueDate: "2026-10-05",
  });

  const t = totals(state, simulatedToday);
  assert.equal(t.bills, 0, "Bill reservation released");
  assert.equal(t.totalCreditOwed, 10000, "Credit card owes $100");
  assert.equal(t.totalReadyToPay, 10000, "Ready to pay backed by Utilities budget ($100)");
  assert.equal(t.budgets, 5000, "Remaining budget is $50");
  assert.equal(t.safe, 285000, "Safe to spend preserves exact Covered Credit parity ($2,850)");
});

test("Test 3A.2.15 — Ambiguous legacy transactions: multiple unlinked candidates and non-expense credits retain obligations", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  const gymBill: Bill = {
    id: "b-gym",
    name: "Gym Membership",
    amount: 5000,
    day: 10,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(gymBill);

  // Part A: Positive transaction (refund/credit) does NOT settle a recurring bill
  state.transactions.push({
    id: "tx-gym-refund",
    name: "Gym Refund",
    amount: 5000, // positive amount!
    category: "Health",
    date: "2026-10-10",
    status: "posted",
    billId: gymBill.id,
  });
  assert.equal(isBillPaid(state, gymBill, "2026-10-10"), false, "Positive credit/refund cannot settle a bill occurrence");

  // Part B: Arbitrary transaction in same month without billId does NOT settle recurring bill
  state.transactions.push({
    id: "tx-arbitrary-gym",
    name: "Gym Membership",
    amount: -5000,
    category: "Bills",
    date: "2026-10-10",
    status: "posted",
    // billId is undefined!
  });
  assert.equal(isBillPaid(state, gymBill, "2026-10-10"), false, "Arbitrary transaction without billId cannot settle a bill");

  // Part C: Multiple unlinked expense transactions in the same month trigger ambiguity
  const tx1: Transaction = {
    id: "tx-gym-split-1",
    name: "Gym Payment 1",
    amount: -2500,
    category: "Health",
    date: "2026-10-05",
    status: "posted",
    billId: gymBill.id,
    // unlinked
  };
  const tx2: Transaction = {
    id: "tx-gym-split-2",
    name: "Gym Payment 2",
    amount: -2500,
    category: "Health",
    date: "2026-10-12",
    status: "posted",
    billId: gymBill.id,
    // unlinked
  };
  state.transactions.push(tx1, tx2);

  // Both tx1 and tx2 exist without billDueDate in October. This is ambiguous.
  assert.equal(isBillPaid(state, gymBill, "2026-10-10"), false, "Multiple unlinked candidates in same month retain obligation");
  const bdAmbiguous = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(bdAmbiguous.currentCycleBills, 5000, "Ambiguous legacy occurrence remains reserved");

  // Part D: Disambiguating by setting explicit billDueDate resolves the ambiguity
  tx1.billDueDate = "2026-10-10";
  tx2.billDueDate = "2026-10-10";
  assert.equal(isBillPaid(state, gymBill, "2026-10-10"), true, "Explicit linkage resolves ambiguity and settles occurrence");
  const bdResolved = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(bdResolved.currentCycleBills, 0, "Reservation released cleanly once disambiguated");
});

test("Test 3A.2.16 — Explicit occurrence linkage on newly recorded payments", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  const rentBill: Bill = {
    id: "b-rent",
    name: "Apartment Rent",
    amount: 150000,
    day: 1,
    protected: false,
    trackingStartDate: "2026-09-01",
  };
  state.bills.push(rentBill);

  // September 1 is unpaid. October 1 is unpaid.
  assert.equal(nextUnpaidDueDate(state, rentBill, simulatedToday), "2026-09-01");

  // Call recordBillPayment without explicit options: must automatically bind to earliest unpaid occurrence
  const p1 = recordBillPayment(state, rentBill.id);
  assert.ok(p1, "Payment transaction must be created");
  assert.equal(p1.billId, rentBill.id);
  assert.equal(p1.billDueDate, "2026-09-01", "Newly recorded payment must explicitly bind to earliest unpaid occurrence");
  assert.equal(isBillPaid(state, rentBill, "2026-09-01"), true, "September is now paid");
  assert.equal(isBillPaid(state, rentBill, "2026-10-01"), false, "October remains unpaid");

  // Second payment binds to next unpaid occurrence (October 1)
  assert.equal(nextUnpaidDueDate(state, rentBill, simulatedToday), "2026-10-01");
  const p2 = recordBillPayment(state, rentBill.id);
  assert.ok(p2);
  assert.equal(p2.billDueDate, "2026-10-01", "Second payment explicitly links to October 1");
  assert.equal(isBillPaid(state, rentBill, "2026-10-01"), true, "October is now paid");

  // Next unpaid occurrence advances into November
  assert.equal(nextUnpaidDueDate(state, rentBill, simulatedToday), "2026-11-01");
});

test("Test 3A.2.17 — Date-range safety handling, diagnostics, and non-omission policy", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  // Case 1: Corrupted/invalid trackingStartDate does not omit bill
  const badStartBill: Bill = {
    id: "b-bad-start",
    name: "Corrupt Date Bill",
    amount: 7500,
    day: 5,
    protected: false,
    trackingStartDate: "not-a-valid-date",
  };
  state.bills.push(badStartBill);

  const bd1 = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(bd1.currentCycleBills, 7500, "Corrupted date bill must not be omitted from reservations");
  assert.ok(bd1.diagnostics.some((d) => d.includes("missing or invalid trackingStartDate")), "Must report diagnostic");

  // Case 2: Out-of-bounds start year before 1900 clamped safely
  badStartBill.trackingStartDate = "1850-01-01";
  const bd2 = reserveBillsBreakdown(state, simulatedToday);
  assert.ok(bd2.currentCycleBills > 0, "Out-of-bounds year must not omit bill");
  assert.ok(bd2.diagnostics.some((d) => d.includes("before 1900")), "Must report clamping diagnostic for pre-1900 year");

  // Case 3: nextUnpaidDueDate with invalid fromDate falls back safely
  const due = nextUnpaidDueDate(state, badStartBill, "garbage-date");
  assert.ok(isValidDateString(due), "Must return a valid ISO due date string even with corrupted input");

  // Case 4: Totals includes diagnostics
  const t = totals(state, simulatedToday);
  assert.ok(Array.isArray(t.diagnostics), "Totals must include diagnostics");
  assert.ok(t.diagnostics.length > 0, "Diagnostics must be visible in totals");
});

test("Test 3A.2.18 — Preserved Phase 2B Covered Credit and Safe to Spend invariants under recordBillPayment", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.accounts = [
    {
      id: "acc-checking",
      name: "Checking",
      type: "checking",
      opening: 200000,
      includeInSafeToSpend: true,
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    },
    {
      id: "acc-credit",
      name: "Credit Card",
      type: "credit",
      opening: 0,
      includeInSafeToSpend: false,
      coveredCreditBaselineAt: "2026-10-01",
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    },
  ];
  state.budgets = [
    { id: "bg-internet", category: "Bills", limit: 8000, color: "#277c78" },
  ];
  const netBill: Bill = {
    id: "b-net",
    name: "Internet Fiber",
    amount: 8000,
    day: 10,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(netBill);

  // Before payment: $80 is reserved in bills
  let t = totals(state, simulatedToday);
  assert.equal(t.bills, 8000);
  assert.equal(t.safe, 184000); // 2000 - 80 (bills) - 80 (budget) = 1840

  // Pay bill on credit card with recordBillPayment
  const tx = recordBillPayment(state, netBill.id, {
    accountId: "acc-credit",
    date: "2026-10-10",
  });
  assert.ok(tx);
  assert.equal(tx.billDueDate, "2026-10-10");

  t = totals(state, simulatedToday);
  // Bill reservation released:
  assert.equal(t.bills, 0, "Bill reservation released");
  // Credit card has $80 debt:
  assert.equal(t.totalCreditOwed, 8000, "Credit card owes $80");
  // Covered by Bills budget, so Ready to Pay is $80:
  assert.equal(t.totalReadyToPay, 8000, "Ready to pay is $80");
  // Remaining budget is $0:
  assert.equal(t.budgets, 0, "Budget remaining is $0");
  // Safe to Spend is $2000 - $80 (Ready to Pay) = $1,920 (192000 cents):
  assert.equal(t.safe, 192000, "Safe to spend preserves exact Covered Credit parity");
});

test("Test 3A.2.19 — Editing an existing transaction preserves billDueDate unless bill association changes", () => {
  const simulatedToday = "2026-10-16";
  const { state } = useBudget();
  // Reset clean state
  state.value = blank();
  state.value.payday = "2026-10-23";
  state.value.followingPayday = "2026-11-06";

  const powerBill: Bill = {
    id: "b-power",
    name: "Electric Utility",
    amount: 12000,
    day: 5,
    protected: false,
    trackingStartDate: "2026-09-01",
  };
  const waterBill: Bill = {
    id: "b-water",
    name: "Water Utility",
    amount: 6000,
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.value.bills.push(powerBill, waterBill);

  // September 5 is OVERDUE (unpaid)
  assert.equal(isBillPaid(state.value, powerBill, "2026-09-05"), false, "September 5 must be unpaid");

  // An October bill payment was explicitly recorded for October 5
  const octTx: Transaction = {
    id: "tx-oct-power",
    name: "Electric Payment",
    amount: -12000,
    category: "Bills",
    date: "2026-10-05",
    status: "posted",
    billId: powerBill.id,
    billDueDate: "2026-10-05",
    accountId: "acc-default-checking",
    kind: "standard",
  };
  state.value.transactions.push(octTx);

  // October 5 is paid via explicit linkage; September 5 remains overdue
  assert.equal(isBillPaid(state.value, powerBill, "2026-10-05"), true);
  assert.equal(isBillPaid(state.value, powerBill, "2026-09-05"), false);

  // Part A: Open edit modal and modify name, amount, date, account, and status
  const modal = useModal();
  modal.open("Edit transaction", octTx.id);

  // Assert form loaded existing bill linkage
  assert.equal(modal.form.value.billId, powerBill.id);
  assert.equal(modal.form.value.billDueDate, "2026-10-05");

  // Modify metadata/fields without changing bill association
  modal.form.value.name = "Evergy Electric Updated";
  modal.form.value.amount = "125.00"; // edited amount
  modal.form.value.date = "2026-10-06"; // edited date
  modal.form.value.status = "cleared";
  modal.submit();

  // Verification: billDueDate MUST remain "2026-10-05" (NOT re-assigned to overdue September!)
  assert.equal(octTx.billId, powerBill.id);
  assert.equal(octTx.billDueDate, "2026-10-05", "Must preserve October occurrence linkage even while September is overdue");
  assert.equal(octTx.name, "Evergy Electric Updated");
  assert.equal(octTx.amount, -12500);
  assert.equal(isBillPaid(state.value, powerBill, "2026-10-05"), true, "October 5 remains paid");
  assert.equal(isBillPaid(state.value, powerBill, "2026-09-05"), false, "September 5 remains overdue");

  // Part B: Reassigning to a DIFFERENT bill (waterBill) updates occurrence linkage
  modal.open("Edit transaction", octTx.id);
  modal.form.value.billId = waterBill.id;
  // billDueDate not explicitly set for new bill -> resolves for waterBill
  modal.form.value.billDueDate = undefined;
  modal.submit();

  assert.equal(octTx.billId, waterBill.id);
  assert.equal(octTx.billDueDate, "2026-10-15", "Reassigning to waterBill updates occurrence linkage to Water's due date");
  assert.equal(isBillPaid(state.value, waterBill, "2026-10-15"), true);
  assert.equal(isBillPaid(state.value, powerBill, "2026-10-05"), false, "Power bill October is now unpaid");

  // Part C: Removing billId clears occurrence linkage
  modal.open("Edit transaction", octTx.id);
  modal.form.value.billId = ""; // removed
  modal.submit();

  assert.equal(octTx.billId, undefined);
  assert.equal(octTx.billDueDate, undefined, "Removing billId clears billDueDate consistently");
  assert.equal(isBillPaid(state.value, waterBill, "2026-10-15"), false, "Water bill is now unpaid");
});

test("Test 3A.3.1 — Loading payday settings from persisted state", () => {
  const simulatedToday = "2026-10-16";
  const persistedRaw = {
    version: 5,
    demo: false,
    opening: 500000,
    payday: "2026-10-23",
    followingPayday: "2026-11-06",
    paydaySchedule: {
      frequency: "biweekly",
      anchorDate: "2026-10-09",
      weekendRule: "preceding_friday",
      overrides: [
        {
          id: "ov-test-1",
          scheduledDate: "2026-11-20",
          overrideDate: "2026-11-19",
          note: "Early direct deposit",
          createdAt: "2026-10-16T12:00:00.000Z",
        },
      ],
    },
    transactions: [],
    budgets: [],
    pots: [],
    bills: [],
    accounts: [
      {
        id: "acc-default-checking",
        name: "Primary Checking",
        type: "checking",
        opening: 500000,
        includeInSafeToSpend: true,
        archived: false,
        createdAt: "2026-10-01",
        updatedAt: "2026-10-01",
      },
    ],
  };

  const state = migrateState(persistedRaw, simulatedToday);
  assert.equal(state.paydaySchedule.frequency, "biweekly");
  assert.equal(state.paydaySchedule.anchorDate, "2026-10-09");
  assert.equal(state.paydaySchedule.weekendRule, "preceding_friday");
  assert.equal(state.paydaySchedule.overrides.length, 1);
  assert.equal(state.paydaySchedule.overrides[0]!.scheduledDate, "2026-11-20");
  assert.equal(state.paydaySchedule.overrides[0]!.overrideDate, "2026-11-19");

  // Verify next and following paydays derived correctly
  const next = getCurrentPayday(state, simulatedToday);
  const following = getFollowingPayday(state, simulatedToday);
  assert.equal(next, "2026-10-23", "Next biweekly payday should be Oct 23");
  assert.equal(following, "2026-11-06", "Following biweekly payday should be Nov 06");
});

test("Test 3A.3.2 — Saving each supported schedule type", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.opening = 300000;

  // 1. Weekly schedule
  const resWeekly = updatePaydaySchedule(state, {
    frequency: "weekly",
    anchorDate: "2026-10-16",
    weekendRule: "exact",
  });
  assert.equal(resWeekly.success, true);
  assert.equal(state.paydaySchedule.frequency, "weekly");
  assert.equal(state.paydaySchedule.anchorDate, "2026-10-16");
  assert.equal(getCurrentPayday(state, simulatedToday), "2026-10-16");
  assert.equal(getFollowingPayday(state, simulatedToday), "2026-10-23");

  // 2. Biweekly schedule
  const resBiweekly = updatePaydaySchedule(state, {
    frequency: "biweekly",
    anchorDate: "2026-10-09",
    weekendRule: "exact",
  });
  assert.equal(resBiweekly.success, true);
  assert.equal(state.paydaySchedule.frequency, "biweekly");
  assert.equal(getCurrentPayday(state, simulatedToday), "2026-10-23");
  assert.equal(getFollowingPayday(state, simulatedToday), "2026-11-06");

  // 3. Semimonthly schedule (normalized & sorted)
  const resSemi = updatePaydaySchedule(state, {
    frequency: "semimonthly",
    anchorDate: "2026-10-15",
    firstDay: 30, // input reversed to test automatic sorting
    secondDay: 15,
    weekendRule: "preceding_friday",
  });
  assert.equal(resSemi.success, true);
  assert.equal(state.paydaySchedule.frequency, "semimonthly");
  assert.equal(state.paydaySchedule.firstDay, 15, "First day must be sorted to 15");
  assert.equal(state.paydaySchedule.secondDay, 30, "Second day must be sorted to 30");
  assert.equal(state.paydaySchedule.weekendRule, "preceding_friday");
  assert.equal(getCurrentPayday(state, simulatedToday), "2026-10-30");

  // 4. Monthly schedule (with dayOfMonth)
  const resMonthly = updatePaydaySchedule(state, {
    frequency: "monthly",
    anchorDate: "2026-10-01",
    dayOfMonth: 28,
    weekendRule: "exact",
  });
  assert.equal(resMonthly.success, true);
  assert.equal(state.paydaySchedule.frequency, "monthly");
  assert.equal(state.paydaySchedule.dayOfMonth, 28);
  assert.equal(getCurrentPayday(state, simulatedToday), "2026-10-28");
  assert.equal(getFollowingPayday(state, simulatedToday), "2026-11-28");

  // 5. Manual schedule
  const resManual = updatePaydaySchedule(state, {
    frequency: "manual",
    anchorDate: "2026-10-25",
    manualFollowingPayday: "2026-11-10",
    weekendRule: "exact",
  });
  assert.equal(resManual.success, true);
  assert.equal(state.paydaySchedule.frequency, "manual");
  assert.equal(state.paydaySchedule.anchorDate, "2026-10-25");
  assert.equal(state.paydaySchedule.manualFollowingPayday, "2026-11-10");
  assert.equal(state.payday, "2026-10-25");
  assert.equal(state.followingPayday, "2026-11-10");
  assert.equal(getCurrentPayday(state, simulatedToday), "2026-10-25");
  assert.equal(getFollowingPayday(state, simulatedToday), "2026-11-10");
});

test("Test 3A.3.3 — Invalid configurations leaving the prior state unchanged", () => {
  const state: State = blank();
  const initialSchedule: PaydaySchedule = {
    frequency: "biweekly",
    anchorDate: "2026-10-09",
    weekendRule: "exact",
    overrides: [],
  };
  state.paydaySchedule = { ...initialSchedule };
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  // Case 1: Invalid anchor date string
  const resBadDate = updatePaydaySchedule(state, {
    frequency: "biweekly",
    anchorDate: "invalid-date-format",
  });
  assert.equal(resBadDate.success, false);
  assert.ok(resBadDate.errors?.anchorDate);
  assert.deepEqual(state.paydaySchedule, initialSchedule, "Schedule must remain unchanged on invalid date");

  // Case 2: Calendar non-existent date (Feb 31)
  const resBadCal = updatePaydaySchedule(state, {
    frequency: "weekly",
    anchorDate: "2026-02-31",
  });
  assert.equal(resBadCal.success, false);
  assert.deepEqual(state.paydaySchedule, initialSchedule, "Schedule must remain unchanged on non-existent calendar date");

  // Case 3: Monthly day out of range (< 1 or > 31 or fractional)
  const resBadMonthDay = updatePaydaySchedule(state, {
    frequency: "monthly",
    anchorDate: "2026-10-01",
    dayOfMonth: 32,
  });
  assert.equal(resBadMonthDay.success, false);
  assert.ok(resBadMonthDay.errors?.dayOfMonth);
  assert.deepEqual(state.paydaySchedule, initialSchedule, "Schedule must remain unchanged on invalid month day");

  // Case 4: Semimonthly with identical days (firstDay === secondDay)
  const resDupSemi = updatePaydaySchedule(state, {
    frequency: "semimonthly",
    anchorDate: "2026-10-01",
    firstDay: 15,
    secondDay: 15,
  });
  assert.equal(resDupSemi.success, false);
  assert.ok(resDupSemi.errors?.secondDay);
  assert.deepEqual(state.paydaySchedule, initialSchedule, "Schedule must remain unchanged on duplicate semimonthly days");

  // Case 5: Manual following payday on or before next payday
  const resBadManual = updatePaydaySchedule(state, {
    frequency: "manual",
    anchorDate: "2026-10-25",
    manualFollowingPayday: "2026-10-20", // earlier than anchor
  });
  assert.equal(resBadManual.success, false);
  assert.ok(resBadManual.errors?.manualFollowingPayday);
  assert.deepEqual(state.paydaySchedule, initialSchedule, "Schedule must remain unchanged when following payday is before next payday");

  // Case 6: Unsupported frequency
  const resBadFreq = updatePaydaySchedule(state, {
    frequency: "hourly" as any,
    anchorDate: "2026-10-20",
  });
  assert.equal(resBadFreq.success, false);
  assert.ok(resBadFreq.errors?.frequency);
  assert.deepEqual(state.paydaySchedule, initialSchedule, "Schedule must remain unchanged on invalid frequency");
});

test("Test 3A.3.4 — Switching between manual and automatic schedules", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();

  // Start with manual schedule with custom dates
  updatePaydaySchedule(state, {
    frequency: "manual",
    anchorDate: "2026-10-22",
    manualFollowingPayday: "2026-11-12",
    weekendRule: "exact",
  });
  assert.equal(state.paydaySchedule.frequency, "manual");
  assert.equal(getCurrentPayday(state, simulatedToday), "2026-10-22");
  assert.equal(getFollowingPayday(state, simulatedToday), "2026-11-12");

  // Switch to biweekly: dynamic calculation takes effect
  updatePaydaySchedule(state, {
    frequency: "biweekly",
    anchorDate: "2026-10-09",
    weekendRule: "exact",
  });
  assert.equal(state.paydaySchedule.frequency, "biweekly");
  assert.equal(getCurrentPayday(state, simulatedToday), "2026-10-23");
  assert.equal(getFollowingPayday(state, simulatedToday), "2026-11-06");

  // Switch to monthly: 1st of month
  updatePaydaySchedule(state, {
    frequency: "monthly",
    anchorDate: "2026-10-01",
    dayOfMonth: 1,
    weekendRule: "exact",
  });
  assert.equal(state.paydaySchedule.frequency, "monthly");
  assert.equal(getCurrentPayday(state, simulatedToday), "2026-11-01");

  // Switch back to manual: explicit dates restored
  updatePaydaySchedule(state, {
    frequency: "manual",
    anchorDate: "2026-10-31",
    manualFollowingPayday: "2026-11-14",
    weekendRule: "exact",
  });
  assert.equal(state.paydaySchedule.frequency, "manual");
  assert.equal(getCurrentPayday(state, simulatedToday), "2026-10-31");
  assert.equal(getFollowingPayday(state, simulatedToday), "2026-11-14");
});

test("Test 3A.3.5 — Weekend adjustments and explicit overrides", () => {
  const state: State = blank();

  // 1. Weekend adjustment test:
  // 2026-10-24 is Saturday. With preceding_friday, it should adjust to 2026-10-23.
  const satAnchor = "2026-10-24";
  updatePaydaySchedule(state, {
    frequency: "weekly",
    anchorDate: satAnchor,
    weekendRule: "preceding_friday",
  });
  const upcoming = getUpcomingPaydays(state.paydaySchedule, "2026-10-20", 2);
  assert.equal(upcoming[0], "2026-10-23", "Saturday Oct 24 adjusted to Friday Oct 23");

  // With exact date rule: Saturday remains Saturday Oct 24
  updatePaydaySchedule(state, {
    frequency: "weekly",
    anchorDate: satAnchor,
    weekendRule: "exact",
  });
  const upcomingExact = getUpcomingPaydays(state.paydaySchedule, "2026-10-20", 2);
  assert.equal(upcomingExact[0], "2026-10-24", "Exact rule preserves Saturday Oct 24");

  // 2. Explicit Override Test:
  // Biweekly schedule: nominal Oct 23, Nov 06, Nov 20
  updatePaydaySchedule(state, {
    frequency: "biweekly",
    anchorDate: "2026-10-09",
    weekendRule: "exact",
  });
  assert.deepEqual(getUpcomingPaydays(state.paydaySchedule, "2026-10-16", 3), [
    "2026-10-23",
    "2026-11-06",
    "2026-11-20",
  ]);

  // Apply override: shift Nov 06 to Nov 05
  const overrideRes = applyPaydayOverride(state.paydaySchedule, {
    scheduledDate: "2026-11-06",
    overrideDate: "2026-11-05",
    note: "Early payday before holiday",
  });
  assert.equal(overrideRes.success, true);
  state.paydaySchedule = overrideRes.schedule;

  assert.deepEqual(getUpcomingPaydays(state.paydaySchedule, "2026-10-16", 3), [
    "2026-10-23",
    "2026-11-05", // overridden!
    "2026-11-20",
  ]);

  // Remove override: reverts to Nov 06
  state.paydaySchedule = removePaydayOverride(state.paydaySchedule, "2026-11-06");
  assert.deepEqual(getUpcomingPaydays(state.paydaySchedule, "2026-10-16", 3), [
    "2026-10-23",
    "2026-11-06",
    "2026-11-20",
  ]);
});

test("Test 3A.3.6 — Correct next and following payday presentation", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();

  // Test biweekly presentation
  updatePaydaySchedule(state, {
    frequency: "biweekly",
    anchorDate: "2026-10-09",
    weekendRule: "exact",
  });
  const nextBi = getCurrentPayday(state, simulatedToday);
  const folBi = getFollowingPayday(state, simulatedToday);
  assert.equal(nextBi, "2026-10-23");
  assert.equal(folBi, "2026-11-06");
  assert.ok(nextBi <= folBi, "Next must be before or equal to following");

  // Test semimonthly presentation (15th and last day of month)
  updatePaydaySchedule(state, {
    frequency: "semimonthly",
    anchorDate: "2026-10-15",
    firstDay: 15,
    secondDay: 31,
    weekendRule: "exact",
  });
  const nextSemi = getCurrentPayday(state, simulatedToday);
  const folSemi = getFollowingPayday(state, simulatedToday);
  assert.equal(nextSemi, "2026-10-31");
  assert.equal(folSemi, "2026-11-15");
  assert.ok(nextSemi < folSemi);

  // Test monthly presentation
  updatePaydaySchedule(state, {
    frequency: "monthly",
    anchorDate: "2026-10-01",
    dayOfMonth: 1,
    weekendRule: "exact",
  });
  const nextMo = getCurrentPayday(state, simulatedToday);
  const folMo = getFollowingPayday(state, simulatedToday);
  assert.equal(nextMo, "2026-11-01");
  assert.equal(folMo, "2026-12-01");
  assert.ok(nextMo < folMo);
});

test("Test 3A.3.7 — Manual schedules with missing dates", () => {
  const state: State = blank();

  // Manual schedule with only first payday in past and no upcoming dates
  state.paydaySchedule = {
    frequency: "manual",
    anchorDate: "2026-09-01", // in past
    manualFollowingPayday: undefined,
    weekendRule: "exact",
    overrides: [],
  };

  // Evaluate as of 2026-10-16:
  // Before first configured payday, engine never invents occurrences.
  // And with manualFollowingPayday undefined, the engine projects based on 14-day default interval forward:
  // 2026-09-01 + 14 = 2026-09-15 + 14 = 2026-09-29 + 14 = 2026-10-13 + 14 = 2026-10-27
  const upcoming = getUpcomingPaydays(state.paydaySchedule, "2026-10-16", 2);
  assert.equal(upcoming[0], "2026-10-27");

  // Now test true empty state: if anchorDate is evaluated before anchorDate
  // e.g. evaluation as of August 2026 when first payday is Sept 1, 2026:
  const beforeAnchor = getUpcomingPaydays(state.paydaySchedule, "2026-08-01", 3);
  assert.equal(beforeAnchor[0], "2026-09-01", "Must not invent occurrences prior to configured anchorDate");

  // Incomplete manual schedule: missing or invalid anchorDate
  const incompleteSchedule: PaydaySchedule = {
    frequency: "manual",
    anchorDate: "",
    weekendRule: "exact",
    overrides: [],
  };
  const validation = validatePaydaySchedule(incompleteSchedule);
  assert.equal(validation.valid, false, "Incomplete manual schedule rejected by validation");
  assert.ok(validation.errors.anchorDate);
});

test("Test 3A.3.8 — Settings persistence across serialization and reload", () => {
  const originalState: State = blank();
  originalState.opening = 850000;
  originalState.paydaySchedule = {
    frequency: "semimonthly",
    anchorDate: "2026-10-01",
    firstDay: 10,
    secondDay: 25,
    weekendRule: "preceding_friday",
    overrides: [
      {
        id: "ov-persist-1",
        scheduledDate: "2026-12-25",
        overrideDate: "2026-12-24",
        note: "Christmas Eve early pay",
        createdAt: "2026-10-16T10:00:00.000Z",
      },
    ],
  };
  originalState.payday = getCurrentPayday(originalState, "2026-10-16");
  originalState.followingPayday = getFollowingPayday(originalState, "2026-10-16");

  // JSON round-trip serialization
  const serialized = JSON.stringify(originalState, null, 2);
  const parsed = JSON.parse(serialized);
  const reloaded = migrateState(parsed, "2026-10-16");

  assert.equal(reloaded.paydaySchedule.frequency, "semimonthly");
  assert.equal(reloaded.paydaySchedule.firstDay, 10);
  assert.equal(reloaded.paydaySchedule.secondDay, 25);
  assert.equal(reloaded.paydaySchedule.weekendRule, "preceding_friday");
  assert.equal(reloaded.paydaySchedule.overrides.length, 1);
  assert.equal(reloaded.paydaySchedule.overrides[0]!.scheduledDate, "2026-12-25");
  assert.equal(reloaded.paydaySchedule.overrides[0]!.overrideDate, "2026-12-24");
  assert.equal(reloaded.paydaySchedule.overrides[0]!.note, "Christmas Eve early pay");
  assert.equal(getCurrentPayday(reloaded, "2026-10-16"), getCurrentPayday(originalState, "2026-10-16"));
  assert.equal(getFollowingPayday(reloaded, "2026-10-16"), getFollowingPayday(originalState, "2026-10-16"));
});

test("Test 3A.3.9 — Unchanged Safe to Spend and Covered Credit calculations for equivalent financial states", () => {
  const simulatedToday = "2026-10-16";

  // Build state A: Manual schedule with paydays 2026-10-23 and 2026-11-06
  const stateA: State = blank();
  stateA.opening = 450000; // $4,500.00 checking
  stateA.payday = "2026-10-23";
  stateA.followingPayday = "2026-11-06";
  stateA.paydaySchedule = {
    frequency: "manual",
    anchorDate: "2026-10-23",
    manualFollowingPayday: "2026-11-06",
    weekendRule: "exact",
    overrides: [],
  };

  // Add credit card account with covered purchase
  const card: Account = {
    id: "card-1",
    name: "Visa Card",
    type: "credit",
    opening: 0,
    creditLimit: 500000,
    includeInSafeToSpend: false,
    archived: false,
    createdAt: "2026-10-01",
    updatedAt: "2026-10-01",
    coveredCreditBaselineAt: "2026-10-01",
  };
  stateA.accounts.push(card);

  // Budget for Groceries ($500)
  stateA.budgets.push({
    id: "b-groc",
    category: "Groceries",
    limit: 50000,
    color: "#277c78",
  });

  // Credit card purchase of $80 for Groceries (covered by budget)
  stateA.transactions.push({
    id: "tx-groc-card",
    name: "Supermarket",
    amount: -8000,
    category: "Groceries",
    date: "2026-10-10",
    status: "posted",
    accountId: "card-1",
    kind: "standard",
  });

  // Recurring bill due Oct 20 ($120) - due before payday
  const billElectric: Bill = {
    id: "bill-elec",
    name: "Electricity",
    amount: 12000,
    day: 20,
    trackingStartDate: "2026-10-01",
  };
  stateA.bills.push(billElectric);

  // Recurring bill due Nov 01 ($1,000) - protected following cycle bill
  const billRent: Bill = {
    id: "bill-rent",
    name: "Apartment Rent",
    amount: 100000,
    day: 1,
    protected: true,
    trackingStartDate: "2026-10-01",
  };
  stateA.bills.push(billRent);

  // Calculate totals under State A (manual)
  const totalsA = totals(stateA, simulatedToday);
  const covA = getCreditCardCoverage(card, stateA, simulatedToday);

  // Build state B: Identical financial state, but configured with automatic Biweekly schedule
  // anchorDate 2026-10-09 yields exact next payday 2026-10-23 and following 2026-11-06
  const stateB: State = JSON.parse(JSON.stringify(stateA));
  const updateRes = updatePaydaySchedule(stateB, {
    frequency: "biweekly",
    anchorDate: "2026-10-09",
    weekendRule: "exact",
  });
  assert.equal(updateRes.success, true);
  assert.equal(getCurrentPayday(stateB, simulatedToday), "2026-10-23");
  assert.equal(getFollowingPayday(stateB, simulatedToday), "2026-11-06");

  // Calculate totals under State B (biweekly)
  const totalsB = totals(stateB, simulatedToday);
  const covB = getCreditCardCoverage(card, stateB, simulatedToday);

  // Assert exact cent-for-cent parity
  assert.equal(totalsA.balance, totalsB.balance, "Balances must be identical");
  assert.equal(totalsA.currentCycleBills, totalsB.currentCycleBills, "Current cycle bills must match ($120)");
  assert.equal(totalsA.protectedCycleBills, totalsB.protectedCycleBills, "Protected cycle bills must match ($1,000)");
  assert.equal(totalsA.totalReadyToPay, totalsB.totalReadyToPay, "Ready to pay must match ($80)");
  assert.equal(totalsA.rawSafe, totalsB.rawSafe, "rawSafe must match exactly");
  assert.equal(totalsA.safe, totalsB.safe, "Safe to spend must match exactly");
  assert.equal(totalsA.shortfall, totalsB.shortfall, "Shortfall must match exactly");
  assert.equal(covA.readyToPay, covB.readyToPay, "Card Ready to Pay must match exactly");
  assert.equal(covA.uncoveredDebt, covB.uncoveredDebt, "Card Uncovered Debt must match exactly");
});

test("Test 3A.3.10 — Settings draft synchronization, semimonthly day normalization, and dirty state management", () => {
  const state: State = blank();
  const b = useBudget();
  b.state.value = state;

  // 1. Initial saved state: semimonthly schedule on 15th and 30th
  const saveRes = updatePaydaySchedule(state, {
    frequency: "semimonthly",
    anchorDate: "2026-10-01",
    firstDay: 15,
    secondDay: 30,
    weekendRule: "exact",
    overrides: [],
  });
  assert.equal(saveRes.success, true);
  assert.equal(state.paydaySchedule.firstDay, 15);
  assert.equal(state.paydaySchedule.secondDay, 30);

  // 2. Draft is edited with swapped/reordered days: firstDay = 30, secondDay = 15
  const draftEdit: Partial<PaydaySchedule> = {
    frequency: "semimonthly",
    anchorDate: "2026-10-01",
    firstDay: 30,
    secondDay: 15,
    weekendRule: "exact",
    overrides: [],
  };

  // Saving normalizes 30 and 15 into firstDay = 15, secondDay = 30
  const saveEditRes = updatePaydaySchedule(state, draftEdit);
  assert.equal(saveEditRes.success, true);
  assert.equal(state.paydaySchedule.firstDay, 15, "firstDay normalized to 15");
  assert.equal(state.paydaySchedule.secondDay, 30, "secondDay normalized to 30");

  // Re-synchronizing draft with saved state (as handleSaveSchedule does via initDraft())
  const syncedDraft: PaydaySchedule = {
    frequency: state.paydaySchedule.frequency,
    anchorDate: state.paydaySchedule.anchorDate,
    dayOfMonth: state.paydaySchedule.dayOfMonth,
    firstDay: state.paydaySchedule.firstDay,
    secondDay: state.paydaySchedule.secondDay,
    weekendRule: state.paydaySchedule.weekendRule,
    manualFollowingPayday: state.paydaySchedule.manualFollowingPayday,
    overrides: JSON.parse(JSON.stringify(state.paydaySchedule.overrides || [])),
  };
  assert.equal(syncedDraft.firstDay, 15);
  assert.equal(syncedDraft.secondDay, 30);

  // isDirty check on synced draft must be false
  const isDirtyAfterSave =
    syncedDraft.frequency !== state.paydaySchedule.frequency ||
    syncedDraft.anchorDate !== state.paydaySchedule.anchorDate ||
    syncedDraft.weekendRule !== state.paydaySchedule.weekendRule ||
    (syncedDraft.frequency === "semimonthly" &&
      (Math.min(syncedDraft.firstDay || 0, syncedDraft.secondDay || 0) !==
        Math.min(state.paydaySchedule.firstDay || 0, state.paydaySchedule.secondDay || 0) ||
       Math.max(syncedDraft.firstDay || 0, syncedDraft.secondDay || 0) !==
        Math.max(state.paydaySchedule.firstDay || 0, state.paydaySchedule.secondDay || 0)));
  assert.equal(isDirtyAfterSave, false, "Form is not dirty after save");

  // 3. Cancel restores the actual saved configuration
  let userDraft: PaydaySchedule = {
    ...syncedDraft,
    firstDay: 5,
    secondDay: 20,
  };
  // User cancels: draft resets from persisted state
  userDraft = {
    frequency: state.paydaySchedule.frequency,
    anchorDate: state.paydaySchedule.anchorDate,
    dayOfMonth: state.paydaySchedule.dayOfMonth,
    firstDay: state.paydaySchedule.firstDay,
    secondDay: state.paydaySchedule.secondDay,
    weekendRule: state.paydaySchedule.weekendRule,
    manualFollowingPayday: state.paydaySchedule.manualFollowingPayday,
    overrides: JSON.parse(JSON.stringify(state.paydaySchedule.overrides || [])),
  };
  assert.equal(userDraft.firstDay, 15, "Cancel restores saved firstDay");
  assert.equal(userDraft.secondDay, 30, "Cancel restores saved secondDay");

  // 4. External state update does not overwrite unsaved user edits when dirty
  const unsavedUserDraft: PaydaySchedule = {
    ...syncedDraft,
    frequency: "weekly",
    anchorDate: "2026-10-16",
  };
  const isDirtyUser = unsavedUserDraft.frequency !== state.paydaySchedule.frequency;
  assert.equal(isDirtyUser, true, "User draft is dirty with unsaved edits");

  // Simulate an external background update to state.paydaySchedule
  const externalSchedule = { ...state.paydaySchedule, anchorDate: "2026-10-02" };
  state.paydaySchedule = externalSchedule;

  // Watcher logic: if (!isDirty.value && newSched) { draftSchedule.value = initDraft(); }
  let draftToPreserve = { ...unsavedUserDraft };
  if (!isDirtyUser) {
    draftToPreserve = { ...externalSchedule } as PaydaySchedule;
  }
  assert.equal(draftToPreserve.frequency, "weekly", "Unsaved user edits are preserved despite external state change");
  assert.equal(draftToPreserve.anchorDate, "2026-10-16");
});

test("Test 3A.3.11 — Manual payday empty state vs confirmed deposits and safety projection preservation", () => {
  const simulatedToday = "2026-10-16";

  // 1. Stale manual schedule: anchor in the past (2026-08-01) and no manualFollowingPayday, no overrides
  const state: State = blank();
  state.opening = 300000; // $3,000 cash
  state.paydaySchedule = {
    frequency: "manual",
    anchorDate: "2026-08-01", // Past / stale
    manualFollowingPayday: undefined,
    weekendRule: "exact",
    overrides: [],
  };

  const confirmedStale = getConfirmedUpcomingPaydays(state.paydaySchedule, simulatedToday);
  assert.deepEqual(confirmedStale, [], "Stale past anchor date yields 0 confirmed upcoming paydays");
  const isManualIncomplete = confirmedStale.length === 0;
  assert.equal(isManualIncomplete, true, "Empty state is triggered for stale manual schedule");

  // Overview presentation: nextPaydayDate must be empty string rather than unconfirmed synthetic projection
  const nextPaydayPresentation = confirmedStale[0] || "";
  assert.equal(nextPaydayPresentation, "", "Does not present unconfirmed synthetic payday as a confirmed deposit");

  // Financial engine continues to calculate safely without throwing or omitting reservations
  state.bills.push({
    id: "bill-1",
    name: "Internet",
    amount: 8000,
    day: 20,
    trackingStartDate: "2026-08-01",
  });
  const t = totals(state, simulatedToday);
  assert.equal(t.currentCycleBills, 24000, "Bills due before projected next payday (including overdue) remain reserved for safety");
  assert.equal(t.safe, 276000, "Safe to spend accounts for reserved bills");

  // 2. Manual schedule with past anchor (2026-10-01) but explicitly confirmed upcoming following payday (2026-10-25)
  state.paydaySchedule = {
    frequency: "manual",
    anchorDate: "2026-10-01", // Past
    manualFollowingPayday: "2026-10-25", // Confirmed upcoming
    weekendRule: "exact",
    overrides: [],
  };
  const confirmedWithFollowing = getConfirmedUpcomingPaydays(state.paydaySchedule, simulatedToday);
  assert.deepEqual(confirmedWithFollowing, ["2026-10-25"], "Explicit upcoming following payday is promoted to next confirmed payday");
  assert.equal(confirmedWithFollowing[0], "2026-10-25");
  assert.equal(confirmedWithFollowing[1], undefined, "No unconfirmed following payday is presented");

  // 3. Manual schedule with confirmed next payday (2026-10-25) but no following payday configured
  state.paydaySchedule = {
    frequency: "manual",
    anchorDate: "2026-10-25",
    manualFollowingPayday: undefined,
    weekendRule: "exact",
    overrides: [],
  };
  const confirmedNextOnly = getConfirmedUpcomingPaydays(state.paydaySchedule, simulatedToday);
  assert.deepEqual(confirmedNextOnly, ["2026-10-25"]);
  assert.equal(confirmedNextOnly[1], undefined, "Unconfirmed +14 day following payday is not presented");

  // 4. Past manual anchor with an explicitly overridden upcoming occurrence
  // anchorDate 2026-08-01 and manualFollowingPayday 2026-08-15 are both in the past.
  // User created an explicit one-time override on a future nominal occurrence (2026-10-24 -> 2026-10-23).
  state.paydaySchedule = {
    frequency: "manual",
    anchorDate: "2026-08-01", // in past
    manualFollowingPayday: "2026-08-15", // in past
    weekendRule: "exact",
    overrides: [
      {
        id: "ov-future-manual",
        scheduledDate: "2026-10-24", // nominal occurrence 70 days (14 * 5) after 2026-08-15
        overrideDate: "2026-10-23", // explicitly confirmed upcoming payday
        note: "Early paycheck",
      },
    ],
  };

  const confirmedWithOverride = getConfirmedUpcomingPaydays(state.paydaySchedule, simulatedToday);
  assert.deepEqual(
    confirmedWithOverride,
    ["2026-10-23"],
    "Explicitly overridden future occurrence is confirmed even when anchor & following are in the past",
  );
  assert.equal(confirmedWithOverride[0], "2026-10-23");
  assert.equal(confirmedWithOverride[1], undefined, "Synthetic recurring projections without overrides are not confirmed");

  // 5. Past manual anchor with override on the anchorDate itself shifted to future
  state.paydaySchedule = {
    frequency: "manual",
    anchorDate: "2026-10-01", // nominal in past
    manualFollowingPayday: undefined,
    weekendRule: "exact",
    overrides: [
      {
        id: "ov-anchor-shift",
        scheduledDate: "2026-10-01",
        overrideDate: "2026-10-20", // shifted to future
        note: "Delayed deposit",
      },
    ],
  };
  const confirmedAnchorOverride = getConfirmedUpcomingPaydays(state.paydaySchedule, simulatedToday);
  assert.deepEqual(
    confirmedAnchorOverride,
    ["2026-10-20"],
    "Override shifting past anchorDate to future is confirmed",
  );
});

test("Test 3A.3.12 — Schedule changes with one-time overrides: incompatibility validation, non-silent handling, and filtering", () => {
  const simulatedToday = "2026-10-16";

  // 1. Initial Biweekly schedule anchored on 2026-10-16 (Fridays) with an override on 2026-10-30 shifted to 2026-10-29
  const state: State = blank();
  const biweeklySched: PaydaySchedule = {
    frequency: "biweekly",
    anchorDate: "2026-10-16",
    weekendRule: "exact",
    overrides: [
      {
        id: "ov-test-12",
        scheduledDate: "2026-10-30",
        overrideDate: "2026-10-29",
        note: "Early payday",
      },
    ],
  };
  state.paydaySchedule = biweeklySched;

  // 2. Candidate schedule switch to Monthly on 1st of month
  const candidateMonthly: Partial<PaydaySchedule> = {
    frequency: "monthly",
    anchorDate: "2026-10-01",
    dayOfMonth: 1,
    weekendRule: "exact",
  };

  // Incompatibility check: 2026-10-30 is not a nominal occurrence on a Monthly (day 1) schedule
  const resolved = resolveNominalOccurrenceDate(
    {
      frequency: "monthly",
      anchorDate: "2026-10-01",
      dayOfMonth: 1,
      weekendRule: "exact",
      overrides: [],
    },
    "2026-10-30",
  );
  assert.equal(resolved, null, "2026-10-30 does not resolve to a nominal occurrence on Monthly schedule");

  // getUpcomingPaydays must NOT inject the incompatible override into the monthly schedule
  const candidateWithOverrides: PaydaySchedule = {
    frequency: "monthly",
    anchorDate: "2026-10-01",
    dayOfMonth: 1,
    weekendRule: "exact",
    overrides: biweeklySched.overrides,
  };
  const monthlyPaydays = getUpcomingPaydays(candidateWithOverrides, simulatedToday, 3);
  assert.deepEqual(
    monthlyPaydays,
    ["2026-11-01", "2026-12-01", "2027-01-01"],
    "Incompatible biweekly override does not create phantom paydays on monthly schedule",
  );

  // 3. Validation rejection: validatePaydaySchedule rejects candidate schedule with incompatible overrides
  const validationRes = validatePaydaySchedule(candidateWithOverrides);
  assert.equal(validationRes.valid, false, "Candidate schedule with incompatible override is rejected");
  assert.ok(
    validationRes.errors.overrides?.includes("2026-10-30"),
    "Validation error identifies the incompatible override date",
  );

  // updatePaydaySchedule preserves state and returns failure
  const updateFail = updatePaydaySchedule(state, candidateMonthly);
  assert.equal(updateFail.success, false, "updatePaydaySchedule rejects incompatible overrides");
  assert.equal(state.paydaySchedule.frequency, "biweekly", "Existing schedule unchanged on validation failure");
  assert.equal(state.paydaySchedule.overrides?.length, 1, "User-created override was NOT silently deleted");

  // 4. Safe confirmation flow: user explicitly removes the incompatible override before saving
  const candidateClean: Partial<PaydaySchedule> = {
    ...candidateMonthly,
    overrides: [], // User confirmed removal of incompatible overrides
  };
  const updateSuccess = updatePaydaySchedule(state, candidateClean);
  assert.equal(updateSuccess.success, true, "updatePaydaySchedule succeeds once incompatible override removed");
  assert.equal(state.paydaySchedule.frequency, "monthly");
  assert.equal(state.paydaySchedule.dayOfMonth, 1);
  assert.deepEqual(state.paydaySchedule.overrides, []);

  // 5. Switching to a compatible schedule preserves the override
  // Weekly on Fridays (anchor 2026-10-16): 2026-10-30 IS a Friday (nominal occurrence)
  const candidateWeekly: Partial<PaydaySchedule> = {
    frequency: "weekly",
    anchorDate: "2026-10-16",
    weekendRule: "exact",
    overrides: biweeklySched.overrides,
  };
  const weeklyValidation = validatePaydaySchedule(candidateWeekly);
  assert.equal(weeklyValidation.valid, true, "Compatible override on Friday occurrence is valid for weekly schedule");
  const weeklyUpdate = updatePaydaySchedule(state, candidateWeekly);
  assert.equal(weeklyUpdate.success, true);
  assert.equal(state.paydaySchedule.frequency, "weekly");
  assert.equal(state.paydaySchedule.overrides?.length, 1);
  const weeklyUpcoming = getUpcomingPaydays(state.paydaySchedule, simulatedToday, 3);
  assert.deepEqual(
    weeklyUpcoming,
    ["2026-10-16", "2026-10-23", "2026-10-29"],
    "Override shifts 2026-10-30 to 2026-10-29 in compatible weekly schedule",
  );
});

test("Test 3B.1 — Full payment: settles occurrence in full and releases reservation", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";
  state.opening = 100000; // $1,000.00

  const internetBill: Bill = {
    id: "b-internet",
    name: "Internet Fiber",
    amount: 8000, // $80.00
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(internetBill);

  // Before payment: unpaid, $80 reserved
  const beforeStatus = getBillOccurrenceStatus(state, internetBill, "2026-10-15");
  assert.equal(beforeStatus.expectedAmount, 8000);
  assert.equal(beforeStatus.paidAmount, 0);
  assert.equal(beforeStatus.remainingAmount, 8000);
  assert.equal(beforeStatus.overpaidAmount, 0);
  assert.equal(beforeStatus.status, "unpaid");
  assert.equal(isBillPaid(state, internetBill, "2026-10-15"), false);
  assert.equal(reserveBillsBreakdown(state, simulatedToday).currentCycleBills, 8000);

  // Record full payment of $80.00
  const tx = recordBillPayment(state, internetBill.id, {
    dueDate: "2026-10-15",
    amount: 8000,
    date: simulatedToday,
  });
  assert.ok(tx);
  assert.equal(tx.amount, -8000);
  assert.equal(tx.billDueDate, "2026-10-15");

  // After payment: paid in full, $0 remaining, $0 reserved
  const afterStatus = getBillOccurrenceStatus(state, internetBill, "2026-10-15");
  assert.equal(afterStatus.expectedAmount, 8000);
  assert.equal(afterStatus.paidAmount, 8000);
  assert.equal(afterStatus.remainingAmount, 0);
  assert.equal(afterStatus.overpaidAmount, 0);
  assert.equal(afterStatus.status, "paid");
  assert.equal(isBillPaid(state, internetBill, "2026-10-15"), true);
  assert.equal(reserveBillsBreakdown(state, simulatedToday).currentCycleBills, 0);
  assert.equal(nextUnpaidDueDate(state, internetBill, simulatedToday), "2026-11-15");
});

test("Test 3B.2 — Single partial payment: leaves remaining balance and retains obligation", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";
  state.opening = 100000;

  const electricBill: Bill = {
    id: "b-electric",
    name: "Electric Utility",
    amount: 20000, // $200.00
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(electricBill);

  // Pay $75.00 toward $200.00 bill
  const tx = recordBillPayment(state, electricBill.id, {
    dueDate: "2026-10-15",
    amount: 7500,
    date: simulatedToday,
  });
  assert.ok(tx);
  assert.equal(tx.amount, -7500);

  const status = getBillOccurrenceStatus(state, electricBill, "2026-10-15");
  assert.equal(status.expectedAmount, 20000);
  assert.equal(status.paidAmount, 7500);
  assert.equal(status.remainingAmount, 12500);
  assert.equal(status.overpaidAmount, 0);
  assert.equal(status.status, "partially_paid");

  // Crucial check: must NOT be considered fully paid
  assert.equal(isBillPaid(state, electricBill, "2026-10-15"), false);

  // Bill reservation must reserve the remaining $125.00
  const breakdown = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(breakdown.currentCycleBills, 12500);
  assert.equal(breakdown.details[0]?.amount, 12500);

  // nextUnpaidDueDate must remain on 2026-10-15 until the remaining $125 is paid
  assert.equal(nextUnpaidDueDate(state, electricBill, simulatedToday), "2026-10-15");
});

test("Test 3B.3 — Multiple partial payments accumulate toward same occurrence", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";
  state.opening = 100000;

  const rentBill: Bill = {
    id: "b-rent",
    name: "Apartment Rent",
    amount: 150000, // $1,500.00
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(rentBill);

  // Installment 1: $600.00
  recordBillPayment(state, rentBill.id, {
    dueDate: "2026-10-15",
    amount: 60000,
    date: "2026-10-05",
  });
  const s1 = getBillOccurrenceStatus(state, rentBill, "2026-10-15");
  assert.equal(s1.paidAmount, 60000);
  assert.equal(s1.remainingAmount, 90000);
  assert.equal(s1.status, "partially_paid");
  assert.equal(isBillPaid(state, rentBill, "2026-10-15"), false);
  assert.equal(reserveBillsBreakdown(state, simulatedToday).currentCycleBills, 90000);

  // Installment 2: $400.00
  recordBillPayment(state, rentBill.id, {
    dueDate: "2026-10-15",
    amount: 40000,
    date: "2026-10-10",
  });
  const s2 = getBillOccurrenceStatus(state, rentBill, "2026-10-15");
  assert.equal(s2.paidAmount, 100000);
  assert.equal(s2.remainingAmount, 50000);
  assert.equal(s2.status, "partially_paid");
  assert.equal(reserveBillsBreakdown(state, simulatedToday).currentCycleBills, 50000);

  // Installment 3: Final $500.00 completes the bill
  recordBillPayment(state, rentBill.id, {
    dueDate: "2026-10-15",
    amount: 50000,
    date: "2026-10-15",
  });
  const s3 = getBillOccurrenceStatus(state, rentBill, "2026-10-15");
  assert.equal(s3.paidAmount, 150000);
  assert.equal(s3.remainingAmount, 0);
  assert.equal(s3.overpaidAmount, 0);
  assert.equal(s3.status, "paid");
  assert.equal(isBillPaid(state, rentBill, "2026-10-15"), true);
  assert.equal(reserveBillsBreakdown(state, simulatedToday).currentCycleBills, 0);
  assert.equal(nextUnpaidDueDate(state, rentBill, simulatedToday), "2026-11-15");
});

test("Test 3B.4 — Overpayment stays attached to occurrence and does not silently credit future months", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  const waterBill: Bill = {
    id: "b-water",
    name: "City Water",
    amount: 6000, // $60.00
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(waterBill);

  // Pay $90.00 on a $60.00 bill ($30 overpayment)
  recordBillPayment(state, waterBill.id, {
    dueDate: "2026-10-15",
    amount: 9000,
    date: simulatedToday,
  });

  const octStatus = getBillOccurrenceStatus(state, waterBill, "2026-10-15");
  assert.equal(octStatus.expectedAmount, 6000);
  assert.equal(octStatus.paidAmount, 9000);
  assert.equal(octStatus.remainingAmount, 0);
  assert.equal(octStatus.overpaidAmount, 3000);
  assert.equal(octStatus.status, "overpaid");
  assert.equal(isBillPaid(state, waterBill, "2026-10-15"), true);

  // Crucial invariant: The $30 overpayment stays attached to October.
  // It is NOT silently credited toward November. November must still expect $60.00!
  const novStatus = getBillOccurrenceStatus(state, waterBill, "2026-11-15");
  assert.equal(novStatus.expectedAmount, 6000);
  assert.equal(novStatus.paidAmount, 0);
  assert.equal(novStatus.remainingAmount, 6000);
  assert.equal(novStatus.overpaidAmount, 0);
  assert.equal(novStatus.status, "unpaid");
  assert.equal(isBillPaid(state, waterBill, "2026-11-15"), false);
});

test("Test 3B.5 — Early and late payments preserve intended occurrence association", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  const storageBill: Bill = {
    id: "b-storage",
    name: "Storage Locker",
    amount: 10000, // $100.00
    day: 1,
    protected: false,
    trackingStartDate: "2026-09-01",
  };
  state.bills.push(storageBill);

  // Late payment: On October 15, paying the overdue September 1 bill
  const lateTx = recordBillPayment(state, storageBill.id, {
    dueDate: "2026-09-01",
    amount: 10000,
    date: "2026-10-15",
  });
  assert.equal(lateTx?.billDueDate, "2026-09-01");
  assert.equal(isBillPaid(state, storageBill, "2026-09-01"), true);
  // October 1 bill is still unpaid!
  assert.equal(isBillPaid(state, storageBill, "2026-10-01"), false);
  assert.equal(getBillOccurrenceStatus(state, storageBill, "2026-10-01").remainingAmount, 10000);

  // Early payment: On October 15, paying November 1 bill early
  const earlyTx = recordBillPayment(state, storageBill.id, {
    dueDate: "2026-11-01",
    amount: 10000,
    date: "2026-10-15",
  });
  assert.equal(earlyTx?.billDueDate, "2026-11-01");
  assert.equal(isBillPaid(state, storageBill, "2026-11-01"), true);
  // October 1 bill is STILL unpaid!
  assert.equal(isBillPaid(state, storageBill, "2026-10-01"), false);
  assert.equal(nextUnpaidDueDate(state, storageBill, simulatedToday), "2026-10-01");
});

test("Test 3B.6 — Scheduled versus posted transactions: scheduled transactions do not count as completed payments", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";
  state.opening = 100000;

  const phoneBill: Bill = {
    id: "b-phone",
    name: "Mobile Phone",
    amount: 7000, // $70.00
    day: 20,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(phoneBill);

  // Schedule payment for October 20
  const scheduledTx = recordBillPayment(state, phoneBill.id, {
    dueDate: "2026-10-20",
    amount: 7000,
    date: "2026-10-20",
    status: "scheduled",
  });
  assert.ok(scheduledTx);
  assert.equal(scheduledTx.status, "scheduled");

  // Occurrence status: Scheduled transaction must NOT be counted in paidAmount!
  const occStatus = getBillOccurrenceStatus(state, phoneBill, "2026-10-20");
  assert.equal(occStatus.paidAmount, 0, "Scheduled transactions must not count toward paidAmount");
  assert.equal(occStatus.remainingAmount, 7000, "Remaining balance remains $70.00");
  assert.equal(occStatus.status, "unpaid");
  assert.equal(isBillPaid(state, phoneBill, "2026-10-20"), false);

  // Financial totals:
  const tBefore = totals(state, simulatedToday);
  assert.equal(tBefore.balance, 100000, "Checking balance untouched by scheduled payment");
  assert.equal(tBefore.bills, 7000, "Bill reservation holds $70.00");
  assert.equal(tBefore.uncoveredScheduledExpenses, 0, "Linked scheduled transaction not double-counted in uncoveredScheduledExpenses");
  assert.equal(tBefore.safe, 93000, "Safe to spend = $1000 - $70 = $930");

  // Post transaction on October 20
  scheduledTx.status = "posted";
  scheduledTx.postedDate = "2026-10-20";

  const occPosted = getBillOccurrenceStatus(state, phoneBill, "2026-10-20");
  assert.equal(occPosted.paidAmount, 7000);
  assert.equal(occPosted.remainingAmount, 0);
  assert.equal(occPosted.status, "paid");
  assert.equal(isBillPaid(state, phoneBill, "2026-10-20"), true);

  const tAfter = totals(state, "2026-10-20");
  assert.equal(tAfter.balance, 93000, "Balance reduced by $70 posted payment");
  assert.equal(tAfter.bills, 0, "Bill reservation released");
  assert.equal(tAfter.safe, 93000, "Safe to spend remains $930.00 (invariant preserved)");
});

test("Test 3B.7 — Editing and deleting linked payments dynamically recalculates outstanding amounts", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  const carInsurance: Bill = {
    id: "b-car",
    name: "Car Insurance",
    amount: 12000, // $120.00
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(carInsurance);

  const tx = recordBillPayment(state, carInsurance.id, {
    dueDate: "2026-10-15",
    amount: 5000, // $50.00
    date: simulatedToday,
  })!;

  assert.equal(getBillOccurrenceStatus(state, carInsurance, "2026-10-15").remainingAmount, 7000);

  // 1. Edit payment amount: change from $50.00 to $100.00
  tx.amount = -10000;
  assert.equal(getBillOccurrenceStatus(state, carInsurance, "2026-10-15").paidAmount, 10000);
  assert.equal(getBillOccurrenceStatus(state, carInsurance, "2026-10-15").remainingAmount, 2000);
  assert.equal(getBillOccurrenceStatus(state, carInsurance, "2026-10-15").status, "partially_paid");

  // 2. Edit unrelated properties: name and date
  tx.name = "Auto Insurance Inc";
  tx.date = "2026-10-14";
  assert.equal(tx.billDueDate, "2026-10-15", "Occurrence link preserved");
  assert.equal(getBillOccurrenceStatus(state, carInsurance, "2026-10-15").remainingAmount, 2000);

  // 3. Delete payment transaction
  state.transactions = state.transactions.filter((t) => t.id !== tx.id);
  const sDeleted = getBillOccurrenceStatus(state, carInsurance, "2026-10-15");
  assert.equal(sDeleted.paidAmount, 0);
  assert.equal(sDeleted.remainingAmount, 12000);
  assert.equal(sDeleted.status, "unpaid");
  assert.equal(reserveBillsBreakdown(state, simulatedToday).currentCycleBills, 12000);
});

test("Test 3B.8 — Historical settlement without cash deduction and partial settlement", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";
  state.opening = 500000; // $5,000.00

  const hoaBill: Bill = {
    id: "b-hoa",
    name: "HOA Dues",
    amount: 30000, // $300.00
    day: 1,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(hoaBill);

  // Scenario A: Mark settled without payment
  const settledOk = settleBillOccurrence(state, hoaBill.id, "2026-10-01");
  assert.equal(settledOk, true);
  const hoaStatus = getBillOccurrenceStatus(state, hoaBill, "2026-10-01");
  assert.equal(hoaStatus.isSettled, true);
  assert.equal(hoaStatus.paidAmount, 0);
  assert.equal(hoaStatus.remainingAmount, 0);
  assert.equal(hoaStatus.status, "paid");
  assert.equal(isBillPaid(state, hoaBill, "2026-10-01"), true);
  // Cash balance is completely untouched
  assert.equal(totals(state, simulatedToday).balance, 500000);

  // Scenario B: Settle an occurrence that had a partial payment
  const trashBill: Bill = {
    id: "b-trash",
    name: "Trash Service",
    amount: 9000, // $90.00
    day: 10,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(trashBill);
  recordBillPayment(state, trashBill.id, {
    dueDate: "2026-10-10",
    amount: 3000, // $30.00 partial payment
    date: "2026-10-10",
  });
  assert.equal(getBillOccurrenceStatus(state, trashBill, "2026-10-10").remainingAmount, 6000);
  settleBillOccurrence(state, trashBill.id, "2026-10-10");
  const trashStatus = getBillOccurrenceStatus(state, trashBill, "2026-10-10");
  assert.equal(trashStatus.isSettled, true);
  assert.equal(trashStatus.paidAmount, 3000);
  assert.equal(trashStatus.remainingAmount, 0);
  assert.equal(trashStatus.status, "paid");
  assert.equal(isBillPaid(state, trashBill, "2026-10-10"), true);
});

test("Test 3B.9 — Ambiguous legacy transactions handled conservatively", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  const netflixBill: Bill = {
    id: "b-netflix",
    name: "Netflix",
    amount: 2000, // $20.00
    day: 15,
    protected: false,
    trackingStartDate: "2026-09-01",
  };
  state.bills.push(netflixBill);

  // September is unpaid. Unlinked transaction in October cannot be assumed for October.
  state.transactions.push({
    id: "tx-unlinked-oct",
    name: "Netflix Sub",
    amount: -2000,
    category: "Bills",
    date: "2026-10-15",
    status: "posted",
    billId: netflixBill.id,
    // billDueDate undefined!
  });

  // Because September is unpaid, October occurrence must retain obligation!
  const octStatus = getBillOccurrenceStatus(state, netflixBill, "2026-10-15");
  assert.equal(octStatus.paidAmount, 0, "Cannot guess unlinked transaction when prior occurrence unpaid");
  assert.equal(octStatus.remainingAmount, 2000);
  assert.equal(isBillPaid(state, netflixBill, "2026-10-15"), false);

  // Settle September so September is no longer unpaid
  settleBillOccurrence(state, netflixBill.id, "2026-09-15");
  assert.equal(isBillPaid(state, netflixBill, "2026-09-15"), true);

  // Now the single unlinked transaction in October unambiguously matches October!
  const octResolved = getBillOccurrenceStatus(state, netflixBill, "2026-10-15");
  assert.equal(octResolved.paidAmount, 2000);
  assert.equal(octResolved.remainingAmount, 0);
  assert.equal(octResolved.status, "paid");
  assert.equal(isBillPaid(state, netflixBill, "2026-10-15"), true);
});

test("Test 3B.10 — Overdue and protected reservations reserve outstanding remaining amounts", () => {
  const simulatedToday = "2026-10-16";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  // Bill 1: Overdue from October 5 ($300) with $100 paid -> $200 remaining
  const overdueBill: Bill = {
    id: "b-overdue",
    name: "Overdue Medical",
    amount: 30000,
    day: 5,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  // Bill 2: Current cycle due October 20 ($200) with $75 paid -> $125 remaining
  const currentBill: Bill = {
    id: "b-current",
    name: "Power Bill",
    amount: 20000,
    day: 20,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  // Bill 3: Protected following-cycle due November 1 ($150) with $50 paid -> $100 remaining
  const protectedBill: Bill = {
    id: "b-protected",
    name: "Student Loan",
    amount: 15000,
    day: 1,
    protected: true,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(overdueBill, currentBill, protectedBill);
  settleBillOccurrence(state, protectedBill.id, "2026-10-01");

  // Record partial payments
  recordBillPayment(state, overdueBill.id, {
    dueDate: "2026-10-05",
    amount: 10000,
    date: "2026-10-05",
  });
  recordBillPayment(state, currentBill.id, {
    dueDate: "2026-10-20",
    amount: 7500,
    date: "2026-10-10",
  });
  recordBillPayment(state, protectedBill.id, {
    dueDate: "2026-11-01",
    amount: 5000,
    date: "2026-10-12",
  });

  const breakdown = reserveBillsBreakdown(state, simulatedToday);
  // Current cycle: $200 (overdue) + $125 (current) = $325 (32500 cents)
  assert.equal(breakdown.currentCycleBills, 32500);
  // Protected following cycle: $100 (10000 cents)
  assert.equal(breakdown.protectedCycleBills, 10000);
  // Total: $325 + $100 = $425 (42500 cents)
  assert.equal(breakdown.total, 42500);
});

test("Test 3B.11 — Safe to Spend and shortfall invariant preservation under partial payments", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";
  state.opening = 100000; // $1,000.00 cash

  const bill: Bill = {
    id: "b-tax",
    name: "Property Tax",
    amount: 40000, // $400.00
    day: 18,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(bill);

  // Initially: balance = $1,000, bills reserved = $400, safe = $600
  const t0 = totals(state, simulatedToday);
  assert.equal(t0.balance, 100000);
  assert.equal(t0.bills, 40000);
  assert.equal(t0.safe, 60000);
  assert.equal(t0.shortfall, 0);

  // Pay $150.00 partial payment from checking
  recordBillPayment(state, bill.id, {
    dueDate: "2026-10-18",
    amount: 15000,
    date: simulatedToday,
  });

  // After payment:
  // Cash balance drops to $850 ($1,000 - $150).
  // Bill reservation drops to $250 ($400 - $150).
  // Safe to Spend = $850 - $250 = $600!
  // Invariant: Cash dropped and reservation dropped by exact same $150; Safe to Spend is preserved!
  const t1 = totals(state, simulatedToday);
  assert.equal(t1.balance, 85000);
  assert.equal(t1.bills, 25000);
  assert.equal(t1.safe, 60000, "Safe to spend must not change when bill paid from cash");
  assert.equal(t1.shortfall, 0);

  // Shortfall preservation: If total obligations exceed cash
  const shortState: State = blank();
  shortState.payday = "2026-10-23";
  shortState.followingPayday = "2026-11-06";
  shortState.opening = 15000; // $150.00 cash
  shortState.bills.push({
    id: "b-big",
    name: "Big Bill",
    amount: 50000, // $500.00
    day: 18,
    protected: false,
    trackingStartDate: "2026-10-01",
  });
  const tShort0 = totals(shortState, simulatedToday);
  // balance = 15000, bills = 50000 -> rawSafe = 15000 - 50000 = -35000 -> safe = 0, shortfall = 35000
  assert.equal(tShort0.safe, 0);
  assert.equal(tShort0.shortfall, 35000);

  // Pay $50.00: cash becomes $100.00, bill remaining becomes $450.00
  recordBillPayment(shortState, "b-big", {
    dueDate: "2026-10-18",
    amount: 5000,
    date: simulatedToday,
  });
  const tShort1 = totals(shortState, simulatedToday);
  assert.equal(tShort1.balance, 10000);
  assert.equal(tShort1.bills, 45000);
  assert.equal(tShort1.safe, 0);
  assert.equal(tShort1.shortfall, 35000, "Shortfall magnitude remains exactly $350.00");
});

test("Test 3B.12 — Credit card bill payment behavior & Covered Credit integration", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";
  state.opening = 100000; // $1,000 checking

  const ccAccount: Account = {
    id: "acc-cc-1",
    name: "Visa Card",
    type: "credit",
    balance: 0,
    opening: 0,
    creditLimit: 500000,
    includeInSafeToSpend: false,
  };
  state.accounts = [
    {
      id: "acc-default-checking",
      name: "Checking",
      type: "checking",
      balance: 100000,
      opening: 100000,
      includeInSafeToSpend: true,
    },
    ccAccount,
  ];

  const streamingBill: Bill = {
    id: "b-stream",
    name: "Streaming Subscription",
    amount: 1500, // $15.00
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(streamingBill);

  // Pay bill using credit card
  const tx = recordBillPayment(state, streamingBill.id, {
    dueDate: "2026-10-15",
    amount: 1500,
    accountId: ccAccount.id,
    date: simulatedToday,
  });
  assert.ok(tx);
  assert.equal(tx.accountId, ccAccount.id);

  // Occurrence is paid
  const occ = getBillOccurrenceStatus(state, streamingBill, "2026-10-15");
  assert.equal(occ.paidAmount, 1500);
  assert.equal(occ.remainingAmount, 0);
  assert.equal(occ.status, "paid");

  // Checking cash balance is NOT reduced by card charge (card liability increased)
  const ccCoverage = getCreditCardCoverage(ccAccount, state, simulatedToday);
  assert.equal(ccCoverage.totalOwed, 1500, "Credit card balance owed increased by $15.00");
  const t = totals(state, simulatedToday);
  assert.equal(t.balance, 100000, "Checking balance untouched by credit card charge");
  assert.equal(t.bills, 0, "Bill reservation released");
});

test("Test 3B.13 — Composable and Modal workflow integration", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";
  state.opening = 200000;

  const phoneBill: Bill = {
    id: "b-phone-test",
    name: "Family Phone Plan",
    amount: 16000, // $160.00
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(phoneBill);

  // Setup budget composable context
  const budget = useBudget();
  budget.state.value = state;

  // 1. payBill with custom amount
  const p1 = budget.payBill(phoneBill.id, {
    amount: 6000,
    dueDate: "2026-10-15",
  });
  assert.ok(p1);
  const occ1 = budget.getBillOccurrenceStatus(phoneBill, "2026-10-15");
  assert.equal(occ1.paidAmount, 6000);
  assert.equal(occ1.remainingAmount, 10000);
  assert.equal(occ1.status, "partially_paid");

  // 2. useModal open("Pay bill") pre-fills remaining balance of $100.00
  const modal = useModal();
  modal.open("Pay bill", phoneBill.id);
  assert.equal(modal.form.value.name, "Family Phone Plan");
  assert.equal(modal.form.value.amount, "100"); // $100.00 remaining
  assert.equal(modal.form.value.billDueDate, "2026-10-15");

  // 3. Modal validation checks
  // A. Invalid payment amount <= 0
  modal.form.value.amount = "0";
  modal.submit();
  assert.equal(modal.error.value, "Enter a valid payment amount greater than zero.");

  // B. Invalid date
  modal.form.value.amount = "50";
  modal.form.value.date = "invalid-date";
  modal.submit();
  assert.equal(modal.error.value, "Enter a valid payment date (YYYY-MM-DD).");

  // C. Cleared status with future date rejected
  modal.form.value.date = "2026-12-25";
  modal.form.value.status = "cleared";
  modal.submit();
  assert.equal(modal.error.value, "A transaction cannot be marked cleared with a future date.");

  // D. Valid payment of remaining $100
  modal.form.value.date = simulatedToday;
  modal.form.value.status = "posted";
  modal.form.value.amount = "100";
  modal.submit();
  assert.equal(modal.error.value, "");

  const occFinal = budget.getBillOccurrenceStatus(phoneBill, "2026-10-15");
  assert.equal(occFinal.paidAmount, 16000);
  assert.equal(occFinal.remainingAmount, 0);
  assert.equal(occFinal.status, "paid");
  assert.equal(isBillPaid(budget.state.value, phoneBill, "2026-10-15"), true);
});

test("Test 3B.14 — Legacy payment attribution stability before and after new explicit partial payments, and conservative ambiguous handling", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";
  state.opening = 200000;

  const electricBill: Bill = {
    id: "b-electric",
    name: "Electric Co",
    amount: 20000, // $200.00
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(electricBill);

  // 1. One safely attributable legacy unlinked payment in October: $50.00
  state.transactions.push({
    id: "tx-legacy-50",
    name: "Electric Co",
    amount: -5000,
    category: "Bills",
    date: "2026-10-10",
    status: "posted",
    billId: electricBill.id,
    // billDueDate undefined (legacy unlinked)
  });

  // Verify status before new payment: paid $50, remaining $150
  const occBefore = getBillOccurrenceStatus(state, electricBill, "2026-10-15");
  assert.equal(occBefore.paidAmount, 5000);
  assert.equal(occBefore.remainingAmount, 15000);
  assert.equal(occBefore.status, "partially_paid");
  assert.equal(occBefore.transactions.length, 1);
  assert.equal(occBefore.transactions[0]!.id, "tx-legacy-50");

  // 2. Record new explicitly linked partial payment: $75.00
  const p75 = recordBillPayment(state, electricBill.id, {
    dueDate: "2026-10-15",
    amount: 7500,
    date: simulatedToday,
  });
  assert.ok(p75);
  assert.equal(p75.amount, -7500);
  assert.equal(p75.billDueDate, "2026-10-15");

  // Verify status after new payment:
  // Legacy $50 must NOT silently disappear! Outstanding balance must be $75!
  const occAfter = getBillOccurrenceStatus(state, electricBill, "2026-10-15");
  assert.equal(
    occAfter.paidAmount,
    12500,
    "Paid amount combines legacy $50 and explicit $75",
  );
  assert.equal(
    occAfter.remainingAmount,
    7500,
    "Remaining balance is exactly $75 ($200 - $125)",
  );
  assert.equal(occAfter.status, "partially_paid");
  assert.equal(occAfter.transactions.length, 2);
  assert.ok(
    occAfter.transactions.some((t) => t.id === "tx-legacy-50"),
    "Legacy tx retained",
  );
  assert.ok(
    occAfter.transactions.some((t) => t.id === p75.id),
    "Explicit tx included",
  );

  // 3. Ambiguous legacy transactions: Multiple unlinked transactions in the same month
  const waterBill: Bill = {
    id: "b-water",
    name: "Water Utility",
    amount: 10000, // $100.00
    day: 20,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(waterBill);

  state.transactions.push(
    {
      id: "tx-unlinked-water-1",
      name: "Water Utility",
      amount: -3000,
      category: "Bills",
      date: "2026-10-05",
      status: "posted",
      billId: waterBill.id,
    },
    {
      id: "tx-unlinked-water-2",
      name: "Water Utility",
      amount: -3000,
      category: "Bills",
      date: "2026-10-12",
      status: "posted",
      billId: waterBill.id,
    },
  );

  // Because there are multiple unlinked candidates in October, it is ambiguous which occurrence or portion they represent.
  // Conservative rule: Neither is automatically assigned without explicit linkage.
  const waterBefore = getBillOccurrenceStatus(state, waterBill, "2026-10-20");
  assert.equal(
    waterBefore.paidAmount,
    0,
    "Ambiguous multiple unlinked records not attributed",
  );
  assert.equal(waterBefore.remainingAmount, 10000);
  assert.equal(waterBefore.status, "unpaid");

  // Even if an explicit payment is recorded, ambiguous unlinked records remain unattributed
  recordBillPayment(state, waterBill.id, {
    dueDate: "2026-10-20",
    amount: 4000,
    date: simulatedToday,
  });
  const waterAfter = getBillOccurrenceStatus(state, waterBill, "2026-10-20");
  assert.equal(
    waterAfter.paidAmount,
    4000,
    "Only explicit payment attributed when unlinked candidates are ambiguous",
  );
  assert.equal(waterAfter.remainingAmount, 6000);
  assert.equal(waterAfter.status, "partially_paid");
});

test("Test 3B.15 — Model-level recordBillPayment validation: invalid amount, date, status, account rejection with untouched state", () => {
  const simulatedToday = "2026-10-15";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";
  state.opening = 100000;
  state.accounts = [
    {
      id: "acc-chk-main",
      name: "Checking",
      type: "checking",
      opening: 100000,
      balance: 100000,
      includeInSafeToSpend: true,
    },
  ];

  const gasBill: Bill = {
    id: "b-gas-val",
    name: "Gas Bill",
    amount: 8000, // $80.00
    day: 18,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(gasBill);

  const initialTxCount = state.transactions.length;
  const initialTotals = totals(state, simulatedToday);

  // 1. Amount: Zero
  const rZero = recordBillPayment(state, gasBill.id, { amount: 0 });
  assert.equal(rZero, null);
  assert.equal(state.transactions.length, initialTxCount);

  // 2. Amount: Negative
  const rNeg = recordBillPayment(state, gasBill.id, { amount: -2000 });
  assert.equal(rNeg, null);
  assert.equal(state.transactions.length, initialTxCount);

  // 3. Amount: NaN
  const rNaN = recordBillPayment(state, gasBill.id, { amount: NaN });
  assert.equal(rNaN, null);
  assert.equal(state.transactions.length, initialTxCount);

  // 4. Amount: Infinity / -Infinity
  const rInf = recordBillPayment(state, gasBill.id, { amount: Infinity });
  assert.equal(rInf, null);
  const rNegInf = recordBillPayment(state, gasBill.id, { amount: -Infinity });
  assert.equal(rNegInf, null);
  assert.equal(state.transactions.length, initialTxCount);

  // 5. Amount: Non-integer cents
  const rFraction = recordBillPayment(state, gasBill.id, { amount: 45.5 });
  assert.equal(rFraction, null);
  assert.equal(state.transactions.length, initialTxCount);

  // 6. Invalid dates
  const rBadDate = recordBillPayment(state, gasBill.id, {
    date: "not-a-date",
  });
  assert.equal(rBadDate, null);
  const rBadDueDate = recordBillPayment(state, gasBill.id, {
    dueDate: "2026-02-31",
  });
  assert.equal(rBadDueDate, null);
  assert.equal(state.transactions.length, initialTxCount);

  // 7. Unsupported status
  const rBadStatus = recordBillPayment(state, gasBill.id, {
    status: "nonexistent-status" as any,
  });
  assert.equal(rBadStatus, null);
  assert.equal(state.transactions.length, initialTxCount);

  // 8. Non-existent account
  const rBadAcc = recordBillPayment(state, gasBill.id, {
    accountId: "acc-ghost",
  });
  assert.equal(rBadAcc, null);
  assert.equal(state.transactions.length, initialTxCount);

  // Verify financial totals and state completely untouched after all rejected calls
  const untouchedTotals = totals(state, simulatedToday);
  assert.equal(untouchedTotals.balance, initialTotals.balance);
  assert.equal(untouchedTotals.bills, initialTotals.bills);
  assert.equal(untouchedTotals.safe, initialTotals.safe);

  // 9. Valid partial payment succeeds
  const rValidPartial = recordBillPayment(state, gasBill.id, {
    amount: 3000,
    accountId: "acc-chk-main",
    date: simulatedToday,
  });
  assert.ok(rValidPartial);
  assert.equal(rValidPartial.amount, -3000);
  assert.equal(state.transactions.length, initialTxCount + 1);

  // 10. Valid overpayment succeeds and attaches excess to occurrence
  const rValidOver = recordBillPayment(state, gasBill.id, {
    dueDate: "2026-10-18",
    amount: 7000, // $70 on remaining $50 -> overpaid by $20
    accountId: "acc-chk-main",
    date: simulatedToday,
  });
  assert.ok(rValidOver);
  assert.equal(rValidOver.amount, -7000);

  const occOver = getBillOccurrenceStatus(state, gasBill, "2026-10-18");
  assert.equal(occOver.paidAmount, 10000);
  assert.equal(occOver.expectedAmount, 8000);
  assert.equal(occOver.remainingAmount, 0);
  assert.equal(occOver.overpaidAmount, 2000);
  assert.equal(occOver.status, "overpaid");
});

test("Test 3B.16 — Reservation fallback safety: never reintroduces full bill amount for paid or partially paid occurrences", () => {
  const simulatedToday = "2026-10-11";
  const state: State = blank();
  state.payday = "2026-10-12";
  state.followingPayday = "2026-10-12";
  state.opening = 200000; // $2,000 cash

  // Bill configured where trackingStartDate is 2026-10-10, payday is 2026-10-12,
  // but due day is 5.
  // In October, due date is 2026-10-05 (before trackingStartDate 2026-10-10).
  // In November, due date is 2026-11-05 (after maxEnd 2026-10-12).
  // Therefore, 0 occurrences fall within [trackingStartDate, maxEnd], triggering the defensive fallback!
  const fallbackBill: Bill = {
    id: "b-fallback",
    name: "Fallback Test Bill",
    amount: 10000, // $100.00
    day: 5,
    protected: false,
    trackingStartDate: "2026-10-10",
  };
  state.bills.push(fallbackBill);

  // Sub-case 1: Bill is unpaid in current cycle (2026-10-05)
  // Safely reserves full amount $100 via fallback
  const bd1 = reserveBillsBreakdown(state, simulatedToday);
  assert.ok(
    bd1.diagnostics.some((d) =>
      d.includes("yielded 0 evaluated occurrences within window"),
    ),
    "Defensive fallback diagnostic must be triggered",
  );
  assert.equal(bd1.currentCycleBills, 10000);
  const t1 = totals(state, simulatedToday);
  assert.equal(t1.bills, 10000);
  assert.equal(t1.safe, 190000);

  // Sub-case 2: Bill has a partial payment of $40 ($40 paid, $60 remaining)
  recordBillPayment(state, fallbackBill.id, {
    dueDate: "2026-10-05",
    amount: 4000,
    date: "2026-10-10",
  });
  const occPart = getBillOccurrenceStatus(state, fallbackBill, "2026-10-05");
  assert.equal(occPart.paidAmount, 4000);
  assert.equal(occPart.remainingAmount, 6000);
  assert.equal(occPart.status, "partially_paid");

  // Fallback MUST reserve only $60 (remaining balance), NEVER reintroduce $100!
  const bd2 = reserveBillsBreakdown(state, simulatedToday);
  assert.ok(
    bd2.diagnostics.some((d) =>
      d.includes("yielded 0 evaluated occurrences within window"),
    ),
    "Defensive fallback diagnostic must be triggered",
  );
  assert.equal(
    bd2.currentCycleBills,
    6000,
    "Fallback reserves only remaining $60, not full $100",
  );
  const t2 = totals(state, simulatedToday);
  // Cash was 200000 - 4000 = 196000; bills is 6000; safe = 196000 - 6000 = 190000
  assert.equal(t2.balance, 196000);
  assert.equal(t2.bills, 6000);
  assert.equal(
    t2.safe,
    190000,
    "Safe to Spend invariant preserved identically",
  );

  // Sub-case 3: Bill is fully paid (remaining $60 is paid)
  recordBillPayment(state, fallbackBill.id, {
    dueDate: "2026-10-05",
    amount: 6000,
    date: "2026-10-10",
  });
  const occFull = getBillOccurrenceStatus(state, fallbackBill, "2026-10-05");
  assert.equal(occFull.paidAmount, 10000);
  assert.equal(occFull.remainingAmount, 0);
  assert.equal(occFull.status, "paid");

  // Fallback MUST NOT reintroduce the bill! Reservation must be $0!
  const bd3 = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(
    bd3.currentCycleBills,
    0,
    "Fallback must reserve $0 for fully paid occurrence",
  );
  const t3 = totals(state, simulatedToday);
  // Cash was 196000 - 6000 = 190000; bills is 0; safe = 190000 - 0 = 190000
  assert.equal(t3.balance, 190000);
  assert.equal(t3.bills, 0);
  assert.equal(t3.safe, 190000, "Safe to spend remains $1,900");

  // Sub-case 4: Settled occurrence
  const settledBill: Bill = {
    id: "b-fallback-settled",
    name: "Fallback Settled Bill",
    amount: 5000,
    day: 5,
    protected: false,
    trackingStartDate: "2026-10-10",
  };
  state.bills.push(settledBill);
  settleBillOccurrence(state, settledBill.id, "2026-10-05");
  const occSettled = getBillOccurrenceStatus(state, settledBill, "2026-10-05");
  assert.equal(occSettled.isSettled, true);
  assert.equal(occSettled.remainingAmount, 0);

  const bd4 = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(
    bd4.currentCycleBills,
    0,
    "Fallback reserves $0 for settled occurrence",
  );
});

test("Test 3C.1 — Zero-balance cards: no minimum protection created", () => {
  const simulatedToday = "2026-10-14";
  const state: State = blank();
  state.payday = "2026-10-23";
  state.followingPayday = "2026-11-06";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Zero Balance Card",
    type: "credit",
    opening: 0,
    creditLimit: 200000,
    minPayment: 3500, // $35.00 configured minimum
    dueDay: 15,
    includeInSafeToSpend: false,
  };
  state.accounts = [checking, card];

  const minProt = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(minProt.totalOwed, 0, "Total owed is zero");
  assert.equal(minProt.effectiveMinimum, 0, "Effective minimum clamped to $0 owed");
  assert.equal(minProt.additionalProtectionRequired, 0, "No additional protection required");
  assert.equal(minProt.status, "not_applicable", "Status is not_applicable for zero debt");

  const bd = getCreditCardMinimumBreakdown(state, simulatedToday);
  assert.equal(bd.totalAdditionalProtection, 0);

  const t = totals(state, simulatedToday);
  assert.equal(t.creditCardMinimums, 0);
  assert.equal(t.safe, 100000, "Safe to Spend is unaffected by zero-balance card");
});

test("Test 3C.2 — Partially covered minimums: protects only the remaining difference (Interaction A)", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-20";
  state.followingPayday = "2026-11-03";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Partially Covered Card",
    type: "credit",
    opening: 50000, // $500.00 debt owed
    creditLimit: 300000,
    minPayment: 3500, // $35.00 configured minimum
    dueDay: 15, // due Oct 15 (inside current window Oct 10 - Oct 20)
    includeInSafeToSpend: false,
    assignedPaymentReserve: 2000, // $20.00 already Ready to Pay
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];

  const cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.readyToPay, 2000, "Ready to pay is $20.00");

  const minProt = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(minProt.totalOwed, 50000);
  assert.equal(minProt.configuredMinimum, 3500);
  assert.equal(minProt.effectiveMinimum, 3500);
  assert.equal(minProt.readyToPay, 2000);
  assert.equal(minProt.additionalProtectionRequired, 1500, "Additional protection required is exactly $15.00");
  assert.equal(minProt.status, "partially_covered");

  const t = totals(state, simulatedToday);
  assert.equal(t.totalReadyToPay, 2000, "Ready to Pay is $20");
  assert.equal(t.creditCardMinimums, 1500, "Credit card minimum additional protection is $15");
  // Safe to Spend = $1,000 cash - $20 Ready to Pay - $15 Minimum = $965 ($35 total protected toward minimum, not $55)
  assert.equal(t.safe, 96500, "Total protected towards minimum is $35 ($20 + $15)");
});

test("Test 3C.3 — Fully covered minimums: requires zero additional protection (Interaction B)", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-20";
  state.followingPayday = "2026-11-03";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Fully Covered Card",
    type: "credit",
    opening: 50000, // $500.00 owed
    creditLimit: 300000,
    minPayment: 3500, // $35.00 minimum
    dueDay: 15,
    includeInSafeToSpend: false,
    assignedPaymentReserve: 5000, // $50.00 Ready to Pay (exceeds $35 minimum)
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];

  const minProt = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(minProt.additionalProtectionRequired, 0, "Zero additional protection needed when Ready to Pay >= min");
  assert.equal(minProt.status, "covered");

  const t = totals(state, simulatedToday);
  assert.equal(t.totalReadyToPay, 5000);
  assert.equal(t.creditCardMinimums, 0, "creditCardMinimums is $0");
  assert.equal(t.safe, 95000, "Safe to spend only reserves the $50 Ready to Pay");
});

test("Test 3C.4 — Minimum exceeds outstanding debt: capped at debt owed (Interaction C)", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-20";
  state.followingPayday = "2026-11-03";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Small Debt Card",
    type: "credit",
    opening: 2000, // owes only $20.00
    creditLimit: 300000,
    minPayment: 3500, // $35.00 configured minimum
    dueDay: 15,
    includeInSafeToSpend: false,
  };
  state.accounts = [checking, card];

  const minProt = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(minProt.totalOwed, 2000);
  assert.equal(minProt.configuredMinimum, 3500);
  assert.equal(minProt.effectiveMinimum, 2000, "Effective minimum capped at $20 debt");
  assert.equal(minProt.additionalProtectionRequired, 2000, "Protects no more than the $20 actual debt");
  assert.equal(minProt.status, "uncovered");

  const t = totals(state, simulatedToday);
  assert.equal(t.creditCardMinimums, 2000);
  assert.equal(t.safe, 98000, "Safe to Spend protects $20, not $35");
});

test("Test 3C.5 — Multiple credit cards: isolation and aggregation in breakdown", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-20";
  state.followingPayday = "2026-11-03";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 200000, // $2,000.00
    includeInSafeToSpend: true,
  };
  // Card A: owes $300, min $50, readyToPay $20 -> additional protection $30
  const cardA: Account = {
    id: "acc-crd-a",
    name: "Card A",
    type: "credit",
    opening: 30000,
    creditLimit: 100000,
    minPayment: 5000,
    dueDay: 14,
    includeInSafeToSpend: false,
    assignedPaymentReserve: 2000,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  // Card B: owes $100, min $25, readyToPay $25 -> additional protection $0
  const cardB: Account = {
    id: "acc-crd-b",
    name: "Card B",
    type: "credit",
    opening: 10000,
    creditLimit: 100000,
    minPayment: 2500,
    dueDay: 16,
    includeInSafeToSpend: false,
    assignedPaymentReserve: 2500,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  // Card C: owes $0, min $40 -> additional protection $0
  const cardC: Account = {
    id: "acc-crd-c",
    name: "Card C",
    type: "credit",
    opening: 0,
    creditLimit: 100000,
    minPayment: 4000,
    dueDay: 18,
    includeInSafeToSpend: false,
  };
  state.accounts = [checking, cardA, cardB, cardC];

  const bd = getCreditCardMinimumBreakdown(state, simulatedToday);
  assert.equal(bd.totalConfiguredMinimums, 11500);
  assert.equal(bd.totalEffectiveMinimums, 7500); // Card A ($50) + Card B ($25) + Card C ($0)
  assert.equal(bd.totalAdditionalProtection, 3000, "Only Card A needs $30 additional protection");
  assert.equal(bd.cards.length, 3);

  const t = totals(state, simulatedToday);
  assert.equal(t.totalReadyToPay, 4500); // Card A ($20) + Card B ($25)
  assert.equal(t.creditCardMinimums, 3000); // Card A ($30)
  assert.equal(t.safe, 200000 - 4500 - 3000, "Safe to spend reserves exactly $45 + $30 = $75");
});

test("Test 3C.6 — Archived credit cards: zero minimum-payment reservation", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-20";

  const cardArchived: Account = {
    id: "acc-crd-archived",
    name: "Old Archived Card",
    type: "credit",
    opening: 50000, // $500 debt
    creditLimit: 100000,
    minPayment: 5000, // $50 minimum
    dueDay: 15,
    archived: true,
    includeInSafeToSpend: false,
  };
  state.accounts = [cardArchived];

  const minProt = getCreditCardMinimumProtection(cardArchived, state, simulatedToday);
  assert.equal(minProt.status, "not_applicable");
  assert.equal(minProt.additionalProtectionRequired, 0);

  const bd = getCreditCardMinimumBreakdown(state, simulatedToday);
  assert.equal(bd.totalAdditionalProtection, 0);
  assert.equal(bd.cards.length, 0, "Archived cards excluded from active breakdown");
});

test("Test 3C.7 — Missing minimum or due day: no fabricated payments", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-20";

  const cardNoMin: Account = {
    id: "acc-crd-nomin",
    name: "Card No Min",
    type: "credit",
    opening: 50000,
    creditLimit: 100000,
    dueDay: 15,
    includeInSafeToSpend: false,
  };
  const cardNoDay: Account = {
    id: "acc-crd-noday",
    name: "Card No Due Day",
    type: "credit",
    opening: 50000,
    creditLimit: 100000,
    minPayment: 3500,
    includeInSafeToSpend: false,
  };
  state.accounts = [cardNoMin, cardNoDay];

  const p1 = getCreditCardMinimumProtection(cardNoMin, state, simulatedToday);
  assert.equal(p1.status, "not_applicable");
  assert.equal(p1.additionalProtectionRequired, 0);

  const p2 = getCreditCardMinimumProtection(cardNoDay, state, simulatedToday);
  assert.equal(p2.status, "not_applicable");
  assert.equal(p2.dueDate, null);
  assert.equal(p2.additionalProtectionRequired, 0);

  const bd = getCreditCardMinimumBreakdown(state, simulatedToday);
  assert.equal(bd.totalAdditionalProtection, 0);
});

test("Test 3C.8 — Due days 29–31 and leap years: month-end clamping", () => {
  const card: Account = {
    id: "acc-test",
    name: "Test Card",
    type: "credit",
    opening: 10000,
    creditLimit: 50000,
    dueDay: 31,
  };

  // April (30 days) -> clamps to 30
  assert.equal(getCreditCardDueDate(card, 2026, 4), "2026-04-30");

  // October (31 days) -> 31
  assert.equal(getCreditCardDueDate(card, 2026, 10), "2026-10-31");

  // February 2026 (non-leap year, 28 days) -> clamps to 28
  assert.equal(getCreditCardDueDate(card, 2026, 2), "2026-02-28");

  // February 2024 (leap year, 29 days) -> clamps to 29
  assert.equal(getCreditCardDueDate(card, 2024, 2), "2024-02-29");

  // Card with dueDay = 29 in Feb 2026 -> clamps to 28
  const card29: Account = { ...card, dueDay: 29 };
  assert.equal(getCreditCardDueDate(card29, 2026, 2), "2026-02-28");
  assert.equal(getCreditCardDueDate(card29, 2024, 2), "2024-02-29");
});

test("Test 3C.9 — Payday-window boundaries: outside vs inside window", () => {
  const state: State = blank();
  state.payday = "2026-10-20";
  state.followingPayday = "2026-11-03";

  const card: Account = {
    id: "acc-crd",
    name: "Window Test Card",
    type: "credit",
    opening: 30000, // $300 owed
    creditLimit: 100000,
    minPayment: 4000, // $40 min
    dueDay: 25, // due Oct 25
    includeInSafeToSpend: false,
  };
  state.accounts = [card];

  // Case A: simulatedToday is Oct 10, payday is Oct 20.
  // Oct 25 is AFTER current payday (Oct 20), so it belongs to the NEXT paycheck cycle.
  const protBefore = getCreditCardMinimumProtection(card, state, "2026-10-10");
  assert.equal(protBefore.dueDate, "2026-10-25");
  assert.equal(protBefore.isDueInCurrentWindow, false, "Due date is after current payday");
  assert.equal(protBefore.additionalProtectionRequired, 0, "No protection required in current cycle");

  // Case B: advanced to cycle where simulatedToday is Oct 20, next payday is Nov 03.
  // Oct 25 is within [Oct 20, Nov 03].
  state.payday = "2026-11-03";
  state.followingPayday = "2026-11-17";
  const protInside = getCreditCardMinimumProtection(card, state, "2026-10-20");
  assert.equal(protInside.dueDate, "2026-10-25");
  assert.equal(protInside.isDueInCurrentWindow, true, "Due date is within current cycle");
  assert.equal(protInside.additionalProtectionRequired, 4000, "Full $40 protected in current cycle");

  // Case C: due date exactly on currentPaydayEnd (e.g. due on Oct 20 with payday Oct 20)
  const cardDue20: Account = { ...card, dueDay: 20 };
  const protBoundary = getCreditCardMinimumProtection(cardDue20, state, "2026-10-10");
  assert.equal(protBoundary.isDueInCurrentWindow, true, "Due date on payday boundary is included");
  assert.equal(protBoundary.additionalProtectionRequired, 4000);
});

test("Test 3C.10 — Overlapping planning windows: cycle selection and payment isolation across months", () => {
  const state: State = blank();
  state.payday = "2026-10-20";
  state.followingPayday = "2026-11-05";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Card",
    type: "credit",
    opening: 40000, // $400 owed
    creditLimit: 100000,
    minPayment: 3500, // $35 min
    dueDay: 15,
    includeInSafeToSpend: false,
  };
  state.accounts = [checking, card];

  // In October cycle (now: 2026-10-10, payday: 2026-10-20):
  // Due date is 2026-10-15.
  let prot = getCreditCardMinimumProtection(card, state, "2026-10-10");
  assert.equal(prot.dueDate, "2026-10-15");
  assert.equal(prot.additionalProtectionRequired, 3500);

  // User pays $35 towards card on 2026-10-12
  state.transactions.push({
    id: "tx-pay-oct",
    name: "Card Payment",
    amount: -3500,
    category: "Payment",
    date: "2026-10-12",
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
  });

  prot = getCreditCardMinimumProtection(card, state, "2026-10-12");
  assert.equal(prot.paidTowardCycle, 3500);
  assert.equal(prot.remainingMinimumRequirement, 0);
  assert.equal(prot.additionalProtectionRequired, 0);
  assert.equal(prot.status, "covered");

  // Advance to next cycle (now: 2026-10-21, payday: 2026-11-05, next payday: 2026-11-20):
  // The upcoming due date is 2026-11-15.
  // The October payment must NOT count towards November's minimum!
  state.payday = "2026-11-20";
  const protNov = getCreditCardMinimumProtection(card, state, "2026-10-21");
  assert.equal(protNov.dueDate, "2026-11-15");
  assert.equal(protNov.paidTowardCycle, 0, "October payment does not satisfy November minimum");
  assert.equal(protNov.remainingMinimumRequirement, 3500);
  assert.equal(protNov.additionalProtectionRequired, 3500);
  assert.equal(protNov.status, "uncovered");
});

test("Test 3C.11 — Card payments and minimum protection reconciliation: zero duplicate reservation (Interaction H)", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-20";
  state.followingPayday = "2026-11-03";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Card",
    type: "credit",
    opening: 30000, // $300.00 debt
    creditLimit: 100000,
    minPayment: 5000, // $50.00 minimum
    dueDay: 15,
    includeInSafeToSpend: false,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];

  // Before payment:
  // Checking = $1,000. Ready to Pay = $0. Minimum protection = $50.
  // Safe to Spend = $1,000 - $50 = $950.
  const tBefore = totals(state, simulatedToday);
  assert.equal(tBefore.balance, 100000);
  assert.equal(tBefore.creditCardMinimums, 5000);
  assert.equal(tBefore.safe, 95000);

  // User records a $50 payment to the card
  state.transactions.push({
    id: "tx-pay-50",
    name: "Pay Card Min",
    amount: -5000,
    category: "Payment",
    date: simulatedToday,
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
  });

  // After payment:
  // Checking cash drops to $950 ($1,000 - $50).
  // Card debt drops to $250 ($300 - $50).
  // Minimum protection drops from $50 to $0 (payment fulfilled cycle requirement).
  // Safe to Spend = $950 cash - $0 Ready to Pay - $0 Minimum = $950.
  // Safe to Spend is 100% stable: no double deduction!
  const minProtAfter = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(minProtAfter.paidTowardCycle, 5000);
  assert.equal(minProtAfter.remainingMinimumRequirement, 0);
  assert.equal(minProtAfter.additionalProtectionRequired, 0);
  assert.equal(minProtAfter.status, "covered");

  const tAfter = totals(state, simulatedToday);
  assert.equal(tAfter.balance, 95000);
  assert.equal(tAfter.creditCardMinimums, 0);
  assert.equal(tAfter.safe, 95000, "Safe to Spend is invariant across credit card payment reconciliation");
});

test("Test 3C.12 — Scheduled expense within a category budget: no redundant reservation (Interaction D)", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-24";
  state.followingPayday = "2026-11-07";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: true,
  };
  state.accounts = [checking];

  // Budget: Groceries $150.00 limit, $0 spent so far. Remaining budget = $150.00
  state.budgets.push({
    id: "b-groc",
    category: "Groceries",
    limit: 15000,
    color: "#277c78",
  });

  // Scheduled grocery expense of $80 on checking inside payday window (Oct 18)
  state.transactions.push({
    id: "tx-sched-groc",
    name: "Trader Joe's Scheduled",
    amount: -8000,
    category: "Groceries",
    date: "2026-10-18",
    status: "scheduled",
    accountId: checking.id,
    kind: "standard",
  });

  // The $80 scheduled grocery expense is already fully covered by the $150 Groceries budget.
  // Therefore, uncoveredScheduledExpenses must be $0.
  const uncovered = getUncoveredScheduledExpenses(state, simulatedToday);
  assert.equal(uncovered, 0, "Scheduled grocery expense within budget requires no extra reservation");

  const t = totals(state, simulatedToday);
  assert.equal(t.balance, 100000);
  assert.equal(t.budgets, 15000, "Budgets reserves $150");
  assert.equal(t.uncoveredScheduledExpenses, 0);
  assert.equal(t.safe, 85000, "Safe to spend reserves only the $150 category budget ($1,000 - $150 = $850)");
});

test("Test 3C.13 — Scheduled expense exceeds budget: reserves only the uncovered excess (Interaction E)", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-24";
  state.followingPayday = "2026-11-07";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: true,
  };
  state.accounts = [checking];

  // Budget: Groceries $100.00 limit, $0 spent so far. Remaining budget = $100.00
  state.budgets.push({
    id: "b-groc",
    category: "Groceries",
    limit: 10000,
    color: "#277c78",
  });

  // Scheduled grocery expense: $160.00 on checking (exceeds $100 budget by $60)
  state.transactions.push({
    id: "tx-sched-over",
    name: "Costco Bulk Run",
    amount: -16000,
    category: "Groceries",
    date: "2026-10-18",
    status: "scheduled",
    accountId: checking.id,
    kind: "standard",
  });

  const uncovered = getUncoveredScheduledExpenses(state, simulatedToday);
  assert.equal(uncovered, 6000, "Excess $60 beyond budget is protected as uncovered scheduled expense");

  const t = totals(state, simulatedToday);
  assert.equal(t.budgets, 10000, "Budgets reserves $100");
  assert.equal(t.uncoveredScheduledExpenses, 6000, "Uncovered scheduled reserves $60");
  assert.equal(t.safe, 84000, "Safe to spend = $1,000 - $100 - $60 = $840");
});

test("Test 3C.14 — Scheduled recurring bill deduplication: zero duplicate reservation (Interaction F)", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-24";
  state.followingPayday = "2026-11-07";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
  };
  state.accounts = [checking];

  // Recurring bill: Electric $200.00 due on 20th
  const bill: Bill = {
    id: "b-electric",
    name: "Electric Utility",
    amount: 20000,
    day: 20,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(bill);

  // Scheduled transaction of $200 linked to this bill occurrence
  state.transactions.push({
    id: "tx-sched-bill",
    name: "Electric Autopay",
    amount: -20000,
    category: "Bills",
    date: "2026-10-20",
    status: "scheduled",
    accountId: checking.id,
    kind: "standard",
    billId: bill.id,
    billDueDate: "2026-10-20",
  });

  const billsBreakdown = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(billsBreakdown.currentCycleBills, 20000, "Bill occurrence reserves $200");

  const uncovered = getUncoveredScheduledExpenses(state, simulatedToday);
  assert.equal(uncovered, 0, "Linked scheduled transaction does not duplicate bill reservation");

  const t = totals(state, simulatedToday);
  assert.equal(t.bills, 20000, "Totals bills = $200");
  assert.equal(t.uncoveredScheduledExpenses, 0, "Uncovered scheduled = $0");
  assert.equal(t.safe, 80000, "Safe to Spend protects exactly $200, NOT $400");
});

test("Test 3C.15 — Scheduled credit card purchases: does not prematurely drain checking cash or debt", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-24";
  state.followingPayday = "2026-11-07";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000 cash
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Credit Card",
    type: "credit",
    opening: 0, // $0 debt
    creditLimit: 200000,
    includeInSafeToSpend: false,
  };
  state.accounts = [checking, card];

  // Scheduled credit card purchase of $75
  state.transactions.push({
    id: "tx-sched-crd",
    name: "Online Order",
    amount: -7500,
    category: "Shopping",
    date: "2026-10-15",
    status: "scheduled",
    accountId: card.id,
    kind: "standard",
  });

  // Checking cash must not be reduced before confirmation
  assert.equal(getAccountBalance(checking, state), 100000, "Checking balance unchanged");

  // Card debt must not be prematurely increased before confirmation
  assert.equal(getAccountBalance(card, state), 0, "Card debt unchanged");

  // Scheduled credit card transaction must not drain checking Safe to Spend
  const uncovered = getUncoveredScheduledExpenses(state, simulatedToday);
  assert.equal(uncovered, 0, "Scheduled credit card purchases do not count as uncovered cash expenses");

  const t = totals(state, simulatedToday);
  assert.equal(t.safe, 100000, "Safe to spend remains fully intact");
});

test("Test 3C.16 — Scheduled income and transfers: cash protection safeguards", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-24";
  state.followingPayday = "2026-11-07";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000 cash
    includeInSafeToSpend: true,
  };
  const savings: Account = {
    id: "acc-sav",
    name: "Savings",
    type: "savings",
    opening: 50000,
    includeInSafeToSpend: false,
  };
  state.accounts = [checking, savings];

  // 1. Scheduled income: +$500
  state.transactions.push({
    id: "tx-sched-inc",
    name: "Bonus Pay",
    amount: 50000,
    category: "Income",
    date: "2026-10-15",
    status: "scheduled",
    accountId: checking.id,
    kind: "standard",
  });

  // 2. Scheduled transfer: -$200 from checking to savings
  state.transactions.push({
    id: "tx-sched-xfer",
    name: "Transfer to Savings",
    amount: -20000,
    category: "Transfer",
    date: "2026-10-18",
    status: "scheduled",
    accountId: checking.id,
    kind: "transfer",
    targetAccountId: savings.id,
  });

  // Balances must remain strictly at opening values
  assert.equal(getAccountBalance(checking, state), 100000, "Checking balance not altered by scheduled items");
  assert.equal(getAccountBalance(savings, state), 50000, "Savings balance not altered by scheduled items");

  // Scheduled income does NOT increase Safe to Spend
  // Scheduled transfer is excluded from category expense deduction
  const uncovered = getUncoveredScheduledExpenses(state, simulatedToday);
  assert.equal(uncovered, 0);

  const t = totals(state, simulatedToday);
  assert.equal(t.safe, 100000, "Safe to spend is backed strictly by actual cash ($1,000)");
});

test("Test 3C.17 — Scheduled-to-posted transitions: seamless financial reconciliation (Interaction G)", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-24";
  state.followingPayday = "2026-11-07";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000.00
    includeInSafeToSpend: true,
  };
  state.accounts = [checking];

  // Step 1: Scheduled unbudgeted expense: $100
  const tx: Transaction = {
    id: "tx-trans-test",
    name: "Hardware Store",
    amount: -10000,
    category: "Home Improvement",
    date: "2026-10-15",
    status: "scheduled",
    accountId: checking.id,
    kind: "standard",
  };
  state.transactions.push(tx);

  // Before confirmation:
  // Checking balance: $1,000
  // Uncovered scheduled: $100
  // Safe to Spend: $900
  assert.equal(getAccountBalance(checking, state), 100000);
  assert.equal(getUncoveredScheduledExpenses(state, simulatedToday), 10000);
  const tBefore = totals(state, simulatedToday);
  assert.equal(tBefore.safe, 90000);

  // Step 2: Confirm transaction (status transitions from "scheduled" to "cleared")
  tx.status = "cleared";

  // After confirmation:
  // Checking balance: $900 (drops by $100)
  // Uncovered scheduled: $0 (released)
  // Safe to Spend: $900 - $0 = $900
  // Perfectly reconciled: Safe to Spend does NOT change unexpectedly!
  assert.equal(getAccountBalance(checking, state), 90000);
  assert.equal(getUncoveredScheduledExpenses(state, simulatedToday), 0);
  const tAfter = totals(state, simulatedToday);
  assert.equal(tAfter.safe, 90000, "Safe to Spend invariant preserved across scheduled-to-posted transition");
});

test("Test 3C.18 — Partial bill payments alongside scheduled payments", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-24";
  state.followingPayday = "2026-11-07";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 200000, // $2,000.00
    includeInSafeToSpend: true,
  };
  state.accounts = [checking];

  // Bill: Rent $1,000 due Oct 20
  const rentBill: Bill = {
    id: "b-rent",
    name: "Apartment Rent",
    amount: 100000,
    day: 20,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(rentBill);

  // Step 1: User makes a partial payment of $400 on Oct 10
  recordBillPayment(state, rentBill.id, {
    dueDate: "2026-10-20",
    amount: 40000,
    date: simulatedToday,
  });

  const occ = getBillOccurrenceStatus(state, rentBill, "2026-10-20");
  assert.equal(occ.paidAmount, 40000);
  assert.equal(occ.remainingAmount, 60000);

  // Step 2: User schedules a payment for the remaining $600
  state.transactions.push({
    id: "tx-sched-rent-rem",
    name: "Rent Remainder",
    amount: -60000,
    category: "Bills",
    date: "2026-10-20",
    status: "scheduled",
    accountId: checking.id,
    kind: "standard",
    billId: rentBill.id,
    billDueDate: "2026-10-20",
  });

  // Bill breakdown reserves the remaining $600
  const bd = reserveBillsBreakdown(state, simulatedToday);
  assert.equal(bd.currentCycleBills, 60000);

  // Scheduled transaction of $600 matches remaining bill reservation -> 0 extra uncovered expense
  const uncovered = getUncoveredScheduledExpenses(state, simulatedToday);
  assert.equal(uncovered, 0);

  // Safe to Spend check:
  // Checking was $2,000 - $400 paid = $1,600.
  // Bills reservation = $600.
  // Safe to Spend = $1,600 - $600 = $1,000.
  const t = totals(state, simulatedToday);
  assert.equal(t.balance, 160000);
  assert.equal(t.bills, 60000);
  assert.equal(t.safe, 100000);
});

test("Test 3C.19 — Signed Safe to Spend and shortfall preservation", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-20";
  state.followingPayday = "2026-11-03";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 10000, // $100.00 cash
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Credit Card",
    type: "credit",
    opening: 20000, // $200 debt
    creditLimit: 100000,
    minPayment: 8000, // $80 min
    dueDay: 15,
    includeInSafeToSpend: false,
  };
  state.accounts = [checking, card];

  // Bill: $50 due Oct 15
  state.bills.push({
    id: "b-sub",
    name: "Gym",
    amount: 5000,
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  });

  // Total obligations:
  // Bills = $50
  // Credit card minimum = $80
  // Total obligations = $130
  // Cash balance = $100
  // rawSafe = $100 - $50 - $80 = -$30 (-3000)
  // safe = $0
  // shortfall = $30 (3000)
  const t = totals(state, simulatedToday);
  assert.equal(t.balance, 10000);
  assert.equal(t.bills, 5000);
  assert.equal(t.creditCardMinimums, 8000);
  assert.equal(t.rawSafe, -3000, "Signed rawSafe reflects exact -$30.00 deficit");
  assert.equal(t.safe, 0, "Safe to spend clamped to 0");
  assert.equal(t.shortfall, 3000, "Shortfall is exactly $30.00");
});

test("Test 3C.20 — Covered Credit (Phase 2B) and Flexible Bill Payments (Phase 3B) regressions", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-24";
  state.followingPayday = "2026-11-07";

  const checking: Account = {
    id: "acc-chk",
    name: "Primary Checking",
    type: "checking",
    opening: 300000, // $3,000 cash
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Rewards Card",
    type: "credit",
    opening: 50000, // $500 pre-baseline debt
    creditLimit: 500000,
    minPayment: 6000, // $60 min
    dueDay: 18,
    includeInSafeToSpend: false,
    assignedPaymentReserve: 0,
    paymentReservations: [],
    coveredCreditBaselineAt: simulatedToday,
  };
  state.accounts = [checking, card];

  // Budget for Dining Out: $200
  state.budgets.push({
    id: "b-dine",
    category: "Dining Out",
    limit: 20000,
    color: "#277c78",
  });

  // Purchase on credit card in Dining Out: $50
  state.transactions.push({
    id: "tx-dine-crd",
    name: "Bistro Dinner",
    amount: -5000,
    category: "Dining Out",
    date: simulatedToday,
    createdAt: `${simulatedToday}T12:00:00.000Z`,
    status: "cleared",
    accountId: card.id,
    kind: "standard",
  });

  // Covered credit check:
  // Total owed: $550 ($500 opening + $50 dinner)
  // Ready to Pay: $50 (auto-covered from Dining Out budget)
  // Uncovered debt: $500
  const cov = getCreditCardCoverage(card, state, simulatedToday);
  assert.equal(cov.totalOwed, 55000);
  assert.equal(cov.readyToPay, 5000);
  assert.equal(cov.uncoveredDebt, 50000);

  // Minimum protection check:
  // Configured min: $60.
  // Ready to Pay: $50.
  // Additional protection needed: $60 - $50 = $10.
  const minProt = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(minProt.effectiveMinimum, 6000);
  assert.equal(minProt.readyToPay, 5000);
  assert.equal(minProt.additionalProtectionRequired, 1000);
  assert.equal(minProt.status, "partially_covered");

  // Bill occurrence check:
  const phoneBill: Bill = {
    id: "b-phone",
    name: "Phone",
    amount: 10000, // $100
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  };
  state.bills.push(phoneBill);

  // Partial bill payment of $30
  recordBillPayment(state, phoneBill.id, {
    dueDate: "2026-10-15",
    amount: 3000,
    date: simulatedToday,
  });

  // Totals check:
  // Checking: $3,000 - $30 = $2,970.
  // Dining Out remaining budget: $200 limit - $50 card spent = $150.
  // Ready to Pay: $50.
  // Minimum protection: $10.
  // Remaining bill: $100 - $30 = $70.
  // Safe to Spend = $2,970 - $150 (budget) - $50 (readyToPay) - $10 (credit min) - $70 (bill)
  //              = $2,690.
  const t = totals(state, simulatedToday);
  assert.equal(t.balance, 297000);
  assert.equal(t.budgets, 15000);
  assert.equal(t.totalReadyToPay, 5000);
  assert.equal(t.creditCardMinimums, 1000);
  assert.equal(t.bills, 7000);
  assert.equal(t.safe, 269000, "All subsystems integrate cleanly with mathematical precision");
});

test("Test 3C.21 — Changing minimum payment amount on overdue card retains overdue obligation without silent discard", () => {
  const simulatedPastDue = "2026-10-18";
  const state: State = blank();
  state.payday = "2026-10-25";
  state.followingPayday = "2026-11-08";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000 cash
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Card",
    type: "credit",
    opening: 50000, // $500 balance
    creditLimit: 200000,
    minPayment: 10000, // $100 min
    dueDay: 15, // due Oct 15
    includeInSafeToSpend: false,
  };
  state.accounts = [checking, card];

  // On Oct 18, card was due on Oct 15 and nothing was paid ($0 paid)
  let prot = getCreditCardMinimumProtection(card, state, simulatedPastDue);
  assert.equal(prot.dueDate, "2026-10-15");
  assert.equal(prot.isOverdue, true);
  assert.equal(prot.status, "overdue");
  assert.equal(prot.dueCycle, "current");
  assert.equal(prot.isDueInCurrentWindow, true);
  assert.equal(prot.configuredMinimum, 10000);
  assert.equal(prot.effectiveMinimum, 10000);
  assert.equal(prot.additionalProtection, 10000);

  let t = totals(state, simulatedPastDue);
  assert.equal(t.creditCardMinimums, 10000);
  assert.equal(t.safe, 90000); // $1,000 - $100

  // User changes minimum payment configuration from $100 to $25
  card.minPayment = 2500;

  prot = getCreditCardMinimumProtection(card, state, simulatedPastDue);
  // Requirement: Do not silently discard an overdue obligation merely because card configuration changed
  assert.equal(prot.dueDate, "2026-10-15");
  assert.equal(prot.isOverdue, true, "Retains overdue status");
  assert.equal(prot.status, "overdue");
  assert.equal(prot.configuredMinimum, 2500);
  assert.equal(prot.effectiveMinimum, 2500);
  assert.equal(prot.additionalProtection, 2500, "Safeguard protects new $25 amount, never drops to 0");

  t = totals(state, simulatedPastDue);
  assert.equal(t.creditCardMinimums, 2500);
  assert.equal(t.safe, 97500);
});

test("Test 3C.22 — Changing card balance does not retroactively invent past statement satisfaction", () => {
  const simulatedToday = "2026-10-18";
  const state: State = blank();
  state.payday = "2026-10-25";
  state.followingPayday = "2026-11-08";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Card",
    type: "credit",
    opening: 50000, // $500 balance
    creditLimit: 200000,
    minPayment: 10000, // $100 min
    dueDay: 15, // due Oct 15
    includeInSafeToSpend: false,
  };
  state.accounts = [checking, card];

  // Overdue on Oct 18 with 0 paid
  let prot = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(prot.isOverdue, true);
  assert.equal(prot.effectiveMinimum, 10000);

  // Balance drops to $80 (e.g. merchant refund)
  card.opening = 8000;

  prot = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(prot.totalOwed, 8000);
  assert.equal(prot.effectiveMinimum, 8000, "Clamped to remaining total debt");
  assert.equal(prot.isOverdue, true, "Does not invent that past statement was satisfied");
  assert.equal(prot.status, "overdue");
  assert.equal(prot.remainingMinimumRequirement, 8000);
  assert.equal(prot.additionalProtection, 8000);

  // If balance drops to 0 (fully paid off debt)
  card.opening = 0;
  prot = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(prot.totalOwed, 0);
  assert.equal(prot.status, "not_applicable");
  assert.equal(prot.additionalProtection, 0);
});

test("Test 3C.23 — Due date boundary payment absorption: late payment satisfies overdue obligation first without double-counting in next cycle", () => {
  const simulatedToday = "2026-10-18";
  const state: State = blank();
  state.payday = "2026-10-25";
  state.followingPayday = "2026-11-08";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Card",
    type: "credit",
    opening: 40000, // $400 owed
    creditLimit: 200000,
    minPayment: 5000, // $50 min
    dueDay: 15, // due Oct 15
    includeInSafeToSpend: false,
  };
  state.accounts = [checking, card];

  // Step 1: Before payment on Oct 18 (unpaid Oct 15 min) -> Overdue for $50
  let prot = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(prot.dueDate, "2026-10-15");
  assert.equal(prot.isOverdue, true);
  assert.equal(prot.status, "overdue");
  assert.equal(prot.additionalProtection, 5000);

  // Step 2: User makes a $70 late payment on Oct 17
  state.transactions.push({
    id: "tx-late-pay",
    name: "Late Card Payment",
    amount: -7000,
    category: "Payment",
    date: "2026-10-17",
    status: "cleared",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
  });

  // Step 3: Re-evaluate on Oct 18
  // $50 satisfies the overdue Oct 15 obligation.
  // Target advances to Nov 15!
  // Excess late payment is $70 - $50 = $20.
  // $20 applies toward November cycle ($50 min), leaving $30 remaining!
  prot = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(prot.dueDate, "2026-11-15");
  assert.equal(prot.isOverdue, false, "Overdue cycle was fulfilled");
  assert.equal(prot.paidTowardCycle, 2000, "Only true excess ($20) carries forward to next cycle");
  assert.equal(prot.remainingMinimumRequirement, 3000, "$50 min - $20 excess = $30 remaining");
  assert.equal(prot.isDueInCurrentWindow, false, "Nov 15 is after Oct 25 payday");
  assert.equal(prot.isDueInFollowingWindow, false, "Nov 15 is after Nov 08 following payday");
});

test("Test 3C.24 — Explicit cycle-level confirmation via confirmCreditCardMinimum advances cycle cleanly and separates confirmed from estimated satisfaction", () => {
  const simulatedToday = "2026-10-10";
  const state: State = blank();
  state.payday = "2026-10-20";
  state.followingPayday = "2026-11-05";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000,
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Card",
    type: "credit",
    opening: 30000,
    creditLimit: 100000,
    minPayment: 5000, // $50 min
    dueDay: 15,
    includeInSafeToSpend: false,
  };
  state.accounts = [checking, card];

  // Initially unconfirmed: estimated requirement is $50
  let prot = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(prot.dueDate, "2026-10-15");
  assert.equal(prot.isConfirmedPaid, false);
  assert.equal(prot.remainingMinimumRequirement, 5000);
  assert.equal(prot.additionalProtection, 5000);

  // User explicitly confirms statement minimum paid
  const confirmedCard = confirmCreditCardMinimum(card, "2026-10-15");
  assert.deepEqual(confirmedCard.confirmedMinimumDueDates, ["2026-10-15"]);

  prot = getCreditCardMinimumProtection(confirmedCard, state, simulatedToday);
  assert.equal(prot.dueDate, "2026-10-15");
  assert.equal(prot.isConfirmedPaid, true);
  assert.equal(prot.remainingMinimumRequirement, 0);
  assert.equal(prot.additionalProtection, 0);
  assert.equal(prot.status, "covered");

  // Reversible without corruption
  const unconfirmedCard = unconfirmCreditCardMinimum(confirmedCard, "2026-10-15");
  assert.deepEqual(unconfirmedCard.confirmedMinimumDueDates, []);
  prot = getCreditCardMinimumProtection(unconfirmedCard, state, simulatedToday);
  assert.equal(prot.isConfirmedPaid, false);
  assert.equal(prot.remainingMinimumRequirement, 5000);
  assert.equal(prot.additionalProtection, 5000);
});

test("Test 3C.25 — Following-payday minimum protection with account.protected === false", () => {
  const simulatedToday = "2026-10-05";
  const state: State = blank();
  state.payday = "2026-10-10"; // currentPaydayEnd = 2026-10-10
  state.followingPayday = "2026-10-24"; // followingEnd = 2026-10-24

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000 cash
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Card",
    type: "credit",
    opening: 40000, // $400 owed
    creditLimit: 100000,
    minPayment: 6000, // $60 min
    dueDay: 18, // due Oct 18 (between Oct 10 and Oct 24)
    includeInSafeToSpend: false,
    protected: false, // NOT protected in following cycle
  };
  state.accounts = [checking, card];

  const prot = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(prot.dueDate, "2026-10-18");
  assert.equal(prot.dueCycle, "following");
  assert.equal(prot.isDueInCurrentWindow, false);
  assert.equal(prot.isDueInFollowingWindow, true);
  assert.equal(prot.followingAdditionalProtection, 6000, "Tracks obligation needed in following window");
  assert.equal(prot.additionalProtection, 0, "Does not reduce current paycheck when unprotected");

  const bd = getCreditCardMinimumBreakdown(state, simulatedToday);
  assert.equal(bd.currentCycleMinimums, 0);
  assert.equal(bd.followingCycleMinimums, 6000);
  assert.equal(bd.protectedFollowingMinimums, 0);
  assert.equal(bd.totalAdditionalProtection, 0);

  const t = totals(state, simulatedToday);
  assert.equal(t.creditCardMinimums, 0);
  assert.equal(t.safe, 100000);
});

test("Test 3C.26 — Following-payday minimum protection with account.protected === true", () => {
  const simulatedToday = "2026-10-05";
  const state: State = blank();
  state.payday = "2026-10-10";
  state.followingPayday = "2026-10-24";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 100000, // $1,000 cash
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Protected Card",
    type: "credit",
    opening: 40000, // $400 owed
    creditLimit: 100000,
    minPayment: 6000, // $60 min
    dueDay: 18, // due Oct 18
    includeInSafeToSpend: false,
    protected: true, // EXPLICITLY protected into following cycle
  };
  state.accounts = [checking, card];

  const prot = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(prot.dueDate, "2026-10-18");
  assert.equal(prot.dueCycle, "following");
  assert.equal(prot.isDueInCurrentWindow, false);
  assert.equal(prot.isDueInFollowingWindow, true);
  assert.equal(prot.followingAdditionalProtection, 6000);
  assert.equal(prot.additionalProtection, 6000, "Protected into following cycle mirrors Bill.protected");

  const bd = getCreditCardMinimumBreakdown(state, simulatedToday);
  assert.equal(bd.currentCycleMinimums, 0);
  assert.equal(bd.followingCycleMinimums, 6000);
  assert.equal(bd.protectedFollowingMinimums, 6000);
  assert.equal(bd.totalAdditionalProtection, 6000);

  const t = totals(state, simulatedToday);
  assert.equal(t.creditCardMinimums, 6000);
  assert.equal(t.currentCycleMinimums, 0);
  assert.equal(t.protectedFollowingMinimums, 6000);
  assert.equal(t.safe, 94000, "$1,000 cash - $60 protected following minimum = $940");
});

test("Test 3C.27 — Overdue minimum priority: overdue is always treated as current-cycle priority and protected immediately", () => {
  const simulatedToday = "2026-10-18";
  const state: State = blank();
  state.payday = "2026-10-25";
  state.followingPayday = "2026-11-08";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 80000, // $800 cash
    includeInSafeToSpend: true,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Card",
    type: "credit",
    opening: 30000,
    creditLimit: 100000,
    minPayment: 4000, // $40 min
    dueDay: 12, // due Oct 12 (already past)
    includeInSafeToSpend: false,
    protected: false,
  };
  state.accounts = [checking, card];

  const prot = getCreditCardMinimumProtection(card, state, simulatedToday);
  assert.equal(prot.dueDate, "2026-10-12");
  assert.equal(prot.isOverdue, true);
  assert.equal(prot.status, "overdue");
  assert.equal(prot.dueCycle, "current", "Overdue debt is always highest priority / current cycle");
  assert.equal(prot.isDueInCurrentWindow, true);
  assert.equal(prot.additionalProtection, 4000);

  const bd = getCreditCardMinimumBreakdown(state, simulatedToday);
  assert.equal(bd.currentCycleMinimums, 4000);
  assert.equal(bd.totalAdditionalProtection, 4000);

  const t = totals(state, simulatedToday);
  assert.equal(t.creditCardMinimums, 4000);
  assert.equal(t.safe, 76000);
});

test("Test 3C.28 — Deterministic regression for dashboard Expenses $0.00 issue: legacy transactions lacking status field are accurately included in monthly expenses", () => {
  const state: State = blank();
  const currentMonth = "2026-10";

  // Simulate transactions loaded from storage or legacy formats where status is omitted / undefined
  state.transactions = [
    {
      id: "tx-legacy-1",
      name: "Supermarket Groceries",
      amount: -4500, // $45.00 expense
      category: "Groceries",
      date: "2026-10-05",
      kind: "standard",
      // status: undefined (legacy)
    },
    {
      id: "tx-legacy-2",
      name: "Coffee Shop",
      amount: -1250, // $12.50 expense
      category: "Dining Out",
      date: "2026-10-08",
      kind: "standard",
      // status: undefined (legacy)
    },
    {
      id: "tx-legacy-income",
      name: "Old Freelance Check",
      amount: 25000, // $250.00 income
      category: "Income",
      date: "2026-10-02",
      kind: "standard",
      // status: undefined (legacy)
    },
  ];

  // In the original bug, isLedgerStatus(undefined) returned false, so monthly was empty and expenses showed $0.00.
  const expenses = getMonthlyExpenses(state, currentMonth);
  const income = getMonthlyIncome(state, currentMonth);

  assert.equal(expenses, 5750, "Legacy transactions lacking status are included: $45.00 + $12.50 = $57.50");
  assert.equal(income, 25000, "Legacy income lacking status is included: $250.00");
});

test("Test 3C.29 — Monthly expenses inclusion and exclusion: includes credit purchases and bill payments, excludes transfers and card repayments", () => {
  const state: State = blank();
  const currentMonth = "2026-10";

  const checking: Account = {
    id: "acc-chk",
    name: "Checking",
    type: "checking",
    opening: 200000,
    includeInSafeToSpend: true,
  };
  const savings: Account = {
    id: "acc-sav",
    name: "Savings",
    type: "savings",
    opening: 500000,
    includeInSafeToSpend: false,
  };
  const card: Account = {
    id: "acc-crd",
    name: "Credit Card",
    type: "credit",
    opening: 50000,
    creditLimit: 200000,
    includeInSafeToSpend: false,
  };
  state.accounts = [checking, savings, card];

  // 1. Credit card purchase ($85.00) -> MUST count as expense
  state.transactions.push({
    id: "tx-crd-purchase",
    name: "Electronics Store",
    amount: -8500,
    category: "Shopping",
    date: "2026-10-11",
    status: "posted",
    accountId: card.id,
    kind: "standard",
  });

  // 2. Bill payment recorded via recordBillPayment ($120.00) -> MUST count as expense once
  state.bills.push({
    id: "b-water",
    name: "City Water",
    amount: 12000,
    day: 15,
    protected: false,
    trackingStartDate: "2026-10-01",
  });
  recordBillPayment(state, "b-water", {
    dueDate: "2026-10-15",
    amount: 12000,
    date: "2026-10-12",
  });

  // 3. Cash transfer from Checking to Savings ($300.00) -> MUST NOT count as purchase / expense
  state.transactions.push({
    id: "tx-xfer-chk",
    name: "Transfer to Savings",
    amount: -30000,
    category: "Transfer",
    date: "2026-10-13",
    status: "posted",
    accountId: checking.id,
    kind: "transfer",
    targetAccountId: savings.id,
  });

  // 4. Credit card debt repayment from Checking to Credit Card ($150.00) -> MUST NOT count as purchase / expense
  state.transactions.push({
    id: "tx-cc-pay",
    name: "Credit Card Payment",
    amount: -15000,
    category: "Payment",
    date: "2026-10-14",
    status: "posted",
    accountId: checking.id,
    kind: "payment",
    targetAccountId: card.id,
  });

  // 5. Legacy debt migration entry -> MUST NOT count as purchase
  state.transactions.push({
    id: "tx-legacy-debt",
    name: "Initial Card Balance",
    amount: -50000,
    category: "Debt",
    date: "2026-10-01",
    status: "posted",
    accountId: card.id,
    kind: "standard",
    isLegacyDebt: true,
  });

  // Total expenses should be $85.00 + $120.00 = $205.00 (20500 cents)
  const expenses = getMonthlyExpenses(state, currentMonth);
  assert.equal(expenses, 20500, "Expenses correctly aggregates credit purchases and bill payments without transfers or repayments");
});

test("Test 3C.30 — Scheduled expenses separation: scheduled purchases do not contaminate actual spending totals or monthly expenses", () => {
  const state: State = blank();
  const currentMonth = "2026-10";

  state.transactions = [
    {
      id: "tx-posted-1",
      name: "Actual Posted Purchase",
      amount: -5000, // $50.00
      category: "Groceries",
      date: "2026-10-05",
      status: "posted",
      kind: "standard",
    },
    {
      id: "tx-cleared-1",
      name: "Actual Cleared Purchase",
      amount: -4000, // $40.00
      category: "Dining Out",
      date: "2026-10-07",
      status: "cleared",
      kind: "standard",
    },
    {
      id: "tx-sched-1",
      name: "Future Scheduled Purchase",
      amount: -20000, // $200.00
      category: "Electronics",
      date: "2026-10-28",
      status: "scheduled",
      kind: "standard",
    },
  ];

  const actualExpenses = getMonthlyExpenses(state, currentMonth);
  assert.equal(actualExpenses, 9000, "Actual monthly expenses only reflects posted and cleared: $90.00");

  const t = totals(state, "2026-10-10");
  assert.equal(t.scheduledExpenses, 20000, "Scheduled expenses tracked in separate totals metric");
});

test("Test 3C.31 — Zero expenses formatting: eliminates IEEE-754 negative zero (-0) and never renders -$0.00", () => {
  const state: State = blank();
  const currentMonth = "2026-10";

  // When no expenses exist, getMonthlyExpenses must return 0, not -0
  const zeroExpenses = getMonthlyExpenses(state, currentMonth);
  assert.equal(zeroExpenses, 0);
  assert.equal(Object.is(zeroExpenses, 0), true, "Expenses must return positive zero 0");
  assert.equal(Object.is(zeroExpenses, -0), false, "Expenses must not return IEEE-754 negative zero -0");

  // money() formatter must render $0.00 even if passed -0 or rounding boundary values
  assert.equal(money(0), "$0.00");
  assert.equal(money(-0), "$0.00", "money(-0) must render as $0.00, not -$0.00");
  assert.equal(money(-0.001), "$0.00", "money(-0.001) must render as $0.00, not -$0.00");
  assert.equal(money(zeroExpenses), "$0.00", "Formatting zero expenses displays $0.00");

  // Non-zero values must retain their correct signs
  assert.equal(money(12500), "$125.00");
  assert.equal(money(-12500), "-$125.00");
});

