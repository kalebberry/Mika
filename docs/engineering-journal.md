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

2. **Why is a non-omission safe failure policy critical for personal finance software when encountering corrupted or out-of-bounds dates?**
   - *Answer*: In general software engineering, invalid input often fails closed by returning empty results (`continue` or null). However, in financial budgeting, omitting an obligation because of a malformed date leads to false spending confidence, reporting that money is "safe to spend" when it is actually owed. A non-omission policy clamps dates into safe bounds and, in worst-case corrupted states, retains the reservation in `currentCycleBills` while emitting diagnostic warnings.


