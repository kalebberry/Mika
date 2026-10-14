import test from "node:test";
import assert from "node:assert/strict";
import {
  type State,
  type Bill,
  type Transaction,
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





