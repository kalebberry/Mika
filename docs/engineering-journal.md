# Mika Budget — Engineering Journal

## Phase 2B: Covered Credit Final Verification

### 1. What Was Verified
Phase 2B implements a YNAB-inspired credit card funding system ("Mika Covered Credit") providing deterministic separation between **Total Owed** (card liability), **Ready to Pay** (cash reserved in checking for repayment), and **Uncovered Debt** (liability not backed by cash).

During this final verification phase, the following core areas were tested and confirmed:
1. **Core Accounting Engine**:
   - Chronological, event-driven timeline simulation (`getCreditCardCoverage` in `src/model.ts`).
   - Budgeted vs. unbudgeted credit card purchases and automatic fund movement.
   - Exact splitting of partially budgeted purchases into covered and uncovered portions.
   - Separation of automatic budget-funded reservations from manual cash reservations.
   - FIFO consumption of reserve lots upon payment execution.
   - Strict protection preventing manual release of automatically budget-funded cash.
   - Preservation of Safe to Spend invariant across purchases, manual assignments, releases, payments, and month boundaries.
   - Statement credit absorption preventing phantom cash creation.
   - Legacy debt migration safeguarding pre-baseline purchases from retroactive auto-coverage.
2. **State & Composable Reactivity**:
   - `useBudget` operations (`assignCardPaymentReserve`, `releaseCardPaymentReserve`, `getCreditCardCoverage`).
   - Reactive Safe to Spend recalculations and cash reconciliation.
   - State persistence, migration idempotence, and JSON backup export/import round-trips.
3. **Modal & UI Workflows**:
   - Compact Accounts row redesign with 3 high-level metrics, 4-stat details grid, and secondary 3-dot management menu.
   - Unrestricted availability of **Record Payment** whenever `totalOwed > 0`, whether covered or uncovered.
   - Prefill logic respecting reserved cash first (`readyToPay > 0 ? readyToPay : totalOwed`) and never exceeding positive card debt.
   - Modal payment indicator distinguishing **Reserve-Backed**, **Direct Uncovered**, and **Partially Covered / Mixed** payments.
   - Strict validation preventing payment submission above outstanding positive debt or on $0/credit balances.

---

### 2. Important Financial Invariants

1. **Credit Card Spending Separation**:
   - Credit card purchases increase credit card liability (`totalOwed`) and reduce available credit, but do *not* decrease cash account balances.
2. **Automatic Budget Reservation**:
   - When a purchase is made on a credit card in a budgeted category, the available budget is consumed and moved into `readyToPay`. Safe to Spend is not reduced again because the cash was already committed to the budget.
3. **Partially Budgeted Purchase Splitting**:
   - If a purchase exceeds the remaining category budget, it auto-reserves up to the remaining budget limit. The excess remains `uncoveredDebt`.
4. **Manual Reservation Bounds**:
   - `assignCardPaymentReserve`: Can only reserve up to available Safe to Spend and cannot exceed `uncoveredDebt`.
   - `releaseCardPaymentReserve`: Can only release up to `manualReleasable`. Budget-funded reserves (`auto` lots) are permanently protected and cannot be manually released.
5. **Exact Payment Impact**:
   - Payments reduce checking cash and credit card debt exactly once.
   - If paid from `readyToPay`, Safe to Spend is unaffected (cash was already reserved).
   - If paid uncovered, Safe to Spend drops by the exact uncovered amount paid.
   - Mixed payments consume `readyToPay` first, and only the excess reduces Safe to Spend.
6. **Debt Ceiling**:
   - Neither prefilling nor submission can ever exceed positive outstanding card debt.
7. **Cash Reconciliation / Conservation**:
   - Total Cash = Safe to Spend + Pots + Remaining Budgets + Bills + Total Ready to Pay + Excluded Savings.

---

### 3. Key Files and Functions Involved

| File | Key Functions / Responsibilities |
|---|---|
| [`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts) | `getCreditCardCoverage`, `getCreditCardCoverageStatus`, `computeSum`, `isLedgerStatus`, `migrateState`, `PaymentReservation`, `Account`, `CreditCardCoverage` |
| [`src/composables/useBudget.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/composables/useBudget.ts) | `assignCardPaymentReserve`, `releaseCardPaymentReserve`, `getCreditCardCoverage`, `getAccountBalance`, `sum`, `state` |
| [`src/composables/useModal.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/composables/useModal.ts) | `open`, `submit`, `form`, prefill calculation, debt ceiling enforcement, reservation validation |
| [`src/components/views/AccountsView.vue`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/components/views/AccountsView.vue) | Compact account rows, expanded 4-stat details, progress bars, `Record payment`, `+ Reserve cash`, `Release reserve`, 3-dot dropdown menu |
| [`src/components/common/ActionDialog.vue`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/components/common/ActionDialog.vue) | Modal dialogs for `Reserve for payment` and `Credit Card Payment` (with reserve-backed vs partially covered vs direct uncovered callouts) |
| [`src/components/overview/SafeToSpendCard.vue`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/components/overview/SafeToSpendCard.vue) | Safe to Spend breakdown card displaying Credit Card Reserves and Shortfall callouts |
| [`tests/budget.test.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/tests/budget.test.ts) | 67 comprehensive unit and regression tests covering all Covered Credit scenarios |

---

### 4. Remaining Risks and Limitations

1. **Client-Side Environment Dependencies**:
   - Antigravity sandbox environments lacking Playwright browser drivers cannot execute end-to-end headless browser tests; interactive UI validation relies on manual browser review and comprehensive unit/component DOM harness tests.
2. **Multiple Simultaneous Card Payments in One Pay Period**:
   - If checking cash is insufficient to honor both upcoming protected bills and non-reserved card payments, Safe to Spend will reflect a shortfall (`shortfall > 0`), but Mika does not automatically decide which obligation has higher priority; the user must manually reallocate or release reserves if needed.
3. **Historical Date Re-ordering**:
   - Because transactions are sorted by `(date, createdAt, typePriority)`, importing transactions from external banks with identical transaction dates and missing timestamps relies on entry sequence.

---

### 5. How to Reproduce the Most Important Tests

Execute the complete regression suite from the project root:

```bash
npm test
```

Key individual test suites in [`tests/budget.test.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/tests/budget.test.ts):
- **Test 2B.1 & 2B.2**: Chronological ordering (Owe $100 -> pay $40 uncovered -> reserve $60 = $60 Ready to Pay; vs Reserve $100 -> pay $40 = $60 Ready to Pay).
- **Test 2B.4 & 2B.5**: Statement credit and refund-after-payment absorption without cash inflation.
- **Test 2B.6**: Multi-month rollover preserving reservations across month boundaries.
- **Test 2B.7**: Migration idempotence and pre-baseline legacy debt isolation.
- **Test 2B.22**: Automatic budget reserve protection against manual release attempts.
- **Test 2B.23**: Safe to Spend breakdown and double-deduction prevention.
- **Test 2B.25 & 2B.26**: Record Payment prefill, uncovered debt execution, and positive debt ceiling guard.
- **Test 2B.27**: Partial budget split ($160 purchase on $100 budget -> $100 Ready to Pay, $60 uncovered) and mixed payment Safe to Spend tracking ($140 payment consumes $100 reserve and reduces Safe to Spend only by $40).

Execute the full production build and TypeScript check:

```bash
npm run build
```

---

### 6. Three Questions to Understand the Covered Credit Implementation

1. **Why does paying an unreserved credit card reduce Safe to Spend, while paying a fully reserved credit card does not?**
   - *Answer*: Because a fully reserved credit card already had its cash set aside from Safe to Spend (either at the time of a budgeted purchase or when manually assigned). When the payment occurs, cash and the reservation drop simultaneously, leaving net Safe to Spend unchanged. An unreserved payment takes cash out of checking that was previously considered safe to spend, so Safe to Spend must drop by that payment amount.

2. **Why does Mika prohibit releasing funds from Ready to Pay if those funds came from a budgeted credit purchase?**
   - *Answer*: When a purchase is made in a budgeted category, the cash allocated to that category was spent in exchange for goods and a credit liability. Releasing that cash back into Safe to Spend would effectively create "phantom money" — allowing the user to spend the same budgeted dollars twice while leaving the credit card liability unpaid. Only funds manually moved into Ready to Pay from Safe to Spend can be released back to Safe to Spend.

3. **How does the chronological reservation ledger prevent historical payments from consuming future reserves?**
   - *Answer*: Transactions and manual reservations are sorted chronologically by date and creation timestamp into an event timeline. A payment event only consumes reservations that were in the reserve pool at the moment the payment occurred. A manual reserve assigned on October 14 cannot travel backward in time to fund an uncovered payment recorded on October 10.

---

## Phase 3A.1 — Smart Payday Planning Engine & Schema v5 Migration (October 15, 2026)

### 1. Overview and Scope
Phase 3A.1 implements the foundational payday calculation engine and schema v5 migration for Smart Payday Planning. It introduces typed recurring payday schedules (weekly, biweekly, semimonthly, monthly, and manual), pure deterministic projection functions with explicit `asOf` reference dates, weekend adjustment rules, and a validated one-time override system.

**Scope constraints honored**:
- Financial calculations (`totals`, `reserveBillsBreakdown`, `getUncoveredScheduledExpenses`, Covered Credit, Safe to Spend) were not altered.
- Recurring bill overdue tracking and bill settlement models were unchanged.
- No UI changes were made in this increment (Settings and Overview UI updates deferred to Phase 3A.2+).
- Migrated existing v4 users default to `manual` mode, ensuring zero financial drift.

---

### 2. Schedule Data Model and Schema v5 Migration
1. **Model Architecture**:
   - `PaydayFrequency`: `"manual" | "weekly" | "biweekly" | "semimonthly" | "monthly"`
   - `WeekendRule`: `"exact"` (default) or `"preceding_friday"`
   - `PaydayOverride`: `{ id, scheduledDate, overrideDate, note?, createdAt }`
   - `PaydaySchedule`:
     - `frequency`: cadence type.
     - `anchorDate`: baseline ISO date (`YYYY-MM-DD`).
     - `dayOfMonth?`: target day for monthly schedules (1–31, clamped to month length).
     - `firstDay?`, `secondDay?`: target days for semimonthly schedules (e.g. 15 and 31, clamped).
     - `weekendRule`: weekend handling policy.
     - `manualFollowingPayday?`: explicit following payday for manual mode.
     - `overrides`: historical and upcoming one-time adjustments.
2. **Schema v5 Migration**:
   - `State.version` bumped to 5 (preserving `version: 2` for legacy v1/v2 states and `version: 4` for v3 migration tests).
   - If `raw.paydaySchedule` is missing (as in v4 states), it is initialized with `frequency: "manual"`, `anchorDate: raw.payday`, `manualFollowingPayday: raw.followingPayday || addDays(raw.payday, 14)`, `weekendRule: "exact"`, and `overrides: []`.
   - Legacy `payday` and `followingPayday` fields on `State` remain populated so all existing consumers, views, and bill reservation engines experience 0% drift.
   - Idempotent: repeated migrations preserve exact state and serialized JSON representation without introducing phantom or undefined keys.

---

### 3. Key Functions Implemented
- `daysBetween(dateA, dateB)`: Calculates exact integer day difference using UTC timestamps, eliminating DST artifacts.
- `getDaysInMonth(year, month)`: Deterministic calendar day count for leap and non-leap years.
- `adjustForWeekend(dateStr, rule)`: Shifts Saturday to Friday (-1 day) and Sunday to Friday (-2 days) when `rule === "preceding_friday"`; leaves dates untouched when `"exact"`.
- `getUpcomingPaydays(schedule, asOf, count)`: Pure projection returning the next $N$ paydays $\ge asOf$ in strict ascending order, applying weekend rules and nominal override substitutions.
- `getNextPayday(schedule, asOf)` & `getFollowingPaydayDate(schedule, asOf)`: Convenience helpers for primary and secondary upcoming paydays.
- `validatePaydayOverride(schedule, scheduledDate, overrideDate)`:
  - Validates ISO format for both dates.
  - Confirms `scheduledDate` corresponds to a genuine nominal occurrence for the active cadence.
  - Enforces sequence bounds: $D_{prev} < overrideDate < D_{next}$ (prevents chronology inversion and crossing adjacent paydays).
  - Rejects collisions with other active overrides or scheduled paydays.
- `applyPaydayOverride(schedule, override)`: Validates and upserts an override into `schedule.overrides`.
- `removePaydayOverride(schedule, scheduledDateOrId)`: Removes an override and reverts the occurrence to its nominal date.

---

### 4. Tradeoffs and Design Decisions
1. **Pure Calculations vs Stored Next Payday Fields**:
   - *Decision*: Next and following paydays are computed purely on-demand using explicit `asOf` dates rather than caching derived dates in state.
   - *Rationale*: Storing derived future dates invites drift across calendar days and requires persistent background state invalidation. Pure calculation with explicit `asOf` dates is testable and completely deterministic.
2. **Defaulting Migrated Users to Manual**:
   - *Decision*: Existing v4 users migrate to `frequency: "manual"` using their existing `payday` and `followingPayday` dates.
   - *Rationale*: Silently inferring biweekly recurrence would risk miscalculating bills for monthly, semimonthly, or irregularly paid users. Users must explicitly opt into automated recurrence in Settings.
3. **Sequence Bounds on Overrides**:
   - *Decision*: Overrides cannot cross adjacent paydays ($D_{prev} < overrideDate < D_{next}$).
   - *Rationale*: Shifting a paycheck beyond adjacent cycles creates cycle overlap, double-paycheck periods, or inverted time horizons that would invalidate bill planning horizons.

---

### 5. Test Suite Verification
All 73 unit and integration tests pass cleanly (`npm test`):
- **Test 3A.1**: Schema v5 migration idempotence, manual mode defaulting, and exact financial number preservation.
- **Test 3A.2**: Biweekly cadence crossing month and year boundaries (e.g. Dec 18, 2026 -> Jan 1, 2027) with automatic `asOf` cycle advancement.
- **Test 3A.3**: Weekly, monthly (day 31 clamped in Feb 28 non-leap, Feb 29 leap, Apr 30), and semimonthly (15th and clamped end-of-month) cadences.
- **Test 3A.4**: Weekend adjustment rules (`exact` vs `preceding_friday`).
- **Test 3A.5**: One-time override substitution, nominal validation, sequence bound violations rejection, collision rejection, upsert behavior, and removal restoration.
- **Test 3A.6**: Backup export and JSON import round-trip with schema v5.
- Complete regression coverage across all 67 prior tests (Phase 1, Phase 2A, Phase 2B Covered Credit).

Production build (`npm run build`) succeeded with 0 errors.

---

### 6. Learning Questions
1. **Why does the schedule engine calculate nominal dates first before applying weekend rules and overrides?**
   - *Answer*: Nominal dates represent the true underlying cadence rhythm (e.g. $anchorDate + 14k$ or the 15th/31st of each month). If adjustments were applied before generating the sequence, leap days or weekend shifts would accumulate and permanently drift the schedule away from the employer's payroll cycle.
2. **Why must override validation reject dates on or beyond adjacent paydays ($overrideDate \le D_{prev}$ or $overrideDate \ge D_{next}$)?**
   - *Answer*: Allowing an override to cross an adjacent payday would invert the chronological order of paychecks or cause two paydays to collide on the same date. A budget cycle relies on an orderly sequence of cycles; if an employer genuinely changes their cadence, the user should update the schedule anchor rather than creating an inverted override.
3. **How does Phase 3A.1 ensure existing users experience zero financial disruption upon migration?**
   - *Answer*: By defaulting existing users to `frequency: "manual"` with their existing `payday` and `followingPayday` dates, and continuing to use those authoritative fields for `reserveBillsBreakdown` and `getUncoveredScheduledExpenses`, the cash allocations and Safe to Spend calculations remain 100% identical.

