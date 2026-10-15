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
} from "../src/model.ts";

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





