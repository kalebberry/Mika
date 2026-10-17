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
All 77 unit and integration tests pass cleanly (`npm test`):
- **Test 3A.1**: Schema v5 migration idempotence, manual mode defaulting, and exact financial number preservation.
- **Test 3A.2**: Biweekly cadence crossing month and year boundaries (e.g. Dec 18, 2026 -> Jan 1, 2027) with automatic `asOf` cycle advancement.
- **Test 3A.3**: Weekly, monthly (day 31 clamped in Feb 28 non-leap, Feb 29 leap, Apr 30), and semimonthly (15th and clamped end-of-month) cadences.
- **Test 3A.4**: Weekend adjustment rules (`exact` vs `preceding_friday`).
- **Test 3A.5**: One-time override substitution, nominal validation, sequence bound violations rejection, collision rejection, upsert behavior, and removal restoration.
- **Test 3A.6**: Backup export and JSON import round-trip with schema v5.
- **Test 3A.7**: Chronological, unique effective dates crossing month boundaries and approaching adjacent paydays (Issue 1).
- **Test 3A.8**: Manual schedule generation respecting explicitly configured first and second paydays, including irregular intervals and weekend dates (Issue 2).
- **Test 3A.9**: Schema v5 migration and import sanitization of invalid dates, non-integer days, duplicate overrides, and sequence collisions with zero financial corruption (Issue 3).
- **Test 3A.10**: JSON backup round trips and migration idempotence across valid and normalized states (Issue 4).
- Complete regression coverage across all 67 prior tests (Phase 1, Phase 2A, Phase 2B Covered Credit).

Production build (`npm run build`) succeeded with 0 errors.

---

### 6. Independent Review Corrections (Phase 3A.1)
Following independent review of the initial Phase 3A.1 push, four specific corrections were implemented:
1. **Strictly Chronological & Unique Effective Dates (`getUpcomingPaydays`)**:
   - Rather than pushing occurrences into an array during sequential nominal iteration (which could produce non-chronological results when overrides shift occurrences across month boundaries or earlier in time), `getUpcomingPaydays` now generates candidate nominals across an expanded window (including all active override targets), resolves their effective dates via `getEffectiveOccurrenceDate`, deduplicates them via `Set<string>`, filters for $\ge asOf$, and sorts them in strictly ascending chronological order.
2. **Explicit Manual Schedule Dates & Irregular Intervals**:
   - Corrected manual schedule generation to strictly respect `anchorDate` (first payday) and `manualFollowingPayday` (second payday), regardless of the interval between them (e.g. 5-day gaps, 23-day gaps). If user manually configured a weekend date, it is preserved exactly.
   - Eliminated generation of hypothetical paydays before the configured `anchorDate`: when evaluating as of a date prior to the first configured payday, `getUpcomingPaydays` returns `anchorDate`, `manualFollowingPayday`, and subsequent interval projections without inventing any pre-anchor dates.
   - Future projections beyond the second payday step by `daysBetween(first, second)`.
   - Existing one-time overrides on configured manual paydays continue to work as expected.
3. **Hardened Schema v5 Migration and Import Sanitization**:
   - `isValidDateString` was converted into a TypeScript type guard (`dateStr is string`) that validates genuine calendar dates (rejecting `2026-02-31`, out-of-range months, or invalid strings) and safely falls back to standard defaults without throwing.
   - Schedule days (`dayOfMonth`, `firstDay`, `secondDay`) and bill days are safely rounded to integers and clamped (`Math.min(31, Math.max(1, Math.round(n)))`). Semimonthly days are swapped if necessary so $firstDay < secondDay$.
   - Overrides in imported state are progressively validated: duplicate scheduled dates are discarded, colliding override dates are discarded, and sequence bounds ($D_{prev} < overrideDate < D_{next}$) are enforced.
   - All financial state (accounts, assigned reserves, payment reservations, transactions, budgets, pots) remains 100% uncorrupted.
4. **Targeted Regression Tests**:
   - Added unit tests 3A.7 through 3A.10 covering each review correction, backup round-trip, and migration idempotence.

---

### 7. Actual Functions Changed
- `isValidDateString(dateStr?: string | null): dateStr is string` ([`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts)): Type guard for calendar date validation.
- `isNominalOccurrence(schedule, dateStr)` ([`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts)): Added irregular interval support for manual mode.
- `getAdjacentOccurrences(schedule, nominalDate)` ([`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts)): Bounded occurrences in manual mode using exact interval between `first` and `second`.
- `getEffectiveOccurrenceDate(schedule, nominal, overrides)` ([`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts)): Single source of truth for effective date resolution.
- `getUpcomingPaydays(schedule, asOf, count)` ([`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts)): Candidate window collection, deduplication, and strictly chronological sorting.
- `validatePaydayOverride(schedule, scheduledDate, overrideDate)` ([`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts)): Uses `getEffectiveOccurrenceDate` for accurate boundary evaluation.
- `migrateState(raw, now)` ([`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts)): Sanitizes calendar dates, non-integer days, duplicate/colliding overrides, and sequence bounds while preserving financial data.

---

### 8. Learning Questions
1. **Why does the schedule engine calculate nominal dates first before applying weekend rules and overrides?**
   - *Answer*: Nominal dates represent the true underlying cadence rhythm (e.g. $anchorDate + 14k$ or the 15th/31st of each month). If adjustments were applied before generating the sequence, leap days or weekend shifts would accumulate and permanently drift the schedule away from the employer's payroll cycle.
2. **Why must override validation reject dates on or beyond adjacent paydays ($overrideDate \le D_{prev}$ or $overrideDate \ge D_{next}$)?**
   - *Answer*: Allowing an override to cross an adjacent payday would invert the chronological order of paychecks or cause two paydays to collide on the same date. A budget cycle relies on an orderly sequence of cycles; if an employer genuinely changes their cadence, the user should update the schedule anchor rather than creating an inverted override.
3. **How does Phase 3A.1 ensure existing users experience zero financial disruption upon migration?**
   - *Answer*: By defaulting existing users to `frequency: "manual"` with their existing `payday` and `followingPayday` dates, and continuing to use those authoritative fields for `reserveBillsBreakdown` and `getUncoveredScheduledExpenses`, the cash allocations and Safe to Spend calculations remain 100% identical.
4. **Why must candidate effective dates be collected across an expanded window and sorted rather than emitted sequentially during nominal loop advancement?**
   - *Answer*: An override can move a nominal occurrence earlier in time or across a month boundary. If dates are pushed directly during a forward sequential loop over nominal dates, an earlier effective date from a later nominal could be appended after a later effective date, breaking strict chronological ordering. By collecting candidates across a window, deduplicating with a `Set`, and sorting with `localeCompare`, strictly chronological and unique effective dates are guaranteed.
5. **Why must manual schedule mode respect configured first and second payday dates independently rather than forcing an artificial regular cadence?**
   - *Answer*: In manual mode, users explicitly choose their specific pay dates (e.g. following irregular shift work, gig income, or seasonal bonuses where intervals might be 5 days or 23 days). Imposing a fixed 14-day assumption on manual mode would override explicit user input and cause bill reservations in the following cycle to compute against an incorrect planning horizon.
6. **How does progressive override sanitization prevent schema v5 migration or backup import from corrupting financial state?**
   - *Answer*: If imported JSON contains malformed or conflicting overrides (such as duplicate keys, colliding target dates, or non-calendar strings), progressive sanitization validates each entry against the schedule and preceding accepted overrides. Conflicting entries are dropped while preserving valid entries. The user's accounts, transactions, and budget allocations are processed completely independently, ensuring zero financial corruption.

---

## Phase 3A.2 — Payday Financial Integration

### 1. Objectives & Architectural Decisions
Phase 3A.2 bridges the Smart Payday Planning engine into recurring bill reservations, scheduled expense tracking, and the core Safe to Spend calculation.
- **Dynamic Payday Boundaries**: Non-manual payday schedules dynamically calculate the current cycle boundary (`getCurrentPayday`) and following cycle boundary (`getFollowingPayday`) without requiring manual settings updates as time advances. Manual schedules continue to respect explicit user-configured `payday` and `followingPayday` values for 100% financial parity.
- **Per-Bill Tracking Start Policy**:
  - Legacy bills without `trackingStartDate` begin tracking on the first of the migration month (`now.slice(0, 7) + "-01"`), preventing phantom historical debt from being inferred from pre-migration ledger gaps.
  - Newly created bills receive an explicit `trackingStartDate` (defaulting to creation date `today()`). Due occurrences prior to `trackingStartDate` are excluded, guaranteeing that a bill created after its monthly due day does not invent an immediate overdue obligation.
- **Multi-Occurrence Overdue Bill Reservations**: Replaced single-occurrence checks with a deterministic multi-occurrence traversal across all calendar months from `trackingStartDate` up to `followingEnd`. Legitimate overdue occurrences across multiple past months (> 60 days) remain fully reserved in `currentCycleBills` until settled or paid.
- **Bill-to-Transaction Matching**: Payments match specific bill occurrences via `t.billDueDate === occurrenceDate` or fall back to month matching `(!t.billDueDate && t.date.startsWith(occurrenceDate.slice(0, 7)))`. One payment settles only its intended occurrence, preventing a single transaction from clearing multiple overdue months.
- **Defensible Scheduled Expense Deduplication**: Replaced crude category-based suppression (`category === "Bills"`) with active bill linkage checks (`t.billId && s.bills.some(...)`). Standalone scheduled expenses in the "Bills" category remain protected and evaluated against category budgets, while bill-linked scheduled transactions avoid double counting.
- **Preserved Phase 2B Covered Credit Invariants**: Charging a bill to a credit card releases its bill reservation. If budgeted, funds move into `Ready to Pay` and reserve cash; if unbudgeted, debt remains reported as `uncoveredDebt` without pretending cash is reserved.
- **Preserved Safe to Spend Semantics**: Maintained `rawSafe`, `safe = Math.max(0, rawSafe)`, and `shortfall = rawSafe < 0 ? Math.abs(rawSafe) : 0`.

---

### 2. Files Changed
- [`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts):
  - Added `trackingStartDate?: string` to `Bill` type.
  - Implemented `getCurrentPayday(s, asOf)`.
  - Updated `getFollowingPayday(s, asOf)` with default parameter `asOf = today()`.
  - Updated `nextUnpaidDueDate` to evaluate starting from `trackingStartDate || (fromDate.slice(0, 7) + "-01")`.
  - Refactored `reserveBillsBreakdown` to loop from `trackingStartDate` to `maxEnd`, reserving every legitimately unpaid occurrence across multiple cycles.
  - Updated `getUncoveredScheduledExpenses` to use dynamic payday boundaries and link-based deduplication (`t.billId && s.bills.some(...)`).
  - Updated `isBillUnpaidThisMonth` to guard against pre-tracking due dates.
  - Updated `migrateState` to initialize `trackingStartDate` for legacy bills to the start of the migration month.
- [`src/composables/useModal.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/composables/useModal.ts):
  - Initialized `trackingStartDate: today()` when creating new recurring bills via modal.
- [`src/utils/format.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/utils/format.ts):
  - Updated `billStatus` to use `getCurrentPayday(state, now)` and `getFollowingPayday(state, now)`.
- [`tests/budget.test.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/tests/budget.test.ts):
  - Added 9 unit and regression acceptance tests (`Test 3A.2.1` through `Test 3A.2.9`).

---

### 3. Verification & Test Metrics
- **Automated Tests**: 86 passing tests (`node --test tests/budget.test.ts`), 0 failures, 0 skipped.
  - `Test 3A.2.1`: Legacy bills migrate with `trackingStartDate` set to migration month without inventing historical debt.
  - `Test 3A.2.2`: Bill created after its monthly due day projects to next cycle and does not become overdue.
  - `Test 3A.2.3`: Multi-occurrence overdue bills spanning > 60 days retain all unpaid occurrences in `currentCycleBills`.
  - `Test 3A.2.4`: One payment settles only its intended occurrence (matching `billDueDate` or month).
  - `Test 3A.2.5`: Covered vs uncovered credit-card bill purchases (reservation released; covered funds Ready to Pay; uncovered reports debt without cash deduction).
  - `Test 3A.2.6`: Scheduled transaction deduplication preserves standalone "Bills" transactions while deduplicating linked recurring bills.
  - `Test 3A.2.7`: Dynamic payday advancement across multiple cycles without manual settings updates; missed paycheck does not inflate cash.
  - `Test 3A.2.8`: Migration idempotence and manual payday migration parity.
  - `Test 3A.2.9`: Signed negative `rawSafe`, `safe = 0`, and positive `shortfall` contract preservation.
- **Production Build**: `vue-tsc -b && vite build` succeeded with 0 TypeScript or bundling errors.

---

### 4. Learning Questions
1. **Why must existing bills without `trackingStartDate` initialize tracking from the start of the migration month rather than inspecting historical ledger activity?**
   - *Answer*: Historical ledger activity in personal finance tools is often incomplete or imported with arbitrary starting dates. If migration attempted to infer unpaid occurrences from old ledger gaps, users importing historical data or adopting the app mid-year would suddenly find months of phantom "overdue" debt invented for bills they already paid outside the app. Initializing tracking at the migration month (`YYYY-MM-01`) creates a clean, deterministic baseline that preserves all existing transactions and settlements without fabricating earlier debt.
2. **Why must scheduled transaction deduplication check for active bill linkage (`t.billId && s.bills.some(...)`) rather than filtering on `category === "Bills"`?**
   - *Answer*: Categorization is orthogonal to recurring bill management. A user may schedule a one-off payment (e.g. an annual vehicle registration or doctor bill) and categorize it under "Bills". Suppressing all scheduled transactions categorized as "Bills" caused genuine standalone obligations to silently vanish from `getUncoveredScheduledExpenses`. Checking `t.billId && s.bills.some(...)` ensures only transactions directly tied to active recurring bills already reserved in `reserveBillsBreakdown` are deduplicated.
3. **Why does charging a recurring bill to a credit card require budget coverage to fund Ready to Pay, and how does this prevent double-deducting cash from checking?**
   - *Answer*: When a bill is paid on credit, the cash in checking has not yet left the account. The bill reservation is released because the vendor is paid. If the purchase is covered by a budget category, that budgeted amount moves into `Ready to Pay`, reserving checking cash to pay off the credit card later. If the purchase is unbudgeted, checking cash must not be locked into `Ready to Pay`, because the user has not allocated funds for it; doing so would falsely reduce Safe to Spend as if cash were reserved. In both cases, cash is deducted at most once.

---

## Phase 3A.2 — Independent Review Corrections

### 1. Review Findings & Corrections Applied

Two critical issues identified during independent review of Phase 3A.2 have been addressed:

1. **Deterministic Bill Payment Occurrence Matching Policy (`isBillPaid`)**:
   - **Problem**: When `billDueDate` was absent, `isBillPaid()` fell back to calendar month matching `(!t.billDueDate && t.date.startsWith(occurrenceDate.slice(0, 7)))`. If a user made a late payment in month $M$ for an overdue occurrence from month $M-1$ without an explicit `billDueDate`, the fallback erroneously treated the transaction as payment for month $M$, silently releasing month $M$'s reservation while leaving month $M-1$ unpaid.
   - **Solution & Policy**:
     1. **Settlement Priority**: Explicit manual settlements (`s.billSettlements`) are checked first.
     2. **Explicit Linkage Priority**: Explicit `t.billDueDate === occurrenceDate` takes absolute precedence over all date heuristics. A late payment in October with `billDueDate: "2026-09-05"` settles September 5 and leaves October 5 unpaid.
     3. **Unambiguous Legacy Preservation**: If `t.billDueDate` is absent, transactions in the occurrence month are evaluated, but only when no earlier unpaid occurrences exist since `trackingStartDate` (`hasEarlierUnpaidOccurrence(s, b, occurrenceDate) === false`). Legitimate, on-time historical payments are preserved without inventing settlement dates.
     4. **Ambiguity Retention**: If earlier unpaid occurrences exist since `trackingStartDate`, an unlinked transaction cannot be unambiguously assigned to the current month without guessing whether it is a late payment for an earlier occurrence. The system retains the obligation for both occurrences and protects the funds until the user provides explicit linkage or records a settlement.
     5. **One-to-One Accounting**: One payment cannot settle multiple occurrences.

2. **Removal of Fixed 60-Month Reservation Cap (`reserveBillsBreakdown` & `nextUnpaidDueDate`)**:
   - **Problem**: A fixed `step < 60` iteration limit prematurely halted evaluation after 5 years, silently dropping legitimate overdue occurrences for long-tracked obligations (e.g., annual or monthly multi-year annuities, subscriptions, or disputes).
   - **Solution**:
     - Dynamic month range calculation: `totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1`.
     - Validated date ranges guarding against pathological input: checks `1900 <= startYear && endYear <= 2200`, `totalMonths > 0`, and caps execution at `Math.min(totalMonths, 1200)` (100 years).
     - Applied matching dynamic range calculation to `nextUnpaidDueDate` to guarantee the earliest unpaid due date is discovered across arbitrary multi-year spans.

---

### 2. Files Changed
- [`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts):
  - Added helper `hasEarlierUnpaidOccurrence(s, b, occurrenceDate)` to inspect tracking history for preceding unpaid cycles.
  - Refactored `isBillPaid()` to enforce explicit linkage priority, unambiguous legacy matching, and ambiguity obligation retention.
  - Replaced fixed loop bounds in `reserveBillsBreakdown()` and `nextUnpaidDueDate()` with dynamic calendar month spans bounded up to 100 years (`1200` months).
- [`tests/budget.test.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/tests/budget.test.ts):
  - Updated `Test 3A.2.4` to reflect ambiguity retention when prior unpaid occurrences exist without explicit linkage.
  - Added `Test 3A.2.10`: September bill paid in October with explicit occurrence linkage.
  - Added `Test 3A.2.11`: Legacy payment without occurrence linkage (unambiguous on-time match).
  - Added `Test 3A.2.12`: Two overdue occurrences and one payment (ambiguous payment retains both; explicit linkage isolates each).
  - Added `Test 3A.2.13`: More than 60 months of legitimate unpaid occurrences (82 consecutive months evaluated and reserved).
  - Added `Test 3A.2.14`: Safe to Spend and Covered Credit parity under occurrence matching.

---

### 3. Verification & Test Metrics
- **Automated Tests**: 91 passing tests (`npm test` / `node --test tests/budget.test.ts`), 0 failures, 0 skipped.
- **Production Build**: `npm run build` (`vue-tsc -b && vite build`) completed successfully with 0 type errors and zero bundling issues.

---

### 4. Learning Questions

1. **Why is retaining an obligation preferable to guessing when an unlinked legacy payment coincides with an overdue bill?**
   - *Answer*: In personal financial budgeting, under-reserving cash causes unexpected overdrafts and false spending confidence. If a user missed their August bill and then paid in September without linking the payment, guessing that September is "paid" would release September's cash reservation while August's debt remains unaddressed. By retaining the obligation until explicit linkage or settlement is specified, the system guarantees that money remains reserved and alerts the user to reconcile rather than silently dropping a financial obligation.

2. **Why does calculating the exact month range between `trackingStartDate` and the planning horizon protect performance while eliminating arbitrary caps?**
   - *Answer*: A fixed iteration cap like 60 months was an arbitrary workaround to prevent infinite loops. By computing `(endYear - startYear) * 12 + (endMonth - startMonth) + 1` directly from validated ISO dates (`1900 <= year <= 2200`), the engine loops exactly the necessary number of times (e.g. 82 iterations for a 7-year history takes $< 0.3\text{ms}$). Capping pathological input at 1,200 months (100 years) guarantees worst-case $O(N)$ execution that never blocks the event loop, while supporting any legitimate real-world financial history.



---

## Phase 3A.2 — Final Accounting Hardening

### 1. Hardening Decisions & Architecture

Following independent review confirmation of the initial corrections, a final targeted accounting hardening pass was implemented to ensure complete financial safety across bill payments, legacy data, and edge-case date inputs:

1. **Explicit `billDueDate` on All Newly Recorded Bill Payments**:
   - Implemented `recordBillPayment(s, billId, options)` in [`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts) and integrated it into [`src/composables/useBudget.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/composables/useBudget.ts) and [`src/composables/useModal.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/composables/useModal.ts).
   - Any newly recorded bill payment automatically binds to the earliest unpaid occurrence (`nextUnpaidDueDate`) or explicit caller-supplied `dueDate`.
   - In "Add transaction" and "Edit transaction" modal workflows, specifying a `billId` automatically resolves and sets the explicit `billDueDate` to the intended occurrence if not manually specified.

2. **Strict Unambiguous Legacy Matching Policy**:
   - Both explicit and legacy candidate transactions are strictly required to be expense payments (`t.amount < 0`). Positive credits, refunds, or reversals associated with a bill cannot settle an occurrence.
   - Transactions without `billId` are never matched, regardless of month or category.
   - If multiple unlinked expense transactions exist in the same month for a bill (`unlinkedCandidates.length > 1`), the occurrence is treated as ambiguous and retained as an unpaid obligation until the user explicitly links or settles the intended transactions.
   - If earlier unpaid occurrences exist since `trackingStartDate`, unlinked transactions in subsequent months remain ambiguous and retain obligations for all occurrences.

3. **Non-Omission Safe Failure Policy & Diagnostics for Date Ranges**:
   - Replaced silent `continue` omission with active clamping, diagnostic logging, and fallback reservation:
     - Supported calendar domain is formally established as `[1900, 2200]`.
     - Malformed or invalid `trackingStartDate` values fall back to the valid current month baseline (`YYYY-MM-01`) and emit a diagnostic.
     - Out-of-bounds start or end dates are clamped into `[1900, 2200]` and emit diagnostics.
     - If an unexpected date error or non-positive month calculation occurs, the engine safely reserves `b.amount` in `currentCycleBills` with an explicit diagnostic rather than silently dropping the obligation.
     - Safety cap (3,600 months, covering 300 years) shifts evaluation to the most recent 3,600 months up to `maxEnd`, guaranteeing the current cycle and recent overdue occurrences are never dropped.
     - Both `reserveBillsBreakdown` and `totals` now expose `diagnostics: string[]` to give consumers full visibility into date anomalies.

4. **Covered Credit & Safe to Spend Parity**:
   - Paying a bill via credit card using `recordBillPayment` cleanly releases the bill reservation, records credit debt, reserves funds in `Ready to Pay` (when budgeted), and maintains signed `rawSafe`, `safe`, and `shortfall` invariants without double-deducting checking cash.

---

### 2. Files Changed
- [`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts):
  - Added `recordBillPayment(s, billId, options)`.
  - Hardened `isBillPaid` with `t.amount < 0` expense guards and `unlinkedCandidates.length > 1` ambiguity check.
  - Hardened `nextUnpaidDueDate` with clamped date parsing and fallback defaults.
  - Hardened `reserveBillsBreakdown` with non-omission safe failure policy, clamped date handling, and `diagnostics: string[]`.
  - Added `diagnostics` to `totals()` return contract.
- [`src/composables/useBudget.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/composables/useBudget.ts):
  - Added `payBill` composable helper and exported it.
- [`src/composables/useModal.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/composables/useModal.ts):
  - Updated "Pay bill" mode to record transactions via `recordBillPayment`.
  - Added `billId` and `billDueDate` to `ModalFormState` and resolved explicit linkage on Add/Edit transaction.
- [`tests/budget.test.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/tests/budget.test.ts):
  - Added `Test 3A.2.15`: Ambiguous legacy transactions (multiple unlinked candidates, non-expense credits, and unlinked arbitrary transactions).
  - Added `Test 3A.2.16`: Explicit occurrence linkage on newly recorded payments (`recordBillPayment`).
  - Added `Test 3A.2.17`: Date-range safety handling, diagnostics, and non-omission safe failure policy.
  - Added `Test 3A.2.18`: Preserved Phase 2B Covered Credit and Safe to Spend invariants under `recordBillPayment`.

---

### 3. Verification & Test Metrics
- **Automated Tests**: 95 passing tests (`npm test` / `node --test tests/budget.test.ts`), 0 failures, 0 skipped.
- **Production Build**: `npm run build` (`vue-tsc -b && vite build`) passed with 0 errors.

---

### 4. Learning Questions

1. **Why must multiple unlinked transactions in the same month be treated as ambiguous rather than summing them or picking the first one?**
   - *Answer*: When a user has two unlinked transactions in a single month (e.g. two $50 payments on a $100 utility bill), Mika cannot guess whether the user made a split payment, accidentally entered a duplicate, or paid a late fee/prior balance. Summing or arbitrarily picking one could prematurely release the reservation when partial funds or duplicates are involved. Treating multiple unlinked records as ambiguous preserves the full reservation and prompts user reconciliation without making irreversible financial guesses.



---

## Phase 3A.2 — Transaction Editing Occurrence Fix

### 1. Issue & Rationale

During final independent review, an issue was identified in [`src/composables/useModal.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/composables/useModal.ts):
- **Problem**: When editing an existing transaction, the modal form did not load `t.billId` and `t.billDueDate`. When saved, if a bill association existed, the logic treated `explicitBillDueDate` as missing and called `nextUnpaidDueDate(state, linkedBill, f.date)`. If an earlier month (e.g. September) was overdue, editing an October bill payment's description, amount, date, account, or status would silently reassign the transaction's `billDueDate` to the overdue September occurrence!
- **Solution & Invariant Preservation**:
  1. In `open("Edit transaction", id)`, `form.value.billId` and `form.value.billDueDate` are populated directly from the existing transaction record.
  2. In `save()`:
     - **Unchanged Bill Association**: If `targetBillId === existing.billId`, `existing.billDueDate` is strictly preserved unless the user explicitly provided a different occurrence date in `f.billDueDate`. Editing description, amount, date, account, or status will NEVER silently reassign the bill occurrence.
     - **Bill Reassignment**: If the user explicitly selects a different recurring bill (`targetBillId !== existing.billId`), `billDueDate` is updated consistently (using caller-supplied `f.billDueDate` or resolving `nextUnpaidDueDate` for the new bill).
     - **Bill Removal**: If the user unlinks the bill (`!targetBillId`), both `billId` and `billDueDate` are cleared to `undefined`.

---

### 2. Files Changed
- [`src/composables/useModal.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/composables/useModal.ts):
  - Populated `billId` and `billDueDate` in `form` initial state and in `open("Edit transaction")`.
  - Preserved `existing.billDueDate` when saving edits to an existing transaction where the bill association is unchanged.
  - Added `isValidDateString` import from `../model.ts`.
- [`tests/budget.test.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/tests/budget.test.ts):
  - Added `Test 3A.2.19`: Editing an existing transaction preserves `billDueDate` even when earlier occurrences (e.g. September) remain overdue, while reassigning or unlinking bills updates occurrence linkage consistently.

---

### 3. Verification & Test Metrics
- **Automated Tests**: 96 passing tests (`npm test` / `node --test tests/budget.test.ts`), 0 failures, 0 skipped.
- **Production Build**: `npm run build` (`vue-tsc -b && vite build`) passed with 0 errors.

---

### 4. Learning Question

1. **Why must transaction editing treat existing occurrence linkage as immutable unless explicitly altered by the user?**
   - *Answer*: Recurring bill payments often occur out of strict chronological order in the real world (e.g. a user pays current October utilities online while disputing or delaying an August charge). If editing unrelated fields like the payee note or payment account recalculated the occurrence via `nextUnpaidDueDate`, the system would retroactively rewrite financial history, shifting funds to earlier overdue cycles and silently destabilizing the user's current cycle reservations. Preserving the existing `billDueDate` guarantees that routine edits never alter financial attribution.

---

## Phase 3A.3: Payday Settings & Overview UI

### 1. Architectural Overview & UI Flow

Phase 3A.3 connects the Phase 3A.1 scheduling engine and Phase 3A.2 financial integration into Mika Budget's user interface, maintaining full fidelity with Mika's ADHD-friendly usability principles and financial safety boundaries.

#### State Flow Architecture:
1. **Isolated Draft State in Settings**:
   - Edits in [`src/components/views/SettingsView.vue`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/components/views/SettingsView.vue) are held in an isolated reactive draft ref (`draftSchedule`).
   - Partial edits, typing in inputs, or switching dropdown frequencies do not mutate the core application state or trigger immediate recalculation of Safe to Spend or bill reservations.
   - Users must explicitly click **Save schedule** to validate and persist the configuration, or **Cancel** to revert changes to the persisted state.
2. **Deterministic Schedule Validation**:
   - `validatePaydaySchedule()` pure function in [`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts) validates input constraints across all 5 frequencies (`weekly`, `biweekly`, `semimonthly`, `monthly`, `manual`).
   - If validation fails, `updatePaydaySchedule()` returns `{ success: false, errors, message }` and preserves the previous valid schedule completely untouched. No state mutation occurs on invalid inputs.
3. **Synchronization with Top-Level Payday Anchors**:
   - Upon successful save, `updatePaydaySchedule()` updates `state.paydaySchedule`.
   - For manual schedules, `state.payday` and `state.followingPayday` are set directly to `anchorDate` and `manualFollowingPayday`.
   - For automatic schedules (`weekly`, `biweekly`, `semimonthly`, `monthly`), `getCurrentPayday(state)` and `getFollowingPayday(state)` calculate active occurrences dynamically from the engine.
   - Module-level state deep watcher automatically persists the updated state to `localStorage`.
4. **Overview Payday & Protection Summary**:
   - [`src/components/overview/PaydaySummaryCard.vue`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/components/overview/PaydaySummaryCard.vue) renders a compact, ADHD-friendly summary answering: *"When do I get paid next, and how does Mika protect my money until then?"*
   - Displays active frequency, next payday date, following payday date, and countdown.
   - For incomplete manual schedules (e.g. past anchor without known upcoming dates), displays a clear empty state prompting the user to configure their payday in Settings, without inventing hypothetical dates.
   - Displays bill protection breakdown using approved `reserveBillsBreakdown(state)` and `totals(state)` outputs:
     - Current cycle reserved bills.
     - Following cycle protected bills.
     - Overdue unpaid obligations held until settled or paid.
     - Safe to Spend impact: displays reserve shortfall deficit if `rawSafe < 0` (`sum.shortfall > 0`), or confirmation that Safe to Spend accounts for all reserved obligations.
   - Avoids internal accounting jargon or raw engine variable names.

---

### 2. Files and Functions Changed

| File | Changes Made |
|---|---|
| [`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts) | - Added `validatePaydaySchedule` to validate date formats, day-of-month ranges (1–31), unique semimonthly days, chronological manual dates, and override consistency.<br>- Added `updatePaydaySchedule` to safely validate, normalize (e.g. sort semimonthly days), update `state.paydaySchedule`, and synchronize `state.payday` / `state.followingPayday`.<br>- Exported `ScheduleValidationResult`. |
| [`src/utils/format.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/utils/format.ts) | - Added `dateWithDay` for friendly weekday formatting (e.g., "Wed, Oct 21, 2026").<br>- Added `frequencyLabel` for human-readable schedule titles.<br>- Added defensive date validation checks to `date()` preventing "Invalid Date" output. |
| [`src/composables/useBudget.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/composables/useBudget.ts) | - Added `saveSchedule` composable method for saving draft schedules with toast feedback.<br>- Added `addScheduleOverride` and `removeScheduleOverride` composable methods.<br>- Exposed `currentPayday`, `followingPayday`, `saveSchedule`, `addScheduleOverride`, and `removeScheduleOverride`.<br>- Updated `days` computation to use `getCurrentPayday(state.value)` so daily allowance automatically stays dynamic.<br>- Updated `saveSettings()` to save starting balance without requiring redundant payday re-entry when automatic schedule is active. |
| [`src/components/overview/PaydaySummaryCard.vue`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/components/overview/PaydaySummaryCard.vue) | - Created new ADHD-friendly Overview component displaying active frequency, next payday, following payday, empty state for incomplete manual schedules, and bill protection explanation breakdown. |
| [`src/components/overview/SafeToSpendCard.vue`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/components/overview/SafeToSpendCard.vue) | - Updated to use `currentPayday` from `useBudget()` so the dynamic next payday is displayed consistently across both cards. |
| [`src/components/views/OverviewView.vue`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/components/views/OverviewView.vue) | - Imported and integrated `PaydaySummaryCard.vue` into the Overview dashboard grid. |
| [`src/components/views/SettingsView.vue`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/components/views/SettingsView.vue) | - Added clearly labeled **Payday Schedule** section with progressive disclosure for all 5 frequencies.<br>- Added draft form isolation with explicit Save and Cancel buttons.<br>- Added live 3-occurrence upcoming paydays preview.<br>- Added one-time overrides management subsection (list, add, remove).<br>- Streamlined Financial Baseline section to focus on cash balance baseline while referencing the schedule below. |
| [`src/styles/pages/_settings.css`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/styles/pages/_settings.css) | - Added styling for 2-column form rows, field hints, payday preview chips, and one-time overrides list and form. |
| [`src/styles/pages/_overview.css`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/styles/pages/_overview.css) | - Added styling for `PaydaySummaryCard`, highlight row, days tag, protection metric items with color dots, safe/shortfall status banners, and empty state layout. |
| [`tests/budget.test.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/tests/budget.test.ts) | - Added comprehensive tests `Test 3A.3.1` through `Test 3A.3.9` covering loading from persisted state, saving each supported schedule, invalid configurations leaving prior state unchanged, switching between manual and automatic, weekend adjustments and overrides, correct next/following presentation, manual schedules with missing dates, persistence across serialization, and financial parity. |

---

### 3. Key Decisions & Rationale

1. **Why use an isolated draft form with explicit Save/Cancel in Settings?**
   - *Rationale*: In personal finance and especially for neurodivergent (ADHD) users, immediate unconfirmed auto-saving on text or date inputs creates cognitive anxiety. If a user temporarily types an incomplete date or changes the dropdown while exploring options, immediately recalculating Safe to Spend, bill reservations, and daily allowances would flicker numbers and risk corrupting financial planning. The explicit draft with Save and Cancel ensures intentionality and keeps financial state stable until the user confirms.

2. **Why preserve the previous valid schedule when validation fails?**
   - *Rationale*: If a user enters an impossible configuration (such as duplicate semimonthly dates like 15th and 15th, or an invalid calendar date like Feb 31), rejecting the change without modifying the in-memory or persisted state guarantees financial invariants remain intact. Silent correction or fallback to arbitrary dates would risk surprising the user by shifting bill reservations unexpectedly.

3. **Why avoid inventing dates for incomplete manual schedules on Overview?**
   - *Rationale*: An automatic schedule (weekly, biweekly, monthly, semimonthly) has a deterministic cadence rule from which future paydays can always be computed. A manual schedule, by definition, represents irregular or user-specified income dates. If a manual schedule's configured dates have expired, inventing an imaginary payday would mislead the user into believing their spending allowance is safely funded when in reality income timing is unknown. Providing a clear empty state with a direct button to Settings empowers the user to set their actual date.

---

### 4. Verification & Test Metrics

- **Automated Tests**: 105 passing tests (`npm test` / `node --test tests/budget.test.ts`), 0 failures, 0 skipped.
  - 9 dedicated Phase 3A.3 tests:
    - `Test 3A.3.1`: Loading payday settings from persisted state.
    - `Test 3A.3.2`: Saving each supported schedule type.
    - `Test 3A.3.3`: Invalid configurations leaving prior state unchanged.
    - `Test 3A.3.4`: Switching between manual and automatic schedules.
    - `Test 3A.3.5`: Weekend adjustments and explicit overrides.
    - `Test 3A.3.6`: Correct next and following payday presentation.
    - `Test 3A.3.7`: Manual schedules with missing dates.
    - `Test 3A.3.8`: Settings persistence across serialization and reload.
    - `Test 3A.3.9`: Unchanged Safe to Spend and Covered Credit calculations for equivalent financial states.
- **Production Build**: `npm run build` (`vue-tsc -b && vite build`) passed with 0 errors.
- **Manual UI Verification**:
  - Validated responsive 2-column grid layout on Settings and Overview.
  - Verified progressive disclosure logic for all 5 schedule frequencies.
  - Verified Save and Cancel button state interactivity and validation error alerts.
  - Verified that local dev server starts cleanly and transforms all modules without errors.

---

### 5. Known Limitations

1. **Automated Headless Browser Navigation in Sandbox**:
   - The environment's Playwright browser automation is restricted due to sandbox download limitations; consequently, end-to-end browser execution was substituted with direct unit testing of validation and state functions, component template type-checking via `vue-tsc`, and manual dev server inspection.
2. **One-Time Overrides Beyond Planning Horizon**:
   - One-time overrides are supported for any nominal occurrence within engine boundary rules; overrides set years into the future will be stored but will not affect immediate Safe to Spend until their cycle approaches.

---

### 6. Engineering Learning Questions

1. **Why must semimonthly paydays automatically sort `firstDay` and `secondDay`?**
   - *Answer*: Users may enter paydays in any order (e.g. entering the 31st first and then the 15th, or vice-versa). Sorting them so `firstDay = Math.min(d1, d2)` and `secondDay = Math.max(d1, d2)` creates a canonical representation that eliminates ordering ambiguity during interval calculations, prevents duplicate logic branches in the scheduling engine, and guarantees consistent presentation in the UI.

2. **Why must the Overview bill protection breakdown explicitly separate current-cycle bills from protected following-cycle bills?**
   - *Answer*: For financial peace of mind, users need to understand *why* money is being withheld from their Safe to Spend. Current-cycle bills are immediate obligations due before the next paycheck arrives, meaning failing to pay them will result in late fees or service cutoffs. Following-cycle protected bills (like the 1st of next month's rent when getting paid on the 28th) are future obligations held early by choice. Conflating them into a single lump sum obscures where the user's money is going and creates confusion about whether rent was already due.

3. **Why should `days` in `useBudget` use `getCurrentPayday(state)` rather than the static `state.payday` string?**
   - *Answer*: For automatic schedules (weekly, biweekly, monthly, semimonthly), paydays advance dynamically based on the current calendar date without requiring the user to open Settings and manually edit the date each cycle. If the daily allowance calculation relied on a static string, passing a payday without updating Settings would cause `days` to calculate negative or 1-day spans against an obsolete past date. Using `getCurrentPayday(state)` ensures the daily allowance always reflects the true upcoming income boundary.

---

## Phase 3A.3 Independent Review Corrections & Hardening

### 1. Findings & Issues Addressed

1. **Settings Draft Synchronization & `isDirty` Normalization**:
   - *Issue*: In `SettingsView.vue`, `handleSaveSchedule()` did not re-synchronize `draftSchedule.value` with `initDraft()`. When saving a semimonthly schedule entered with inverted days (e.g., `30` and `15`), `updatePaydaySchedule()` persisted the canonical sorted pair (`15` and `30`). Because `draftSchedule` retained the raw inputs, the form continued displaying `30` and `15`, `isDirty` incorrectly remained `true`, and the form appeared unsaved.
   - *Fix*: `handleSaveSchedule()` now explicitly assigns `draftSchedule.value = initDraft()` upon successful persistence. Additionally, `isDirty` computes normalized day values (`Math.min` / `Math.max`) for semimonthly schedules and performs a deterministic diff of one-time overrides. When the user cancels, `handleCancelSchedule()` restores the exact persisted schedule. External state updates remain strictly guarded by `!isDirty.value`, ensuring unsaved user edits are never overwritten.

2. **Manual Payday Empty State vs. Confirmed Deposits & Future Overrides**:
   - *Issue*: The manual scheduling engine in `getUpcomingPaydays()` projects forward 14-day intervals from `anchorDate` so that financial obligations (bill reservations and Safe to Spend) do not crash when a user forgets to update manual paydays. However, `PaydaySummaryCard.vue` previously relied directly on `getUpcomingPaydays()`, causing a stale manual payday (e.g. from August) to be presented on the Overview as a "confirmed" upcoming deposit (e.g. October 24 in 7 days). Furthermore, if a user had an explicitly configured future override for an upcoming occurrence on a manual schedule whose anchor was in the past, an initial naive check against only `anchorDate` would fail to recognize the explicit override.
   - *Fix*: Extracted `getConfirmedUpcomingPaydays(schedule, asOf)` as a pure function in `src/model.ts`. For manual schedules, confirmed paydays are strictly those configured by the user (`anchorDate`, `manualFollowingPayday`, or valid explicit overrides on scheduled occurrences verified via `resolveNominalOccurrenceDate`) that are $\ge asOf$. If all configured dates and overrides are in the past, the Overview triggers the empty state (`isManualIncomplete = true`) and displays no upcoming date chip. If a future override exists, it is confirmed as the next payday even if the original anchor and following dates are past. Synthetic recurring projections without overrides are never treated as confirmed deposits. All legacy manual financial calculations and bill protections remain 100% intact.

3. **Schedule Changes and Incompatible One-Time Overrides**:
   - *Issue*: When switching between schedules (e.g. from biweekly to monthly), active one-time overrides created under the old schedule could silently inject phantom occurrences into the new schedule via `getUpcomingPaydays()`.
   - *Fix*:
     - In `getUpcomingPaydays()`, overrides are only included in candidate nominals if `resolveNominalOccurrenceDate(schedule, o.scheduledDate) !== null`.
     - In `validatePaydaySchedule()`, candidate schedules with incompatible overrides are rejected with a descriptive validation error (`Override for ${date} is not a valid occurrence for a ${frequency} schedule`).
     - In `SettingsView.vue`, user-created overrides are never deleted silently. When changing schedule parameters, `incompatibleOverrides` detects any conflicts and displays a clear warning banner listing the affected dates with an explicit "Remove incompatible overrides" confirmation action. Users can either remove the incompatible overrides to proceed with saving, or click Cancel to restore their previous schedule and all overrides intact. Switching to a compatible schedule (e.g. biweekly to weekly on Fridays where the occurrence date coincides) cleanly preserves the override.

---

### 2. Verification & Regression Test Results

- **Automated Tests**: 108 passing tests (`node --test tests/budget.test.ts`), 0 failures, 0 skipped.
  - Added `Test 3A.3.10 — Settings draft synchronization, semimonthly day normalization, and dirty state management`:
    - Verifies normalized persistence of semimonthly days (30 & 15 $\to$ 15 & 30).
    - Verifies draft re-synchronization with `initDraft()`.
    - Verifies `isDirty` returns `false` after saving reordered days.
    - Verifies Cancel restores persisted configuration.
    - Verifies external state updates do not overwrite dirty form.
  - Added `Test 3A.3.11 — Manual payday empty state vs confirmed deposits and safety projection preservation`:
    - Exercises the extracted `getConfirmedUpcomingPaydays` pure model function across all manual scenarios.
    - Verifies stale manual anchor triggers empty state and emits no confirmed deposit.
    - Verifies promotion of upcoming `manualFollowingPayday` when anchor is past.
    - Verifies omission of unconfigured following payday in manual mode.
    - Verifies that past manual anchor with an explicitly overridden upcoming occurrence confirms the override date as next payday while excluding un-overridden synthetic projections.
    - Verifies override on the past `anchorDate` itself shifted to the future is confirmed.
    - Verifies financial calculations (`totals`, `reserveBillsBreakdown`) remain fully intact and protect bills across lookbacks.
  - Added `Test 3A.3.12 — Schedule changes with one-time overrides: incompatibility validation, non-silent handling, and filtering`:
    - Verifies incompatible overrides do not inject phantom paydays on new schedules.
    - Verifies `validatePaydaySchedule` rejects candidate schedules with incompatible overrides.
    - Verifies non-silent handling (overrides are not deleted without user action).
    - Verifies explicit removal flow allows saving.
    - Verifies compatible schedule switches preserve overrides seamlessly.
- **Production Build**: `npm run build` (`vue-tsc -b && vite build`) passed with 0 errors.

---

### 3. Review Learning Questions

1. **Why must form drafts re-synchronize with normalized state on save rather than relying solely on user input values?**
   - *Answer*: When user input undergoes normalization during persistence (such as sorting semimonthly days or trimming strings), retaining the user's pre-normalized draft causes form comparison logic (`isDirty`) to see a persistent mismatch between the draft and stored state. Re-synchronizing the reactive draft to `initDraft()` immediately after save guarantees that the UI displays the canonical saved data, clears the dirty indicator, and aligns the draft perfectly with underlying application state.

2. **How does Mika distinguish an explicitly confirmed manual payday from a projected engine date without requiring schema redesign?**
   - *Answer*: By inspecting the semantics of the existing schema: in manual mode, the user directly enters `anchorDate` and optionally `manualFollowingPayday`, plus explicit entries in `overrides`. These fields represent the only dates intentionally confirmed by the human user. Any subsequent recurring interval dates generated by the engine (`addDays(second, k * interval)`) exist solely as defensive math for financial obligations, not user-confirmed income dates. The pure function `getConfirmedUpcomingPaydays` verifies whether user-configured dates or valid nominal overrides resolve to dates $\ge asOf$, cleanly distinguishing confirmed deposits without altering data structures or breaking legacy calculations.

3. **Why should incompatible overrides be rejected by validation and presented via an explicit confirmation flow rather than automatically cleared on frequency switch?**
   - *Answer*: Silently deleting user data breaks user trust and violates ADHD-friendly predictability. An override often represents a carefully noted real-world exception (e.g. an early holiday direct deposit). If a user temporarily toggles the frequency dropdown to inspect another schedule option, silently destroying their overrides would cause irrecoverable data loss if they cancel or change back. Requiring validation and offering an explicit "Remove incompatible overrides" action ensures intentionality while keeping financial invariants airtight.

---

## Phase 3B: Bill-to-Transaction Linking & Flexible Payments

### 1. Architecture and Decisions

Phase 3B extends Mika's bill-occurrence accounting system to support flexible, real-world payment workflows—including partial payments, multiple installments, overpayments, early payments, late payments, and exact outstanding balance tracking.

Key architectural decisions:
1. **Deterministic Pure Function (`getBillOccurrenceStatus`)**:
   - Rather than mutating side-tables or maintaining cached balance fields that can drift out of sync, occurrence status is computed purely on demand from immutable ledger transactions and bill definition.
   - Computes:
     - `expectedAmount`: The nominal recurring bill amount (integer cents).
     - `paidAmount`: Total integer cents of qualifying ledger payments applied to this occurrence.
     - `remainingAmount`: `Math.max(0, expectedAmount - paidAmount)` (or `0` if explicitly settled before setup).
     - `overpaidAmount`: `Math.max(0, paidAmount - expectedAmount)`.
     - `status`: `"unpaid" | "partially_paid" | "paid" | "overpaid"`.
     - `isSettled`: Whether marked settled before setup without deducting cash.
     - `transactions`: Qualifying transactions applied to this occurrence.
2. **Deterministic Linking Rules**:
   - **Explicit Linkage Priority**: A transaction with `t.billId === bill.id` and explicit `t.billDueDate === occurrenceDate` belongs uniquely to that occurrence.
   - **Non-Guessing Conservative Legacy Fallback**: Preserves the approved Phase 3A.2 non-ambiguity policy: unlinked legacy transactions without `billDueDate` qualify only if there is exactly 1 unlinked candidate in the occurrence calendar month and no earlier unpaid occurrences since tracking started. Ambiguous transactions retain the obligation rather than guessing.
   - **One Transaction, One Occurrence**: Each transaction belongs to exactly one bill occurrence. Editing unrelated details (description, date, amount, account) strictly preserves `billDueDate`.
3. **Integer Cents Representation**:
   - All calculations use integer cents, avoiding IEEE 754 floating-point inaccuracies.
4. **Scheduled Transactions Exclusion**:
   - Transactions with `status: "scheduled"` do not deduct cash from account balances and are strictly excluded from `paidAmount` until posted or cleared.
   - Linked scheduled transactions are excluded from `getUncoveredScheduledExpenses` to prevent double-deduction against the bill reservation.
5. **Overpayment Containment**:
   - Excess money (`overpaidAmount`) stays attached to the specific occurrence where it was paid.
   - It is never silently rolled forward or applied to another month. Future months evaluate independently against their full expected bill amount.
6. **Outstanding Reservation Accounting**:
   - `reserveBillsBreakdown` evaluates all qualifying occurrences in the planning window (overdue, current payday cycle, or protected following cycle).
   - For each occurrence, it reserves `occStatus.remainingAmount` rather than the flat `bill.amount`. Fully paid or overpaid occurrences reserve $0.00.

---

### 2. Payment Allocation Rules

1. **Qualifying Payment Criteria**:
   A transaction counts toward an occurrence if and only if:
   - `t.billId === bill.id`
   - `isLedgerStatus(t.status)` (`"posted"` or `"cleared"`; scheduled transactions do not qualify)
   - `t.amount < 0` (expense payments; positive refunds or credits do not settle bills)
   - Either:
     - `t.billDueDate === occurrenceDate` (explicit association), OR
     - Unlinked candidate (`!t.billDueDate`) meeting conservative non-ambiguity requirements (single unlinked transaction in occurrence month, no earlier unpaid occurrence).
2. **Multiple Payments Accumulation**:
   - All qualifying payments applied to an occurrence sum additively:
     $$\text{paidAmount} = \sum_{t \in \text{qualifying}} |\text{t.amount}|$$
3. **Status Determination**:
   - If `isSettled` or `remainingAmount === 0`:
     - If `paidAmount > expectedAmount`: `"overpaid"`
     - Else: `"paid"`
   - If `remainingAmount > 0`:
     - If `paidAmount > 0`: `"partially_paid"`
     - Else: `"unpaid"`
4. **Default Payment Prefill**:
   - When paying a bill (`recordBillPayment` or modal open), the default payment amount is `occStatus.remainingAmount > 0 ? occStatus.remainingAmount : bill.amount`. If a bill is partially paid, Mika defaults to the remaining balance so the user can complete the bill without typing or recalculating.

---

### 3. Financial Invariants

1. **Conservation of Safe to Spend across Partial Payments**:
   - When a payment of $\$X$ is recorded from a cash checking account:
     - Cash balance drops by $\$X$.
     - Bill reservation drops by $\$X$ (from remaining balance).
     - Net Safe to Spend ($\text{balance} - \text{pots} - \text{budgets} - \text{bills} - \text{creditReserves}$) remains invariant:
       $$\Delta \text{Safe to Spend} = (-\$X) - (-\$X) = \$0$$
   - Zero double-deduction.
2. **Partial Payments Do Not Silently Release Reservations**:
   - A bill of $\$200$ with $\$75$ paid retains $\$125$ in `reserveBillsBreakdown`.
   - `isBillPaid` returns `false` until `remainingAmount === 0`.
   - `nextUnpaidDueDate` remains on the earliest occurrence with `remainingAmount > 0`.
3. **Covered Credit Parity**:
   - Paying a bill via credit card records a negative charge on the credit card account.
   - Checking cash balance is untouched. Card balance owed increases by the payment amount.
   - If "Bills" has budget, the charge is automatically reserved in Ready to Pay; if unbudgeted, it is tracked as uncovered debt.
4. **Historical Settlement Parity**:
   - Marking an occurrence settled before setup zeroes its remaining balance without creating a cash transaction or altering account balances.

---

### 4. Edge Cases Handled

1. **Split Payments**: Multiple payments toward the same occurrence (e.g. paying $\$600$, then $\$400$, then $\$500$ on a $\$1,500$ rent bill) accumulate progressively from `"partially_paid"` to `"paid"`.
2. **Overpayments**: Paying $\$250$ on a $\$200$ utility bill produces status `"overpaid"` with $\$50$ overpaid. The next month's bill still expects its full $\$200$ and is not silently credited forward.
3. **Early and Late Payments**: A late payment on October 15 linked to September 1 settles September 1 without touching October 1. An early payment on October 15 linked to November 1 settles November 1 without touching October 1.
4. **Scheduled Payment Deduplication**: Scheduled bill payments do not count toward `paidAmount` (bill remains reserved), and are omitted from `getUncoveredScheduledExpenses` so they are not double-reserved.
5. **Editing and Deleting Payments**: Editing transaction amounts, dates, or accounts immediately recalculates outstanding balances without stale cached state. Deleting a transaction immediately restores the outstanding reservation.
6. **Ambiguous Legacy Transactions**: Multiple unlinked transactions in the same month or unlinked transactions with prior unpaid occurrences are rejected from automatic assignment to prevent financial guessing.

---

### 5. Verification & Regression Tests

Automated test suite (`npm test`): **121 passing tests (0 failures, 0 skipped)**:
- **Test 3B.1**: Full payment: settles occurrence in full, releases reservation, advances `nextUnpaidDueDate`.
- **Test 3B.2**: Single partial payment: $75 on $200 bill leaves $125 remaining, `isBillPaid` returns `false`, reserves $125, retains due date.
- **Test 3B.3**: Multiple partial payments accumulate: $600 + $400 + $500 progressively settles $1,500 rent bill.
- **Test 3B.4**: Overpayment: $250 on $200 bill stays attached to occurrence (overpaid by $50); November occurrence remains unpaid and expects full $200.
- **Test 3B.5**: Early and late payments preserve intended occurrence association: late payment settles September without touching October; early payment settles November without touching October.
- **Test 3B.6**: Scheduled vs posted transactions: scheduled transactions do not count toward `paidAmount`, do not change balance, and do not double-count in uncovered scheduled expenses; posting cleanly transitions to paid status.
- **Test 3B.7**: Editing and deleting linked payments dynamically recalculates outstanding amounts without stale state.
- **Test 3B.8**: Historical settlement without cash deduction and settling partially paid bills.
- **Test 3B.9**: Ambiguous legacy transactions handled conservatively: unlinked candidates with prior unpaid occurrences retain obligations; single unlinked candidate after settling prior occurrence matches cleanly.
- **Test 3B.10**: Overdue and protected reservations reserve outstanding remaining amounts: overdue ($200 remaining) + current ($125 remaining) + protected following ($100 remaining) = $425 total.
- **Test 3B.11**: Safe to Spend and shortfall invariant preservation under partial payments: paying $150 from cash preserves Safe to Spend exactly; shortfall magnitude remains stable.
- **Test 3B.12**: Credit card bill payment behavior & Covered Credit integration: paying bill from credit card increases card balance owed without altering checking cash; releases bill reservation.
- **Test 3B.13**: Composable and Modal workflow integration (`useBudget`, `useModal`): pre-filling remaining balance, validating amounts, rejecting invalid dates and premature cleared statuses, and submitting payment.

Production build check (`npm run build`):
- `vue-tsc -b && vite build` succeeded with 0 errors.

---

### 6. Engineering Learning Questions

1. **Why must bill reservations reserve `remainingAmount` rather than either full `b.amount` or $0?**
   - *Answer*: If the system reserved the full amount until 100% paid, making a partial payment would double-count the obligation: the paid portion would be subtracted from cash while still being reserved in bills, causing Safe to Spend to drop artificially. Conversely, if making any payment released the full reservation to $0, the unpaid balance would become spendable cash, causing users to accidentally spend money needed to complete the bill. Reserving `remainingAmount` maintains exact conservation of cash: cash and reservation decrease in exact tandem.

2. **Why must overpayments stay attached to their specific occurrence rather than being credited forward to the next month?**
   - *Answer*: Silently rolling over excess money introduces hidden state that violates banking reality and user intuition. When a user overpays an electric bill, the next month's bill from the provider may still be issued for a variable or estimated amount, or the provider may issue a credit on their utility account statement. Silently diminishing next month's reservation in Mika would lead the user to believe next month's obligation is lower than it actually is, potentially causing a cash shortfall when the next bill arrives. Keeping overpayments attached to the occurrence ensures explicit transparency and ADHD-friendly clarity.

3. **Why are scheduled transactions excluded from completed payments in `getBillOccurrenceStatus`?**
   - *Answer*: Scheduled transactions represent future intended intent, not confirmed cash movements. They do not alter current bank ledger balances. If a scheduled transaction were counted as a completed payment, the bill reservation would be released immediately, inflating current Safe to Spend before the cash has actually left the account. Keeping scheduled transactions separate ensures that the bill reservation remains in place until the money is confirmed posted or cleared.

---

### 7. Phase 3B Independent Review Corrections & Hardening

Following independent code review, three critical hardening fixes were implemented and verified:

1. **Legacy Payment Attribution Stability (`getBillOccurrenceStatus`)**:
   - **Issue**: A previously attributed legacy payment silently disappeared when a new explicitly linked partial payment was recorded. For example, on a $200 bill with a $50 legacy payment and a newly entered $75 explicit payment, the balance incorrectly showed $125 remaining instead of $75 remaining because an explicit match guard (`if (qualifyingTransactions.length === 0)`) skipped unlinked candidates entirely.
   - **Resolution**: Removed the exclusivity guard so that an unambiguous legacy candidate in the occurrence month is evaluated alongside explicit transactions.
   - **Non-Ambiguity & Non-Duplication Invariants**: Unlinked legacy candidates are only attributed if `unlinkedCandidates.length === 1` and `!hasEarlierUnpaidOccurrence(s, b, occurrenceDate)`. Because bill occurrences are monthly and explicit transactions require `billDueDate === occurrenceDate` whereas legacy transactions have `!billDueDate`, transactions belong to disjoint sets and can never be double-counted or assigned to multiple occurrences. If multiple unlinked records exist or earlier occurrences remain unpaid, the conservative rule retains the full obligation.

2. **Model-Level Payment Validation (`recordBillPayment`)**:
   - **Issue**: `recordBillPayment()` accepted unvalidated input and used `Math.abs(options.amount)`, permitting non-integer amounts, negative values, zero, `NaN`, or infinite values to create invalid transactions if called directly.
   - **Resolution**: Hardened the model boundary to reject:
     - Non-finite, non-integer, negative, zero, or `NaN` amounts.
     - Malformed or invalid ISO date strings for `date` and `dueDate`.
     - Unsupported transaction statuses (must be one of `"scheduled" | "pending" | "cleared" | "posted"`).
     - Non-existent account IDs.
   - **Behavior**: Any invalid request immediately returns `null` leaving state completely untouched (no transactions added, account balances and Safe to Spend unchanged). Valid payments and overpayments continue to execute correctly.

3. **Defensive Reservation Fallback Safety (`reserveBillsBreakdown`)**:
   - **Issue**: In the defensive fallback branches (`totalMonths <= 0` or `evaluatedCount === 0 && trackingStart <= maxEnd`), the code used `const reserveAmt = occStatus.remainingAmount > 0 ? occStatus.remainingAmount : b.amount;`. When an occurrence was fully paid or settled (`remainingAmount === 0`), `occStatus.remainingAmount > 0` was `false`, causing the system to resurrect the full `b.amount` as an active reservation.
   - **Resolution**: Derived the current cycle due date via `getBillDueDate(b, y, m)` and set `const reserveAmt = occStatus.remainingAmount;`. The reservation is added if and only if `reserveAmt > 0`. If `reserveAmt === 0` (the bill is fully paid or settled), $0 is reserved and no reservation detail is added. For partial payments, only the exact remaining balance is reserved.
   - **Financial Invariant**: Signed Safe to Spend and shortfall behavior are preserved identically across all fallback paths.

4. **Regression Verification**:
   - **Test 3B.14**: Verifies legacy payment attribution stability before ($50 paid / $150 remaining) and after ($125 paid / $75 remaining) a new explicit partial payment, and confirms that ambiguous multiple unlinked records remain unattributed.
   - **Test 3B.15**: Verifies model-level validation rejects zero, negative, NaN, infinite, fractional cent amounts, invalid dates, unsupported statuses, and invalid accounts with zero state mutation, while preserving partial payments and overpayments.
   - **Test 3B.16**: Verifies that the defensive fallback branch in `reserveBillsBreakdown()` reserves the full amount for unpaid bills, reserves only the outstanding balance for partially paid bills ($60 on $100 bill), and reserves $0 for fully paid or settled bills without resurrecting the bill amount.
   - **Test Suite**: All 124 tests passing (`npm test`).
   - **Build**: Clean production build (`npm run build`).

---

## Phase 3C: Credit Card Minimums & Scheduled Expense Safeguards (October 17, 2026)

### 1. Phase 3C Architecture & Overview

Phase 3C enhances Mika Budget by providing deterministic protection for upcoming credit card minimum payments and scheduled obligations without compromising Covered Credit (Phase 2B), dynamic payday planning (Phase 3A), or flexible bill-occurrence accounting (Phase 3B).

The implementation adheres to the core philosophy: **pure, deterministic financial calculation with zero duplicated money and zero phantom obligations**.

#### Key Architectural Components
1. **Credit Card Minimum Protection Engine (`src/model.ts`)**:
   - `getCreditCardDueDate(account, year, month)`: Deterministic month-end clamping (28/29 days for Feb, 30 days for Apr/Jun/Sep/Nov, 31 days) supporting leap years.
   - `getCreditCardMinimumProtection(account, s, now)`: Evaluates current outstanding card debt, configured minimum payment (`account.minPayment`), applicable statement due date, payments made within the current billing cycle, cash already held in Ready to Pay (`getCreditCardCoverage().readyToPay`), and payday window boundaries (`getCurrentPayday`).
   - `getCreditCardMinimumBreakdown(s, now)`: Aggregates additional minimum protection needed across all active credit cards for consumption by Safe to Spend and UI components.
2. **Scheduled Expense Safeguard Engine (`src/model.ts`)**:
   - Audited and enhanced `getUncoveredScheduledExpenses(s, now)`:
     - Account filtering: Scheduled transactions on credit cards or non-included savings accounts do not deduct from spendable checking cash before confirmation.
     - Amount-aware bill linkage deduplication: Scheduled transactions linked to tracked recurring bill occurrences (`billId` + `billDueDate`) are matched against active bill reservations (`reserveBillsBreakdown.details`). Scheduled payments up to the reserved bill amount do not create duplicate deductions; any excess scheduled commitment beyond the reserved bill amount is protected as a scheduled category expense.
     - Standalone transactions categorized as `"Bills"` without a linked recurring bill are protected as ordinary category expenses.
     - Scheduled income and transfers never prematurely inflate spendable cash.
3. **Safe to Spend Integration (`totals()` in `src/model.ts`)**:
   - `rawSafe = balance - pots - budgets - bills - uncoveredScheduledExpenses - totalReadyToPay - creditCardMinimums`
   - Signed financial model preserved: `safe = Math.max(0, rawSafe)`, `shortfall = Math.max(0, -rawSafe)`.
   - Exposes `creditCardMinimums` and `creditCardMinimumBreakdown` for transparent breakdown in the UI.
4. **UI Improvements**:
   - `AccountsView.vue`: Added `.cc-min-safeguard-card` displaying configured minimum payment, due date, coverage status badge, additional cash protected in Safe to Spend, and a clear planning estimate disclaimer ("Planning estimate based on configured minimum. Mika does not retrieve official bank statements.").
   - `SafeToSpendCard.vue`: Added transparent row for `creditCardMinimums > 0` ("Credit card minimums protected").

---

### 2. Minimum-Payment Calculation Policy

The credit card minimum protection calculation is a deterministic, pure function:

1. **Outstanding Debt Ceiling**:
   - Never protect more than actual outstanding card debt owed:
     $$\text{effectiveMin} = \min(\text{configuredMin}, \text{totalOwed})$$
   - A zero-balance card (`totalOwed === 0`) requires $0 minimum protection (`status: "not_applicable"`).
2. **Billing Cycle & Payment Attribution**:
   - Evaluates whether the card's upcoming due date falls within the current paycheck window (`targetDueDate <= currentPaydayEnd`).
   - Sums all ledger payments made to the card within the current cycle (`paidTowardCycle`).
   - Computes remaining minimum requirement:
     $$\text{remainingMinRequirement} = \max(0, \text{effectiveMin} - \text{paidTowardCycle})$$
3. **Covered Credit Non-Duplication**:
   - Ready to Pay (`coverage.readyToPay`) already holds cash in checking reserved for credit card debt.
   - Additional protection required is strictly the shortfall between the remaining minimum requirement and Ready to Pay:
     $$\text{additionalProtection} = \max(0, \text{remainingMinRequirement} - \text{readyToPay})$$
   - Example (Interaction A): Card owes $500, configured minimum $35, Ready to Pay $20. Additional protection = $15. Total protected towards the card is $35 ($20 Ready to Pay + $15 Minimum Safeguard), never $55.
   - Example (Interaction B): Minimum $35, Ready to Pay $50. Additional protection = $0.
   - Example (Interaction C): Card debt $20, configured minimum $35. Effective minimum is $20. Additional protection = $20.
4. **Archived and Unconfigured Cards**:
   - Archived cards (`account.archived`) require $0 minimum protection and are excluded from active totals.
   - Cards with missing, non-positive, or non-integer minimum payments or missing due days never fabricate payment requirements (`status: "not_applicable"`).
5. **Planning Horizon & Overlapping Windows**:
   - Due dates falling after the current payday belong to the subsequent paycheck cycle and require $0 protection in the current cycle (`isDueInCurrentWindow: false`).
   - When advancing to the next cycle, previous cycle payments do not satisfy future cycle minimums.

---

### 3. Scheduled Expense Reconciliation Rules

1. **Account Isolation**:
   - Scheduled expenses on credit card accounts (`accountId` of credit type) do not reduce checking account balances or premature posted debt.
   - Scheduled transactions on savings accounts excluded from Safe to Spend do not reduce checking cash.
2. **Recurring Bill Deduplication**:
   - If a scheduled transaction is explicitly linked to a bill occurrence (`billId` and `billDueDate`):
     - Let $\text{reservedAmt}$ be the amount reserved in `reserveBillsBreakdown` for that bill and due date.
     - If $\text{totalScheduled} \le \text{reservedAmt}$: 0 extra reservation (fully covered by the bill reservation).
     - If $\text{totalScheduled} > \text{reservedAmt}$: excess $(\text{totalScheduled} - \text{reservedAmt})$ is protected as an uncovered scheduled expense.
3. **Category Budget Deduplication**:
   - Scheduled transactions in budgeted categories (e.g. Groceries) consume remaining category budget first:
     - If $\text{scheduled} \le \text{remainingBudget}$: 0 extra reservation (already covered by category budget).
     - If $\text{scheduled} > \text{remainingBudget}$: only the excess $(\text{scheduled} - \text{remainingBudget})$ is protected as an uncovered scheduled expense.
4. **Scheduled-to-Posted Reconciliation**:
   - When a scheduled transaction transitions from `"scheduled"` to `"cleared"` or `"posted"`, the checking cash balance decreases by the transaction amount and the uncovered scheduled expense reservation is simultaneously released.
   - Net Safe to Spend remains completely invariant across the transition ($\Delta \text{Safe to Spend} = \$0$).
5. **Income and Transfers**:
   - Scheduled income does not prematurely increase spendable cash.
   - Scheduled transfers do not reduce category budgets or count as ordinary expenses.

---

### 4. Financial Invariants

1. **Non-Duplication Invariant**:
   - Total money set aside for credit cards in Safe to Spend equals:
     $$\text{Total Card Reserves} = \text{totalReadyToPay} + \text{creditCardMinimums}$$
   - Because `creditCardMinimums` only reserves $\max(0, \text{remainingMin} - \text{readyToPay})$, not a single cent is ever double-counted between Ready to Pay and Minimum Payment Safeguards.
2. **Credit Card Payment Reconciliation Invariant (Interaction H)**:
   - When a user records a payment from checking to a credit card:
     - Checking cash decreases by the payment amount.
     - Card liability decreases by the payment amount.
     - If the card had minimum payment protection, the payment fulfills the cycle requirement (`paidTowardCycle` increases), reducing `creditCardMinimums` to $0.
     - Net Safe to Spend is preserved without duplicate deduction.
3. **Signed Safe to Spend & Shortfall Invariant**:
   - The signed financial contract is preserved:
     $$\text{rawSafe} = \text{balance} - \text{pots} - \text{budgets} - \text{bills} - \text{uncoveredScheduled} - \text{totalReadyToPay} - \text{creditCardMinimums}$$
     $$\text{safe} = \max(0, \text{rawSafe})$$
     $$\text{shortfall} = \max(0, -\text{rawSafe})$$
4. **Conservation of Ledger Balances**:
   - Scheduled transactions and minimum payment planning estimates never alter authoritative posted ledger balances (`getAccountBalance`).

---

### 5. Compatibility & Migration Considerations

- **Schema v5 Compatibility**: No schema migration required; `minPayment` and `dueDay` were already optional properties on `Account`.
- **Backward Compatibility**: Accounts without `minPayment` or `dueDay` cleanly evaluate to `status: "not_applicable"` with 0 additional protection.
- **Pure Functions**: All calculations are pure, deterministic functions taking `(account, s, now)` or `(s, now)`, fully decoupleable from UI reactivity.

---

### 6. Verification & Test Suite

All 144 tests passing (`npm test`), with 0 failures and 0 skips:

- **Test 3C.1**: Zero-balance cards: $0 debt owed produces $0 minimum protection and `status: "not_applicable"`.
- **Test 3C.2 (Interaction A)**: Partially covered minimums: $500 debt, $35 min, $20 Ready to Pay -> protects exactly $15 additional; Safe to Spend protects $35 total, not $55.
- **Test 3C.3 (Interaction B)**: Fully covered minimums: $35 min, $50 Ready to Pay -> requires $0 additional protection; `status: "covered"`.
- **Test 3C.4 (Interaction C)**: Minimum exceeds debt: $20 debt, $35 min -> capped at $20 debt owed; protects $20, not $35.
- **Test 3C.5**: Multiple credit cards: isolation and aggregation across Card A ($30 protected), Card B ($0 protected), and Card C ($0 protected).
- **Test 3C.6**: Archived credit cards: zero minimum-payment reservation.
- **Test 3C.7**: Missing minimum or due day: no fabricated payments.
- **Test 3C.8**: Due days 29–31 and leap years: month-end clamping in April (30), October (31), Feb non-leap (28), Feb leap (29).
- **Test 3C.9**: Payday-window boundaries: outside current cycle ($0 protected) vs inside current cycle (protected).
- **Test 3C.10**: Overlapping planning windows: payment in October cycle satisfies October minimum without bleeding into November cycle.
- **Test 3C.11 (Interaction H)**: Card payments and minimum protection reconciliation: paying $50 satisfies minimum and reduces checking cash by $50; Safe to Spend is invariant ($950 before and after).
- **Test 3C.12 (Interaction D)**: Scheduled expense within category budget: $80 scheduled within $150 Groceries budget requires $0 extra reservation.
- **Test 3C.13 (Interaction E)**: Scheduled expense exceeds budget: $160 scheduled on $100 budget reserves only the $60 excess.
- **Test 3C.14 (Interaction F)**: Scheduled recurring bill deduplication: $200 scheduled linked to $200 bill does not double-count; total bills protected is $200, not $400.
- **Test 3C.15**: Scheduled credit card purchases: scheduled card purchases do not reduce checking cash or increase posted card debt.
- **Test 3C.16**: Scheduled income and transfers: scheduled income does not inflate spendable cash; scheduled transfers do not count as category expenses.
- **Test 3C.17 (Interaction G)**: Scheduled-to-posted transitions: $100 scheduled unbudgeted expense confirmed cleared reduces checking cash by $100 and releases $100 scheduled protection; Safe to Spend remains $900 before and after.
- **Test 3C.18**: Partial bill payments alongside scheduled payments: $400 paid + $600 scheduled on $1,000 bill reserves remaining $600 with zero duplicate reservation.
- **Test 3C.19**: Signed Safe to Spend and shortfall preservation: $100 cash - $50 bills - $80 credit minimum = rawSafe -$30, safe $0, shortfall $30.
- **Test 3C.20**: Full Covered Credit (Phase 2B) and Flexible Bill Payments (Phase 3B) regression: all subsystems integrate deterministically with exact mathematical precision.

Production build check (`npm run build`):
- `vue-tsc -b && vite build` passed cleanly in 779ms with 0 errors.

---

### 7. Three Engineering Learning Questions

1. **Why must additional credit card minimum protection be calculated after subtracting `coverage.readyToPay` rather than subtracting the total cash balance?**
   - *Answer*: `coverage.readyToPay` represents cash in checking that has already been earmarked and removed from Safe to Spend specifically for credit card debt (via budgeted credit card spending or explicit manual reserve assignments). If the minimum protection formula subtracted total checking cash, it would assume all checking money is available to pay the card, disregarding other obligations like pots, category budgets, and bills. Conversely, if it ignored `readyToPay`, it would reserve money for the minimum twice: once in Ready to Pay and once in Minimum Protection. Calculating $\max(0, \text{remainingMin} - \text{readyToPay})$ guarantees that only the unbacked gap in the minimum is reserved.

2. **How does amount-aware scheduled bill deduplication prevent both double-counting and premature release of obligation?**
   - *Answer*: When a user schedules a bill payment (e.g. scheduling autopay for $200 on an electric bill), the recurring bill occurrence itself already has a reservation in `reserveBillsBreakdown` for that month. Treating the scheduled transaction as an independent expense would deduct $200 in bills plus $200 in scheduled expenses ($400 total). Conversely, blindly ignoring all scheduled transactions with `category: "Bills"` would leave unlinked one-off bill expenses completely unprotected. By matching on `billId` and `billDueDate` and comparing `totalScheduled` against `reservedAmt`, Mika ensures that scheduled payments up to the reserved bill balance do not add extra deductions, while any scheduled excess beyond the bill balance is protected as a category expense.

3. **Why does Mika treat credit card minimums as planning estimates rather than banking statement facts?**
   - *Answer*: Mika is a local-first, privacy-respecting budgeting companion that does not directly query bank APIs for statement closing documents or dynamic interest-adjusted minimum payment calculations. In banking reality, credit card minimum payments fluctuate based on finance charges, statement balances, fees, and past-due amounts. Treating the user's configured minimum as an authoritative bank statement would risk misleading the user into believing an official obligation was satisfied. Clearly labeling it as a planning estimate ensures transparency, avoids liability, and reinforces user agency while still safeguarding cash needed for upcoming payments.

---

## Phase 3C Independent Review Corrections & Hardening

### 1. Root Causes & Findings Addressed

#### Correction 1 — Credit Minimum Cycle Attribution
- **Finding**: The initial implementation used the present card balance and present configured minimum to infer whether a past monthly minimum was satisfied. When card configurations (e.g. changing `minPayment` from $100 to $25) or balances changed after a due date, the code risked misattributing payments or silently discarding overdue obligations. Additionally, late payments made after a past due date risked being counted both toward curing the overdue cycle and toward the upcoming cycle.
- **Root Cause & Fix**:
  - Separated confirmed statement satisfaction from estimated coverage.
  - Added optional `confirmedMinimumDueDates?: string[]` to `Account` and pure model helpers `confirmCreditCardMinimum(account, dueDate)` / `unconfirmCreditCardMinimum(account, dueDate)`. If a due date is explicitly confirmed, it is marked as `isConfirmedPaid = true`.
  - When evaluating past cycles (`validNow > currentMonthDue`):
    - Payments between `prevMonthDue` and `currentMonthDue` are evaluated as on-time payments.
    - If unpaid on time, payments between `currentMonthDue` and `validNow` are evaluated as late payments.
    - If `onTimePaid + latePaid < effectiveMin` and not confirmed paid, the card is **overdue** (`status: "overdue"`, `isOverdue: true`, `dueCycle: "current"`). It is never silently discarded even if the configured minimum or card balance changes.
    - If late payments satisfy the overdue obligation, only the *true excess* $(\max(0, \text{latePaid} - \text{unfulfilledPastRequirement}))$ is attributed to `nextMonthDue`. The portion required to satisfy the overdue obligation is absorbed, completely preventing double-counting.

#### Correction 2 — Following-Payday Minimum Protection
- **Finding**: Credit minimums due between `currentPaydayEnd` and `followingEnd` previously received zero protection without distinction from obligations outside the horizon, and lacked parity with Phase 3A's `bill.protected` mechanism.
- **Root Cause & Fix**:
  - Defined an explicit following-cycle credit minimum protection policy:
    - Cards with due dates in `currentPaydayEnd < targetDueDate <= followingEnd` are classified as `dueCycle = "following"` and `isDueInFollowingWindow = true`.
    - Protection need is calculated as $\text{followingAdditionalProtection} = \max(0, \text{remainingMin} - \text{readyToPay})$ and aggregated into `followingCycleMinimums`.
    - Added `protected?: boolean` on `Account` (mirroring `Bill.protected`). If `account.protected === true`, the following-cycle minimum is protected in current Safe to Spend (`protectedFollowingMinimums`), deducting it alongside current cycle minimums. If `account.protected !== true`, it is tracked in `followingCycleMinimums` without reducing current Safe to Spend.
    - Overdue minimums are unconditionally treated as `dueCycle = "current"` and protected immediately regardless of original due date.
    - Each card evaluates exactly one target due date at a time; Ready to Pay deduplication applies to both current and following calculations.

#### Correction 3 — Dashboard Expenses Metric Showing $0.00
- **Finding**: User reported that the dashboard Expenses card displayed $0.00.
- **Root Cause Analysis**:
  - Traced UI component `StatGrid.vue`: displays `{{ money(expenses) }}` using `expenses` from `useBudget()`.
  - Traced `useBudget.ts`: `expenses` was computed via `monthly = transactions.filter(t => isLedgerStatus(t.status) && t.date.startsWith(month.value))`.
  - In `model.ts`, `isLedgerStatus(status?: string)` strictly checked `status === "pending" || status === "cleared" || status === "posted"`.
  - In legacy data, imported transactions, or transactions constructed without explicit status fields, `status` was `undefined`. Because `isLedgerStatus(undefined)` was `false`, `monthly` filtered out 100% of transactions with undefined status, leaving `expenses = 0` ($0.00).
- **Fix**:
  - Extracted pure model functions `getMonthlyExpenses(s: State, month: string): number` and `getMonthlyIncome(s: State, month: string): number` in `src/model.ts`.
  - `getMonthlyExpenses` explicitly allows legacy transactions where `!t.status`, alongside ledger statuses `isLedgerStatus(t.status)`, while strictly excluding `t.status === "scheduled"`.
  - Excludes `isLegacyDebt` transactions.
  - Excludes transfers (`kind === "transfer"`) and credit card debt repayments (`kind === "payment"`).
#### Correction 4 — Negative Zero (-$0.00) Display on Expenses
- **Finding**: User observed expenses displaying as `-$0.00`.
- **Root Cause & Fix**:
  - In JavaScript, IEEE-754 negative zero (`-0`) exists: `Object.is(-0, 0)` is `false`. When passed to `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })`, `-0` formats explicitly as `"-$0.00"`.
  - In `src/model.ts`, `getMonthlyExpenses()` previously used unary negation: `-s.transactions.filter(...).reduce((sum, t) => sum + t.amount, 0)`. When zero transactions matched (e.g. no expenses in the month), `reduce` yielded `0`, and `-0` produced `-0`.
  - In `src/composables/useBudget.ts`, `scheduledExpenses` similarly used unary negation `-state.value.transactions.filter(...).reduce(...)`.
  - In `src/utils/format.ts`, `money(v)` had no defense against `-0` or values rounding to 0 cents.
  - **Resolution**:
    1. Changed `getMonthlyExpenses()` and `scheduledExpenses` to sum `Math.abs(t.amount)`, guaranteeing $\ge 0$ positive integer cents and completely removing unary negation.
    2. Hardened `money(v)` in `src/utils/format.ts` to normalize `cents === 0 ? 0 : cents`, guarding against `-0`, non-finite inputs, and rounding boundary artifacts so that `-$0.00` can never render anywhere in the application.

#### Correction 5 — Historical Minimum-Payment Stability & Due Date Validation
- **Finding**: Review identified that `getCreditCardMinimumProtection()` evaluated previous months' obligations using today's `minPayment` and today's `totalOwed`. Changing configured minimums (e.g. from $100 to $25) or card balances could retroactively rewrite historical satisfaction, making a $30 partial payment appear to satisfy a past $100 statement minimum.
- **Root Cause & Fix**:
  - **Preserved Obligations by Occurrence**: Added optional `minimumObligations?: Record<string, number>` on `Account` mapping `YYYY-MM-DD` due dates to established required integer cents.
  - **Obligation Management Functions**: Added pure model functions `setCreditCardMinimumObligation(account, dueDate, amount)` and `getCreditCardMinimumObligation(account, dueDate)`. In `updateAccount`, changing `minPayment` automatically snapshots the previous obligation for the active cycle before updating.
  - **Satisfaction Stability**: Historical satisfaction is evaluated against the established snapshot obligation (`currentSnapshot || configuredMin`), strictly independent of current `totalOwed` or future `minPayment` configuration edits. Current debt limit clamps only the cash reservation required today, never retroactively rewriting whether the past statement was satisfied.
  - **Non-Fabrication Policy for Legacy Accounts**: If an account has no snapshot in `minimumObligations` for a past cycle, historical minimums are not fabricated, avoiding spurious overdue flags on legacy cards.
  - **Due Date Validation on Manual Confirmations**: Hardened `confirmCreditCardMinimum(account, dueDate)` to validate that `dueDate` is a valid date string and strictly matches `getCreditCardDueDate(account, year, month)` (accounting for leap years and month-end clamping), rejecting mismatched dates or non-credit accounts.
  - **Absorption Without Double Counting**: Payments absorbed by past unfulfilled obligations are deducted from current-cycle payments, preventing the same payment from satisfying both a past overdue cycle and the upcoming cycle.

#### Correction 6 — Minimum Obligation Snapshot Lifecycle & Due Date Targeting
- **Finding**: Review identified that in `useBudget.ts:updateAccount()`, changing `minPayment` snapshotted the previous value using the current calendar month's due date (`getCreditCardDueDate(acc, nowY, nowM)`). When evaluated on November 10, this evaluated to November 15 (future), wrongly assigning the prior $100 minimum to the upcoming November statement while leaving October 15 without a snapshot.
- **Root Cause & Fix**:
  - **Past Due Date Resolver**: Introduced `getPastCreditCardDueDate(account, asOf)` in [`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts) to strictly return the most recent due date that has already elapsed (`pastDue < asOf`). This makes it mathematically impossible to assign a historical minimum to a future due date.
  - **Account Settings Lifecycle Helper**: Introduced pure model helper `updateCreditCardMinimumSettings(account, newMinPayment, now)` in [`src/model.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts) and integrated it into [`src/composables/useBudget.ts:updateAccount()`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/composables/useBudget.ts).
  - **Composable Workflow Regression Testing**: Added `Test 3C.35` in [`tests/budget.test.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/tests/budget.test.ts) exercising the exact `useBudget().updateAccount` workflow across multiple edits without any manual pre-population of snapshots.

#### Correction 7 — Historical Statement Integrity Policy: Explicit Obligations vs Inferred Estimates
- **Finding**: Review of commit `b809d11` identified a financial-data integrity concern: `updateCreditCardMinimumSettings()` previously snapshotted the old configured minimum against the previous due date when settings changed, fabricating a confirmed historical statement obligation without evidence that Mika had recorded that amount for that historical statement.
- **Root Cause & Fix**:
  - **No Synthetic Historical Snapshots from Settings Edits**: Corrected [`updateCreditCardMinimumSettings`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts) and [`updateAccount`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/composables/useBudget.ts) to never create a historical statement snapshot solely from a settings change. Existing explicitly established occurrence-level obligations in `account.minimumObligations` are preserved unchanged.
  - **Explicit Uncertainty Labeling (`isEstimated`, `obligationType`)**: In [`getCreditCardMinimumProtection`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts):
    - When an overdue cycle has an explicit snapshot recorded in `minimumObligations`: `isEstimated: false`, `obligationType: "recorded"`.
    - When an overdue cycle is unsnapshotted (e.g. from an existing active card with unpaid balance), Mika protects the obligation in Safe to Spend so cash is not silently under-reserved, but marks it explicitly as an estimate: `isEstimated: true`, `obligationType: "estimated"`.
    - In [`AccountsView.vue`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/components/views/AccountsView.vue), overdue minimums with `isEstimated` are rendered as `(Past Due - Est.)` to keep uncertainty transparent.
  - **No Spurious Overdue Statements for Newly Configured Cards**: If a card is added after its calendar month due date (`currentMonthDue < account.createdAt`), Mika recognizes that the card did not exist in Mika on that due date, never acquires a fabricated overdue statement, and cleanly targets the upcoming statement (`nextMonthDue`) with `isOverdue: false`.
  - **Regression Test Coverage**:
    - `Test 3C.36`: Unsnapshotted overdue cycles are protected as estimates without creating synthetic snapshots on settings edits.
    - `Test 3C.37`: A new card configured after its previous due date does not acquire a fabricated overdue statement.

#### Correction 8 — Uniform Classification of Recorded vs Estimated Obligations
- **Finding**: Review of commit `95166a4` noted that the non-overdue branch of `getCreditCardMinimumProtection()` unconditionally marked upcoming obligations as `recorded` (`isEstimated = false`).
- **Fix**:
  - **Uniform Classification**: Updated [`getCreditCardMinimumProtection`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/src/model.ts) to consistently determine `obligationType` and `isEstimated` directly from whether `account.minimumObligations[targetDueDate]` exists, applying identical rules to upcoming and overdue obligations:
    - Explicitly recorded obligation (`targetSnapshot !== null`): `obligationType = "recorded"`, `isEstimated = false`.
    - Configured minimum without a due-date snapshot (`targetSnapshot === null`): `obligationType = "estimated"`, `isEstimated = true`.
    - No applicable obligation: `obligationType = "none"`, `isEstimated = false`.
  - **Regression Coverage**: Updated `Test 3C.37` in [`tests/budget.test.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/tests/budget.test.ts) to verify upcoming obligations without a snapshot (`estimated`), upcoming obligations with an explicit snapshot (`recorded`), and non-applicable accounts (`none`).

---

### 2. Following-Cycle Credit Minimum Policy & Parity with Recurring Bills

| Characteristic | Recurring Bills (Phase 3A) | Credit Card Minimums (Phase 3C) |
|---|---|---|
| **Current Paycheck Window** (`due <= currentPaydayEnd`) | Always reserved in `currentCycleBills` and deducted from Safe to Spend. | Always reserved in `currentCycleMinimums` and deducted from Safe to Spend (including all overdue obligations). |
| **Following Paycheck Window** (`currentPaydayEnd < due <= followingEnd`) | Tracked in breakdown; reserved in `protectedCycleBills` and deducted from Safe to Spend **only if** `bill.protected === true`. | Tracked in breakdown (`followingCycleMinimums`); reserved in `protectedFollowingMinimums` and deducted from Safe to Spend **only if** `account.protected === true`. |
| **Beyond Horizon** (`due > followingEnd`) | Ignored for immediate planning. | Ignored for immediate planning (`dueCycle: "none"`). |
| **Covered Credit Deduplication** | N/A (bills do not use Covered Credit). | Fully deduplicated against `readyToPay`: $\max(0, \text{remainingMin} - \text{readyToPay})$. |
| **Occurrences per Window** | Multi-occurrence evaluation supported (e.g. semimonthly bills). | Single active cycle target per card (`dueDate`), preventing duplicate reservations. |
| **Overdue Handling** | Overdue occurrences evaluated from `trackingStartDate`. | Overdue minimums forced to `dueCycle: "current"` with highest priority. |

---

### 3. Verification & Test Metrics

- **Automated Tests**: 161 passing tests (`node --test tests/budget.test.ts`), 0 failures, 0 skipped.
  - Added 17 new regression tests `Test 3C.21` through `Test 3C.37`:
    - `Test 3C.21`: Changing minimum payment amount on overdue card retains overdue obligation without silent discard.
    - `Test 3C.22`: Changing card balance does not retroactively invent past statement satisfaction.
    - `Test 3C.23`: Due date boundary payment absorption: late payment satisfies overdue obligation first without double-counting in next cycle.
    - `Test 3C.24`: Explicit cycle-level confirmation via `confirmCreditCardMinimum` advances cycle cleanly and separates confirmed from estimated satisfaction.
    - `Test 3C.25`: Following-payday minimum protection with `account.protected === false` (tracked in breakdown, not deducted from Safe to Spend).
    - `Test 3C.26`: Following-payday minimum protection with `account.protected === true` (protected in breakdown and deducted from Safe to Spend).
    - `Test 3C.27`: Overdue minimum priority: overdue is always treated as current-cycle priority and protected immediately.
    - `Test 3C.28`: Deterministic regression for dashboard Expenses $0.00 issue: legacy transactions lacking status field are accurately included in monthly expenses.
    - `Test 3C.29`: Monthly expenses inclusion and exclusion: includes credit purchases and bill payments, excludes transfers and card repayments.
    - `Test 3C.30`: Scheduled expenses separation: scheduled purchases do not contaminate actual spending totals or monthly expenses.
    - `Test 3C.31`: Zero expenses formatting: eliminates IEEE-754 negative zero (`-0`) and verifies `money()` never renders `-$0.00`.
    - `Test 3C.32`: Historical minimum-payment stability: editing card's minimum or balance does not rewrite previously established obligation.
    - `Test 3C.33`: Due date validation before recording manual statement confirmation.
    - `Test 3C.34`: Avoid fabricating historical minimums for legacy accounts where no snapshot exists.
    - `Test 3C.35`: Snapshot lifecycle: `updateAccount` preserves overdue obligations and prevents future due date contamination.
    - `Test 3C.36`: Unsnapshotted overdue cycles are protected as estimates without creating synthetic snapshots on settings edits.
    - `Test 3C.37`: A new card configured after its previous due date does not acquire a fabricated overdue statement.
- **Production Build**: `npm run build` (`vue-tsc -b && vite build`) passed cleanly with 0 TypeScript or bundling errors.

---

## Phase 3D — Simplified Bills UI & Regression (Completed)

**Branch**: `phase/3d-simplified-bills-ui-regression`  
**Status**: Completed, verified with full regression suite.

### 1. Objective & Core Principle

**Core Principle**: Make bills easier to understand, not more complicated to manage.

Phase 3D focuses on improving the usability, clarity, and actionable organization of Bills without rewriting the underlying financial calculation engine established in Phases 3A–3C.

The Bills interface directly and immediately answers four core questions for every tracked bill:
1. **What do I owe?** (`expectedAmount`)
2. **When is it due?** (`dueDate`)
3. **How much have I already paid?** (`paidAmount`)
4. **What still needs to be paid?** (`remainingAmount`)

---

### 2. Architecture & Presentation Model

#### Pure Model Functions (`src/model.ts`)
- **`isBillDueSoon(dueDate: string, asOf = today(), windowDays = 3): boolean`**:
  - Deterministically evaluates if an active due date falls within a standardized date-based window (`dueDate >= asOf && dueDate <= addDays(asOf, windowDays)`).
  - Past due dates (`dueDate < asOf`) are categorized as overdue, never due soon.
  - Dates beyond the window are categorized as upcoming.
- **`getBillItemPresentation(s: State, b: Bill, now = today(), precomputedBreakdown?: BillReservationBreakdown): BillItemPresentation`**:
  - Targets the most relevant occurrence for the bill:
    - If an earlier unpaid/partially paid occurrence is overdue (`unpaidDue < now`), prioritizes the overdue occurrence.
    - If past occurrences are settled or paid, evaluates the current calendar month occurrence. If this month's bill is already settled or paid, presents it cleanly as `Paid` / `Overpaid` rather than silently jumping forward and giving the false impression of an unpaid obligation.
  - Computes `expectedAmount`, `paidAmount`, `remainingAmount`, and `overpaidAmount`.
  - Determines status:
    - `paid`: `remainingAmount === 0` (status label: "Paid" or "Overpaid").
    - `overdue`: `dueDate < now && remainingAmount > 0` (status label: "Overdue").
    - `partially_paid`: `paidAmount > 0 && remainingAmount > 0` (status label: "Partially paid").
    - `due_soon`: `dueDate >= now && dueDate <= addDays(now, 3) && paidAmount === 0 && remainingAmount > 0` (status label: "Due soon").
    - `upcoming`: `dueDate > addDays(now, 3) && paidAmount === 0 && remainingAmount > 0` (status label: "Upcoming").
  - Evaluates Payday Protection status from existing `reserveBillsBreakdown` details without duplicate computation:
    - `current_cycle`: "Reserved through payday"
    - `following_protected`: "Protected next cycle"
    - `unprotected`: "Not reserved" (or "Paid" if fully settled)
- **`getOrganizedBills(s: State, now = today()): BillItemPresentation[]`**:
  - Sorts bills by urgency and actionability:
    1. Overdue bills (rank 0)
    2. Due soon bills (rank 1, including partially paid bills due soon)
    3. Other upcoming bills (rank 2)
    4. Fully paid bills (rank 3, visually quieter)
  - Secondary sort: `dueDate` ascending; tiebreaker: bill name ascending.

#### State & Composable Integration
- **`useBudget.ts`**:
  - Exposes reactive, cached `organizedBills` computed property and `getBillItemPresentation`.
- **`useModal.ts`**:
  - Supports explicit occurrence due date preselection via `open("Pay bill", billId, occurrenceDueDate)`.
  - Dynamically computes and displays the remaining obligation in the post-payment toast notification:
    - If remaining obligation > 0: `"Bill payment recorded. Remaining obligation: $XX.XX."`
    - If fully paid: `"Bill payment recorded. Paid in full."`
    - If scheduled: `"Scheduled bill payment recorded. Will not affect balance until confirmed."`

#### UI Redesign (`RecurringBillsView.vue` & `_bills.css`)
- **Card-Based Visual Hierarchy**:
  - Replaces crowded tabular rows with structured, spacious cards (`.bill-item`).
  - Clear accent indicators: red left border for overdue, amber for due soon, blue for partial.
  - Visually quieter treatment for fully paid bills (`opacity: 0.72`, soft background, quiet checkmark, no competing calls to action).
- **The 4 Questions Metric Grid**:
  - Dedicated 4-column metric grid on desktop (responsive 2x2 on mobile):
    - When is it due?
    - What do I owe?
    - Already paid (highlighted in teal if > 0)
    - Still to pay (prominently styled in bold amber if > 0, soft neutral if $0.00)
- **Visual Progress Bar**: Displays payment completion percentage for partially paid bills.
- **Payday Protection Indicator**: Subtle tag with color dot indicating reservation status.
- **Occurrence-Preserving Actions**:
  - "Pay bill" / "Pay remaining ($XX.XX)" preselects the exact bill occurrence in `ActionDialog`.
  - "Protect next cycle" toggle for bills due between current and following paydays.
  - "Paid before setup" button for recording historical pre-setup occurrences without cash deductions.

---

### 3. Financial Invariants Preserved

1. **Reservation Source of Truth**: All bill reservation amounts and payday protection cycles are sourced directly from `reserveBillsBreakdown(state, now)`. No parallel calculation or second reservation engine is introduced.
2. **Covered Credit Integrity**: Paying bills using a credit card retains complete Covered Credit semantics: credit balance/debt increases, transaction is registered in the ledger, and Covered Credit reserves cash in checking to cover future card payoffs.
3. **Account Balances Single-Touch**: Bill payments affect cash/checking ledger balances exactly once. No double-counting in totals or Safe to Spend.
4. **Scheduled Expense Deduplication**: Scheduled transactions linked to recurring bills are deduplicated against tracked bill reservations; `getUncoveredScheduledExpenses()` never double-reserves the same obligation.
5. **Phase 3C Minimum-Payment Safeguards**: Credit card minimum obligations and safeguards remain intact and fully isolated from bill UI logic. Safe to Spend continues to deduct bills and minimums with signed arithmetic.

---

### 4. Regression Tests Added (Test Suite 3D)

Added 17 comprehensive unit and integration tests in [`tests/budget.test.ts`](file:///c:/Users/kaleb/Documents/Github/Mika-Budget/tests/budget.test.ts):
- `Test 3D.1`: `isBillDueSoon` boundary conditions (today, +1 day, +3 days, +4 days, past dates, invalid inputs).
- `Test 3D.2`: Unpaid bill presentation answers the 4 core questions (`expectedAmount`, `dueDate`, `paidAmount = 0`, `remainingAmount`).
- `Test 3D.3`: Due soon bill presentation (due within 3 days, `status === "due_soon"`, rank 1).
- `Test 3D.4`: Overdue bill presentation (past due date, `status === "overdue"`, rank 0).
- `Test 3D.5`: Partial payment reduces remaining obligation correctly (`isPartiallyPaid = true`, status "Partially paid").
- `Test 3D.6`: Full payment removes unpaid reservation and presents as Paid (rank 3, visually quieter).
- `Test 3D.7`: Overpayment does not create negative remaining amounts (clamped at 0, tracks `overpaidAmount`).
- `Test 3D.8`: Multiple payments linked to one occurrence accumulate toward the same occurrence.
- `Test 3D.9`: Bill payment affects account balances exactly once (ledger delta -$30, balance updated accurately).
- `Test 3D.10`: Credit card bill payments preserve Covered Credit rules (card owes debt, Covered Credit tracks debt).
- `Test 3D.11`: Scheduled expenses deduplication against tracked bills (zero duplicate reservation in `getUncoveredScheduledExpenses`).
- `Test 3D.12`: Payday protection classification (`current_cycle`, `following_protected`, `unprotected`).
- `Test 3D.13`: Editing or deleting linked payments dynamically recalculates occurrence and presentation.
- `Test 3D.14`: Bill organization ordering (Overdue -> Due soon -> Upcoming -> Paid).
- `Test 3D.15`: Edge cases: future tracking start date and out-of-horizon bills.
- `Test 3D.16`: Safe to Spend and Credit Card Minimum safeguards (Phase 3C) remain intact.
- `Test 3D.17`: Composable & Modal workflow integration (occurrence preselection, remaining obligation toast).

---

### 5. Verification Results

- **Automated Tests**: 178 passing tests (`node --test tests/budget.test.ts`), 0 failures, 0 skipped.
- **Production Build**: `npm run build` (`vue-tsc -b && vite build`) passed cleanly in 1.58s.





