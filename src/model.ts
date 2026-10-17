export type TransactionStatus = "scheduled" | "pending" | "cleared" | "posted";
export type TransactionKind = "standard" | "transfer" | "payment";

export function isLedgerStatus(status?: string): boolean {
  return status === "pending" || status === "cleared" || status === "posted";
}

export type Transaction = {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  billId?: string;
  billDueDate?: string;
  status?: TransactionStatus;
  postedDate?: string;
  accountId?: string;
  kind?: TransactionKind;
  targetAccountId?: string;
  isLegacyDebt?: boolean;
  createdAt?: string;
};

export type Budget = {
  id: string;
  name?: string;
  category: string;
  limit: number;
  color: string;
};

export type Pot = {
  id: string;
  name: string;
  saved: number;
  target: number;
  color: string;
};

export type Bill = {
  id: string;
  name: string;
  amount: number;
  day: number;
  protected?: boolean;
  settledDueDates?: string[];
  trackingStartDate?: string; // YYYY-MM-DD
};

export type BillSettlement = {
  billId: string;
  dueDate: string;
  settledAt?: string;
};

export type AccountType = "checking" | "savings" | "credit";

export interface PaymentReservation {
  id: string;
  amount: number; // Integer cents: positive = reserve added, negative = reserve released
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  opening: number; // Integer cents. Baseline opening balance for the account
  balance?: number; // Integer cents. For manual accounts without transaction ledgers, holds current balance
  creditLimit?: number; // Integer cents (credit card only)
  dueDay?: number; // 1-31 (credit card only)
  minPayment?: number; // Integer cents (credit card only)
  includeInSafeToSpend: boolean; // True for primary checking, default false for savings/credit
  archived?: boolean; // Soft-delete / hide from active views
  createdAt: string;
  updatedAt: string;
  assignedPaymentReserve?: number; // Integer cents (credit card only). Current net manual reserve
  paymentReservations?: PaymentReservation[]; // Chronological manual reservation entries
  coveredCreditBaselineAt?: string; // ISO timestamp of baseline
  confirmedMinimumDueDates?: string[]; // YYYY-MM-DD confirmed paid minimum due dates
  protected?: boolean; // Credit card following-payday protection flag (mirrors Bill.protected)
  minimumObligations?: Record<string, number>; // Maps YYYY-MM-DD due date to required minimum in integer cents
}

export type PaydayFrequency =
  | "manual"
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly";

export type WeekendRule = "exact" | "preceding_friday";

export interface PaydayOverride {
  id: string;
  scheduledDate: string; // YYYY-MM-DD (nominal scheduled occurrence)
  overrideDate: string; // YYYY-MM-DD (actual substitute payday date)
  note?: string;
  createdAt: string; // ISO timestamp
}

export interface PaydaySchedule {
  frequency: PaydayFrequency;
  anchorDate: string; // YYYY-MM-DD
  dayOfMonth?: number; // 1-31 (monthly)
  firstDay?: number; // 1-31 (semimonthly)
  secondDay?: number; // 1-31 (semimonthly)
  weekendRule: WeekendRule; // "exact" (default) | "preceding_friday"
  manualFollowingPayday?: string; // YYYY-MM-DD (manual mode)
  overrides: PaydayOverride[];
}

export interface OverrideValidationResult {
  valid: boolean;
  error?: string;
}

export type State = {
  version: 2 | 3 | 4 | 5;
  demo: boolean;
  opening: number;
  payday: string;
  followingPayday?: string;
  paydaySchedule: PaydaySchedule;
  transactions: Transaction[];
  budgets: Budget[];
  pots: Pot[];
  bills: Bill[];
  settledBills?: BillSettlement[];
  accounts: Account[];
};

export interface ThemeColor {
  name: string;
  value: string;
}

export const themeColors: ThemeColor[] = [
  { name: "Teal (Green)", value: "#277c78" },
  { name: "Cyan (Sky)", value: "#82c9d7" },
  { name: "Slate (Navy)", value: "#626070" },
  { name: "Peach (Yellow)", value: "#f2cdac" },
  { name: "Purple (Lavender)", value: "#826cb0" },
  { name: "Turquoise", value: "#597c7c" },
  { name: "Coral (Red)", value: "#c94736" },
  { name: "Magenta (Berry)", value: "#934f6f" },
  { name: "Blue (Cobalt)", value: "#3f82b2" },
  { name: "Gold (Amber)", value: "#cab361" },
  { name: "Orange (Terracotta)", value: "#be6c49" },
  { name: "Army Green", value: "#7f9161" },
  { name: "Rose Pink", value: "#af81ba" },
  { name: "Steel Grey", value: "#97a0ac" },
  { name: "Brown (Tan)", value: "#93674f" },
  { name: "Emerald (Forest)", value: "#1e824c" },
];

export const colors = themeColors.map((tc) => tc.value);

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const cents = (v: number) => Math.round(v * 100);
export const uid = () => crypto.randomUUID();

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function daysBetween(dateA: string, dateB: string): number {
  const [y1, m1, d1] = dateA.split("-").map(Number);
  const [y2, m2, d2] = dateB.split("-").map(Number);
  const utc1 = Date.UTC(y1!, m1! - 1, d1!);
  const utc2 = Date.UTC(y2!, m2! - 1, d2!);
  return Math.round((utc2 - utc1) / 86400000);
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function formatYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isValidDateString(dateStr?: string | null): dateStr is string {
  if (typeof dateStr !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  if (m < 1 || m > 12) return false;
  const maxDays = getDaysInMonth(y, m);
  return d >= 1 && d <= maxDays;
}

export function adjustForWeekend(
  dateStr: string,
  rule: WeekendRule = "exact",
): string {
  if (rule === "exact") return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  // 0 is Sunday, 6 is Saturday
  if (dayOfWeek === 6) {
    return addDays(dateStr, -1);
  }
  if (dayOfWeek === 0) {
    return addDays(dateStr, -2);
  }
  return dateStr;
}

export function isNominalOccurrence(
  schedule: PaydaySchedule,
  dateStr: string,
): boolean {
  if (!isValidDateString(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);

  if (schedule.frequency === "manual") {
    const first = schedule.anchorDate;
    const second = schedule.manualFollowingPayday || addDays(first, 14);
    if (dateStr === first || dateStr === second) return true;
    const rawDiff = daysBetween(first, second);
    const interval = rawDiff > 0 ? rawDiff : 14;
    if (dateStr > second) {
      const diff = daysBetween(second, dateStr);
      return diff % interval === 0;
    }
    return false;
  }

  if (schedule.frequency === "weekly") {
    const diff = daysBetween(schedule.anchorDate, dateStr);
    return ((diff % 7) + 7) % 7 === 0;
  }

  if (schedule.frequency === "biweekly") {
    const diff = daysBetween(schedule.anchorDate, dateStr);
    return ((diff % 14) + 14) % 14 === 0;
  }

  if (schedule.frequency === "monthly") {
    const targetDay =
      schedule.dayOfMonth !== undefined
        ? schedule.dayOfMonth
        : Number(schedule.anchorDate.split("-")[2]);
    const maxDays = getDaysInMonth(y!, m!);
    return d === Math.min(targetDay, maxDays);
  }

  if (schedule.frequency === "semimonthly") {
    const firstDay = Math.min(
      schedule.firstDay !== undefined ? schedule.firstDay : 15,
      schedule.secondDay !== undefined ? schedule.secondDay : 31,
    );
    const secondDay = Math.max(
      schedule.firstDay !== undefined ? schedule.firstDay : 15,
      schedule.secondDay !== undefined ? schedule.secondDay : 31,
    );
    const maxDays = getDaysInMonth(y!, m!);
    return d === Math.min(firstDay, maxDays) || d === Math.min(secondDay, maxDays);
  }

  return false;
}

export function resolveNominalOccurrenceDate(
  schedule: PaydaySchedule,
  dateStr: string,
): string | null {
  if (isNominalOccurrence(schedule, dateStr)) {
    return dateStr;
  }
  if (schedule.weekendRule === "preceding_friday") {
    const candSat = addDays(dateStr, 1);
    if (
      isNominalOccurrence(schedule, candSat) &&
      adjustForWeekend(candSat, "preceding_friday") === dateStr
    ) {
      return candSat;
    }
    const candSun = addDays(dateStr, 2);
    if (
      isNominalOccurrence(schedule, candSun) &&
      adjustForWeekend(candSun, "preceding_friday") === dateStr
    ) {
      return candSun;
    }
  }
  return null;
}

export function getAdjacentOccurrences(
  schedule: PaydaySchedule,
  nominalDate: string,
): { prev: string; next: string } {
  const [y, m, d] = nominalDate.split("-").map(Number);

  if (schedule.frequency === "weekly") {
    return {
      prev: addDays(nominalDate, -7),
      next: addDays(nominalDate, 7),
    };
  }

  if (schedule.frequency === "biweekly") {
    return {
      prev: addDays(nominalDate, -14),
      next: addDays(nominalDate, 14),
    };
  }

  if (schedule.frequency === "monthly") {
    const targetDay =
      schedule.dayOfMonth !== undefined
        ? schedule.dayOfMonth
        : Number(schedule.anchorDate.split("-")[2]);

    let prevY = y!;
    let prevM = m! - 1;
    if (prevM < 1) {
      prevM = 12;
      prevY--;
    }
    const prev = formatYMD(
      prevY,
      prevM,
      Math.min(targetDay, getDaysInMonth(prevY, prevM)),
    );

    let nextY = y!;
    let nextM = m! + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY++;
    }
    const next = formatYMD(
      nextY,
      nextM,
      Math.min(targetDay, getDaysInMonth(nextY, nextM)),
    );

    return { prev, next };
  }

  if (schedule.frequency === "semimonthly") {
    const day1 = Math.min(
      schedule.firstDay !== undefined ? schedule.firstDay : 15,
      schedule.secondDay !== undefined ? schedule.secondDay : 31,
    );
    const day2 = Math.max(
      schedule.firstDay !== undefined ? schedule.firstDay : 15,
      schedule.secondDay !== undefined ? schedule.secondDay : 31,
    );
    const maxDaysCurr = getDaysInMonth(y!, m!);
    const isFirst = d === Math.min(day1, maxDaysCurr);

    if (isFirst) {
      let prevY = y!;
      let prevM = m! - 1;
      if (prevM < 1) {
        prevM = 12;
        prevY--;
      }
      const prev = formatYMD(
        prevY,
        prevM,
        Math.min(day2, getDaysInMonth(prevY, prevM)),
      );
      const next = formatYMD(y!, m!, Math.min(day2, maxDaysCurr));
      return { prev, next };
    } else {
      const prev = formatYMD(y!, m!, Math.min(day1, maxDaysCurr));
      let nextY = y!;
      let nextM = m! + 1;
      if (nextM > 12) {
        nextM = 1;
        nextY++;
      }
      const next = formatYMD(
        nextY,
        nextM,
        Math.min(day1, getDaysInMonth(nextY, nextM)),
      );
      return { prev, next };
    }
  }

  // Manual mode:
  const first = schedule.anchorDate;
  const second = schedule.manualFollowingPayday || addDays(first, 14);
  const rawDiff = daysBetween(first, second);
  const diff = rawDiff > 0 ? rawDiff : 14;
  if (nominalDate === first) {
    return {
      prev: addDays(first, -diff),
      next: second,
    };
  }
  if (nominalDate === second) {
    return {
      prev: first,
      next: addDays(second, diff),
    };
  }
  if (nominalDate > second) {
    return {
      prev: addDays(nominalDate, -diff),
      next: addDays(nominalDate, diff),
    };
  }
  return {
    prev: addDays(nominalDate, -diff),
    next: addDays(nominalDate, diff),
  };
}

export function getEffectiveOccurrenceDate(
  schedule: PaydaySchedule,
  nominal: string,
  overrides: PaydayOverride[] = schedule.overrides || [],
): string {
  const ov = overrides.find((o) => o.scheduledDate === nominal);
  if (ov) return ov.overrideDate;
  if (
    schedule.frequency === "manual" &&
    (nominal === schedule.anchorDate ||
      nominal === schedule.manualFollowingPayday)
  ) {
    return nominal;
  }
  return adjustForWeekend(nominal, schedule.weekendRule);
}

export function getUpcomingPaydays(
  schedule: PaydaySchedule,
  asOf: string = today(),
  count: number = 3,
): string[] {
  if (count <= 0) return [];

  const effectiveAsOf = isValidDateString(asOf) ? asOf : today();
  const nominals = new Set<string>();

  // Include any scheduledDate explicitly overridden that belongs to this schedule
  for (const o of schedule.overrides || []) {
    if (o && isValidDateString(o.scheduledDate)) {
      if (resolveNominalOccurrenceDate(schedule, o.scheduledDate) !== null) {
        nominals.add(o.scheduledDate);
      }
    }
  }

  if (schedule.frequency === "manual") {
    const first = isValidDateString(schedule.anchorDate)
      ? schedule.anchorDate
      : effectiveAsOf;
    const manualSecond = schedule.manualFollowingPayday;
    const second: string =
      isValidDateString(manualSecond) && manualSecond > first
        ? manualSecond
        : addDays(first, 14);
    const rawDiff = daysBetween(first, second);
    const interval = rawDiff > 0 ? rawDiff : 14;

    nominals.add(first);
    nominals.add(second);

    const forwardSteps = Math.max(
      count + 5,
      Math.ceil(daysBetween(second, effectiveAsOf) / interval) + count + 10,
    );
    for (let i = 1; i <= forwardSteps; i++) {
      nominals.add(addDays(second, i * interval));
    }
  } else if (schedule.frequency === "weekly") {
    const anchor = isValidDateString(schedule.anchorDate)
      ? schedule.anchorDate
      : effectiveAsOf;
    const diff = daysBetween(anchor, effectiveAsOf);
    const kCenter = Math.floor(diff / 7);
    for (let k = kCenter - 14; k <= kCenter + count + 20; k++) {
      nominals.add(addDays(anchor, k * 7));
    }
  } else if (schedule.frequency === "biweekly") {
    const anchor = isValidDateString(schedule.anchorDate)
      ? schedule.anchorDate
      : effectiveAsOf;
    const diff = daysBetween(anchor, effectiveAsOf);
    const kCenter = Math.floor(diff / 14);
    for (let k = kCenter - 8; k <= kCenter + count + 15; k++) {
      nominals.add(addDays(anchor, k * 14));
    }
  } else if (schedule.frequency === "monthly") {
    const anchorDay = isValidDateString(schedule.anchorDate)
      ? Number(schedule.anchorDate.split("-")[2])
      : 1;
    const targetDay =
      schedule.dayOfMonth !== undefined ? schedule.dayOfMonth : anchorDay;
    const [asOfY, asOfM] = effectiveAsOf.split("-").map(Number);
    for (let offset = -4; offset <= count + 12; offset++) {
      let m = asOfM! + offset;
      let y = asOfY!;
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      const maxDays = getDaysInMonth(y, m);
      const clampedDay = Math.min(targetDay, maxDays);
      nominals.add(formatYMD(y, m, clampedDay));
    }
  } else if (schedule.frequency === "semimonthly") {
    const targetFirst =
      schedule.firstDay !== undefined ? schedule.firstDay : 15;
    const targetSecond =
      schedule.secondDay !== undefined ? schedule.secondDay : 31;
    const day1 = Math.min(targetFirst, targetSecond);
    const day2 = Math.max(targetFirst, targetSecond);
    const [asOfY, asOfM] = effectiveAsOf.split("-").map(Number);
    for (let offset = -4; offset <= count + 12; offset++) {
      let m = asOfM! + offset;
      let y = asOfY!;
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      const maxDays = getDaysInMonth(y, m);
      nominals.add(formatYMD(y, m, Math.min(day1, maxDays)));
      nominals.add(formatYMD(y, m, Math.min(day2, maxDays)));
    }
  }

  const candidates = new Set<string>();
  for (const nom of nominals) {
    const effective = getEffectiveOccurrenceDate(
      schedule,
      nom,
      schedule.overrides,
    );
    if (isValidDateString(effective) && effective >= effectiveAsOf) {
      candidates.add(effective);
    }
  }

  const sorted = Array.from(candidates).sort((a, b) => a.localeCompare(b));
  return sorted.slice(0, count);
}

export function getNextPayday(
  schedule: PaydaySchedule,
  asOf: string = today(),
): string {
  const paydays = getUpcomingPaydays(schedule, asOf, 1);
  return paydays[0] || schedule.anchorDate || asOf;
}

export function getFollowingPaydayDate(
  schedule: PaydaySchedule,
  asOf: string = today(),
): string {
  const paydays = getUpcomingPaydays(schedule, asOf, 2);
  return paydays[1] || addDays(getNextPayday(schedule, asOf), 14);
}

export function getConfirmedUpcomingPaydays(
  schedule: PaydaySchedule | undefined,
  asOf: string = today(),
): string[] {
  if (!schedule) return [];
  const effectiveAsOf = isValidDateString(asOf) ? asOf : today();

  if (schedule.frequency !== "manual") {
    return getUpcomingPaydays(schedule, effectiveAsOf, 3);
  }

  const confirmed = new Set<string>();

  // 1. Check anchorDate if valid
  if (isValidDateString(schedule.anchorDate)) {
    const effectiveAnchor = getEffectiveOccurrenceDate(
      schedule,
      schedule.anchorDate,
      schedule.overrides,
    );
    if (isValidDateString(effectiveAnchor) && effectiveAnchor >= effectiveAsOf) {
      confirmed.add(effectiveAnchor);
    }
  }

  // 2. Check manualFollowingPayday if explicitly configured
  if (isValidDateString(schedule.manualFollowingPayday)) {
    const effectiveFollowing = getEffectiveOccurrenceDate(
      schedule,
      schedule.manualFollowingPayday,
      schedule.overrides,
    );
    if (
      isValidDateString(effectiveFollowing) &&
      effectiveFollowing >= effectiveAsOf
    ) {
      confirmed.add(effectiveFollowing);
    }
  }

  // 3. Check any valid, explicitly configured one-time overrides
  for (const o of schedule.overrides || []) {
    if (
      o &&
      isValidDateString(o.scheduledDate) &&
      isValidDateString(o.overrideDate)
    ) {
      // Must be a valid nominal occurrence on this manual schedule
      if (resolveNominalOccurrenceDate(schedule, o.scheduledDate) !== null) {
        if (o.overrideDate >= effectiveAsOf) {
          confirmed.add(o.overrideDate);
        }
      }
    }
  }

  return Array.from(confirmed).sort((a, b) => a.localeCompare(b));
}

export function validatePaydayOverride(
  schedule: PaydaySchedule,
  scheduledDate: string,
  overrideDate: string,
): OverrideValidationResult {
  if (!isValidDateString(scheduledDate)) {
    return {
      valid: false,
      error: "Scheduled date must be a valid date in YYYY-MM-DD format.",
    };
  }
  if (!isValidDateString(overrideDate)) {
    return {
      valid: false,
      error: "Override date must be a valid date in YYYY-MM-DD format.",
    };
  }

  const resolvedNominal = resolveNominalOccurrenceDate(schedule, scheduledDate);
  if (!resolvedNominal) {
    return {
      valid: false,
      error: `Date ${scheduledDate} is not a valid scheduled occurrence for this payday schedule.`,
    };
  }

  // Collision check against other active overrides
  const otherOverrides = (schedule.overrides || []).filter(
    (o) => o.scheduledDate !== resolvedNominal,
  );
  if (otherOverrides.some((o) => o.overrideDate === overrideDate)) {
    return {
      valid: false,
      error: `Override date ${overrideDate} collides with another payday override.`,
    };
  }

  // Ordering bounds check (cannot cross adjacent occurrences)
  const adjacent = getAdjacentOccurrences(schedule, resolvedNominal);
  const effectivePrev = getEffectiveOccurrenceDate(
    schedule,
    adjacent.prev,
    otherOverrides,
  );
  const effectiveNext = getEffectiveOccurrenceDate(
    schedule,
    adjacent.next,
    otherOverrides,
  );

  if (overrideDate <= effectivePrev) {
    return {
      valid: false,
      error: `Override date cannot be on or before the preceding payday (${effectivePrev}).`,
    };
  }

  if (overrideDate >= effectiveNext) {
    return {
      valid: false,
      error: `Override date cannot be on or after the following payday (${effectiveNext}).`,
    };
  }

  return { valid: true };
}

export function applyPaydayOverride(
  schedule: PaydaySchedule,
  override: Omit<PaydayOverride, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): { success: boolean; error?: string; schedule: PaydaySchedule } {
  const resolvedNominal = resolveNominalOccurrenceDate(
    schedule,
    override.scheduledDate,
  );
  const validation = validatePaydayOverride(
    schedule,
    override.scheduledDate,
    override.overrideDate,
  );
  if (!validation.valid) {
    return { success: false, error: validation.error, schedule };
  }

  const nominalKey = resolvedNominal || override.scheduledDate;
  const id = override.id || uid();
  const createdAt = override.createdAt || new Date().toISOString();
  const entry: PaydayOverride = {
    id,
    scheduledDate: nominalKey,
    overrideDate: override.overrideDate,
    note: override.note,
    createdAt,
  };

  const nextOverrides = (schedule.overrides || []).filter(
    (o) => o.scheduledDate !== nominalKey,
  );
  nextOverrides.push(entry);
  nextOverrides.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  return {
    success: true,
    schedule: {
      ...schedule,
      overrides: nextOverrides,
    },
  };
}

export function removePaydayOverride(
  schedule: PaydaySchedule,
  scheduledDateOrId: string,
): PaydaySchedule {
  return {
    ...schedule,
    overrides: (schedule.overrides || []).filter(
      (o) =>
        o.id !== scheduledDateOrId && o.scheduledDate !== scheduledDateOrId,
    ),
  };
}

export interface ScheduleValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  message?: string;
}

export function validatePaydaySchedule(
  schedule: Partial<PaydaySchedule>,
): ScheduleValidationResult {
  const errors: Record<string, string> = {};

  const validFrequencies: PaydayFrequency[] = [
    "weekly",
    "biweekly",
    "semimonthly",
    "monthly",
    "manual",
  ];
  if (!schedule.frequency || !validFrequencies.includes(schedule.frequency)) {
    errors.frequency = "Please select a valid schedule frequency.";
  }

  const validWeekendRules: WeekendRule[] = ["exact", "preceding_friday"];
  if (
    schedule.weekendRule !== undefined &&
    schedule.weekendRule !== null &&
    !validWeekendRules.includes(schedule.weekendRule)
  ) {
    errors.weekendRule = "Please select a valid weekend adjustment rule.";
  }

  // Anchor date validation
  if (!schedule.anchorDate || !isValidDateString(schedule.anchorDate)) {
    errors.anchorDate = "Please enter a valid anchor date in YYYY-MM-DD format.";
  }

  // Frequency-specific validations
  if (schedule.frequency === "monthly") {
    if (
      schedule.dayOfMonth === undefined ||
      schedule.dayOfMonth === null ||
      schedule.dayOfMonth === ("" as any)
    ) {
      errors.dayOfMonth = "Please enter a payday day of the month.";
    } else {
      const day = Number(schedule.dayOfMonth);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        errors.dayOfMonth = "Day of the month must be a whole number between 1 and 31.";
      }
    }
  } else if (schedule.frequency === "semimonthly") {
    let day1Valid = false;
    let day2Valid = false;
    let d1 = 0;
    let d2 = 0;

    if (
      schedule.firstDay === undefined ||
      schedule.firstDay === null ||
      schedule.firstDay === ("" as any)
    ) {
      errors.firstDay = "Please enter the first payday day.";
    } else {
      d1 = Number(schedule.firstDay);
      if (!Number.isInteger(d1) || d1 < 1 || d1 > 31) {
        errors.firstDay = "First payday day must be a whole number between 1 and 31.";
      } else {
        day1Valid = true;
      }
    }

    if (
      schedule.secondDay === undefined ||
      schedule.secondDay === null ||
      schedule.secondDay === ("" as any)
    ) {
      errors.secondDay = "Please enter the second payday day.";
    } else {
      d2 = Number(schedule.secondDay);
      if (!Number.isInteger(d2) || d2 < 1 || d2 > 31) {
        errors.secondDay = "Second payday day must be a whole number between 1 and 31.";
      } else {
        day2Valid = true;
      }
    }

    if (day1Valid && day2Valid && d1 === d2) {
      errors.secondDay = "The two payday days must be different days of the month.";
    }
  } else if (schedule.frequency === "manual") {
    if (
      schedule.manualFollowingPayday !== undefined &&
      schedule.manualFollowingPayday !== null &&
      schedule.manualFollowingPayday !== ""
    ) {
      if (!isValidDateString(schedule.manualFollowingPayday)) {
        errors.manualFollowingPayday =
          "Following payday must be a valid date in YYYY-MM-DD format.";
      } else if (
        isValidDateString(schedule.anchorDate) &&
        schedule.manualFollowingPayday <= schedule.anchorDate
      ) {
        errors.manualFollowingPayday =
          "Following payday must be strictly after the next payday.";
      }
    }
  }

  // Overrides validation if present
  if (Array.isArray(schedule.overrides)) {
    const dates = new Set<string>();
    for (const o of schedule.overrides) {
      if (
        !o ||
        !isValidDateString(o.scheduledDate) ||
        !isValidDateString(o.overrideDate)
      ) {
        errors.overrides = "All overrides must contain valid dates.";
        break;
      }
      if (dates.has(o.scheduledDate)) {
        errors.overrides =
          "Duplicate overrides for the same scheduled date are not allowed.";
        break;
      }
      dates.add(o.scheduledDate);

      // Verify that override scheduledDate is compatible with the schedule
      if (
        schedule.frequency &&
        schedule.anchorDate &&
        isValidDateString(schedule.anchorDate) &&
        !errors.frequency &&
        !errors.anchorDate &&
        !errors.dayOfMonth &&
        !errors.firstDay &&
        !errors.secondDay &&
        !errors.manualFollowingPayday
      ) {
        const fullSched: PaydaySchedule = {
          frequency: schedule.frequency,
          anchorDate: schedule.anchorDate,
          dayOfMonth:
            schedule.frequency === "monthly"
              ? Number(schedule.dayOfMonth)
              : undefined,
          firstDay:
            schedule.frequency === "semimonthly"
              ? Math.min(Number(schedule.firstDay), Number(schedule.secondDay))
              : undefined,
          secondDay:
            schedule.frequency === "semimonthly"
              ? Math.max(Number(schedule.firstDay), Number(schedule.secondDay))
              : undefined,
          weekendRule: schedule.weekendRule || "exact",
          manualFollowingPayday:
            schedule.frequency === "manual"
              ? schedule.manualFollowingPayday
              : undefined,
          overrides: [],
        };
        const resolved = resolveNominalOccurrenceDate(fullSched, o.scheduledDate);
        if (!resolved) {
          errors.overrides = `Override for ${o.scheduledDate} is not a valid occurrence for a ${schedule.frequency} schedule.`;
          break;
        }
      }
    }
  }

  const valid = Object.keys(errors).length === 0;
  const message = valid ? undefined : Object.values(errors)[0];
  return { valid, errors, message };
}

export function updatePaydaySchedule(
  state: State,
  draft: Partial<PaydaySchedule>,
): { success: boolean; errors?: Record<string, string>; message?: string } {
  const candidateOverrides = Array.isArray(draft.overrides)
    ? draft.overrides
    : state.paydaySchedule?.overrides || [];

  const candidateDraft: Partial<PaydaySchedule> = {
    ...draft,
    overrides: candidateOverrides,
  };

  const validation = validatePaydaySchedule(candidateDraft);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      message: validation.message,
    };
  }

  const freq = draft.frequency!;
  const anchorDate = draft.anchorDate!;
  const weekendRule: WeekendRule =
    draft.weekendRule === "preceding_friday" ? "preceding_friday" : "exact";

  let dayOfMonth: number | undefined;
  if (freq === "monthly") {
    dayOfMonth = Math.round(Number(draft.dayOfMonth));
  }

  let firstDay: number | undefined;
  let secondDay: number | undefined;
  if (freq === "semimonthly") {
    const d1 = Math.round(Number(draft.firstDay));
    const d2 = Math.round(Number(draft.secondDay));
    firstDay = Math.min(d1, d2);
    secondDay = Math.max(d1, d2);
  }

  let manualFollowingPayday: string | undefined;
  if (
    freq === "manual" &&
    draft.manualFollowingPayday &&
    isValidDateString(draft.manualFollowingPayday)
  ) {
    manualFollowingPayday = draft.manualFollowingPayday;
  }

  const overrides = Array.isArray(draft.overrides)
    ? [...draft.overrides]
    : [...candidateOverrides];

  state.paydaySchedule = {
    frequency: freq,
    anchorDate,
    dayOfMonth,
    firstDay,
    secondDay,
    weekendRule,
    manualFollowingPayday,
    overrides,
  };

  // Sync state.payday and state.followingPayday
  if (freq === "manual") {
    state.payday = anchorDate;
    state.followingPayday = manualFollowingPayday || addDays(anchorDate, 14);
  } else {
    state.payday = getCurrentPayday(state);
    state.followingPayday = getFollowingPayday(state);
  }

  return { success: true };
}

export function nextPayday() {
  return addDays(today(), 14);
}

export function getCurrentPayday(
  s: {
    payday: string;
    paydaySchedule?: PaydaySchedule;
  },
  asOf: string = today(),
): string {
  if (s.paydaySchedule && s.paydaySchedule.frequency !== "manual") {
    return getNextPayday(s.paydaySchedule, asOf);
  }
  return s.payday;
}

export function getFollowingPayday(
  s: {
    payday: string;
    followingPayday?: string;
    paydaySchedule?: PaydaySchedule;
  },
  asOf: string = today(),
): string {
  if (s.paydaySchedule && s.paydaySchedule.frequency !== "manual") {
    return getFollowingPaydayDate(s.paydaySchedule, asOf);
  }
  return s.followingPayday || addDays(s.payday, 14);
}

export function hasAccountLedgerActivity(account: Account, s: State): boolean {
  if (!s.transactions || !Array.isArray(s.transactions)) return false;
  return s.transactions.some((t) => {
    if (!isLedgerStatus(t.status)) return false;
    if (account.id === "acc-default-checking" && !t.accountId) return true;
    return t.accountId === account.id || t.targetAccountId === account.id;
  });
}

export function getAccountTransactionCount(account: Account | string, s: State): number {
  if (!s.transactions || !Array.isArray(s.transactions)) return 0;
  const accId = typeof account === "string" ? account : account.id;
  return s.transactions.filter(
    (t) =>
      t.accountId === accId ||
      t.targetAccountId === accId ||
      (!t.accountId && accId === "acc-default-checking"),
  ).length;
}

export type DeletionBlockReason =
  | "primary_checking"
  | "has_balance"
  | "has_transactions"
  | null;

export function getAccountDeletionBlockReason(
  account: Account | string,
  s: State,
): DeletionBlockReason {
  const accId = typeof account === "string" ? account : account.id;
  if (accId === "acc-default-checking") return "primary_checking";
  const acc = (s.accounts || []).find((a) => a.id === accId);
  if (!acc) return null;
  if (getAccountBalance(acc, s) !== 0) return "has_balance";
  if (getAccountTransactionCount(accId, s) > 0) return "has_transactions";
  return null;
}

export function canDeleteAccount(account: Account | string, s: State): boolean {
  return getAccountDeletionBlockReason(account, s) === null;
}

export function getAccountLedgerDelta(account: Account, s: State): number {
  if (!s.transactions || !Array.isArray(s.transactions)) return 0;

  let delta = 0;
  for (const t of s.transactions) {
    if (!isLedgerStatus(t.status)) continue;
    const kind = t.kind || "standard";
    const absAmt = Math.abs(t.amount);

    if (account.type === "credit") {
      // Credit card: balance represents debt owed
      if (kind === "standard") {
        const isThisAccount =
          t.accountId === account.id ||
          (!t.accountId && account.id === "acc-default-checking");
        if (isThisAccount) {
          if (t.amount < 0) {
            delta += absAmt; // Expense / purchase increases debt owed
          } else {
            delta -= absAmt; // Refund / credit reduces debt owed
          }
        }
      } else if (kind === "payment") {
        if (t.targetAccountId === account.id) {
          delta -= absAmt; // Payment to this card reduces debt owed
        }
      }
    } else {
      // Cash accounts (checking / savings): balance represents cash assets
      if (kind === "standard") {
        const isThisAccount =
          t.accountId === account.id ||
          (!t.accountId && account.id === "acc-default-checking");
        if (isThisAccount) {
          delta += t.amount;
        }
      } else if (kind === "transfer") {
        if (t.accountId === account.id) {
          delta -= absAmt; // Outflow from source
        }
        if (t.targetAccountId === account.id) {
          delta += absAmt; // Inflow to destination
        }
      } else if (kind === "payment") {
        if (t.accountId === account.id) {
          delta -= absAmt; // Cash payment outflow
        }
      }
    }
  }
  return delta;
}

export function getAccountBalance(account: Account, s: State): number {
  const delta = getAccountLedgerDelta(account, s);
  const opening = account.opening || 0;
  if (account.id === "acc-default-checking") {
    const checkingOpening =
      opening !== 0
        ? opening
        : s && typeof s.opening === "number"
          ? s.opening
          : opening;
    return checkingOpening + delta;
  }
  if (hasAccountLedgerActivity(account, s)) {
    return opening + delta;
  }
  return account.balance !== undefined ? account.balance : opening;
}

export function getAvailableCredit(account: Account, s?: State): number {
  if (account.type !== "credit") return 0;
  const currentBalance = s ? getAccountBalance(account, s) : (account.balance !== undefined ? account.balance : account.opening);
  const limit = account.creditLimit || 0;
  return Math.max(0, limit - currentBalance);
}

export function accountTotals(s: State) {
  const accounts = s.accounts || [];
  const activeAccounts = accounts.filter((a) => !a.archived);
  const cashAccounts = activeAccounts.filter((a) => a.type === "checking" || a.type === "savings");
  const creditAccounts = activeAccounts.filter((a) => a.type === "credit");

  const totalCashAssets = cashAccounts.reduce((sum, a) => sum + getAccountBalance(a, s), 0);
  const totalCreditDebt = creditAccounts.reduce((sum, a) => sum + Math.max(0, getAccountBalance(a, s)), 0);
  const totalAvailableCredit = creditAccounts.reduce((sum, a) => sum + getAvailableCredit(a, s), 0);

  return {
    totalCashAssets,
    totalCreditDebt,
    totalAvailableCredit,
    activeCount: activeAccounts.length,
    archivedCount: accounts.length - activeAccounts.length,
  };
}

export type CreditCoverageStatus =
  | "zero_balance"
  | "statement_credit"
  | "fully_covered"
  | "partially_covered"
  | "uncovered";

export function getCreditCardCoverageStatus(coverage: {
  totalOwed: number;
  readyToPay: number;
  uncoveredDebt: number;
  statementCredit: number;
}): CreditCoverageStatus {
  if (coverage.statementCredit > 0) return "statement_credit";
  if (coverage.totalOwed === 0) return "zero_balance";
  if (coverage.uncoveredDebt === 0) return "fully_covered";
  if (coverage.readyToPay > 0) return "partially_covered";
  return "uncovered";
}

export interface CreditCardCoverage {
  totalOwed: number; // Current liability (Math.max(0, balance))
  readyToPay: number; // Actual cash reserved in checking for repayment
  uncoveredDebt: number; // Math.max(0, totalOwed - readyToPay)
  statementCredit: number; // Math.max(0, -balance)
  availableCredit: number; // Math.max(0, limit - balance)
  grossReserve: number; // Total reserve in pool before clamping
  assignedReserve: number; // Net manual reservations
  manualReleasable: number; // Actual remaining manual reserve eligible for release
  status: CreditCoverageStatus;
}

export function getCreditCardCoverage(
  account: Account,
  s: State,
  now = today(),
): CreditCardCoverage {
  if (account.type !== "credit") {
    return {
      totalOwed: 0,
      readyToPay: 0,
      uncoveredDebt: 0,
      statementCredit: 0,
      availableCredit: 0,
      grossReserve: 0,
      assignedReserve: 0,
      manualReleasable: 0,
      status: "zero_balance",
    };
  }

  const currentBalance = getAccountBalance(account, s);
  const totalOwed = Math.max(0, currentBalance);
  const statementCredit = Math.max(0, -currentBalance);

  const manualEntries = Array.isArray(account.paymentReservations)
    ? [...account.paymentReservations]
    : [];

  if (manualEntries.length === 0 && (account.assignedPaymentReserve || 0) > 0) {
    manualEntries.push({
      id: "baseline-reserve",
      amount: account.assignedPaymentReserve || 0,
      date: (account.updatedAt || account.createdAt || now).slice(0, 10),
      createdAt: account.updatedAt || account.createdAt || now,
    });
  }

  const assignedReserve = manualEntries.reduce((sum, r) => sum + r.amount, 0);

  const allCardTransactions = (s.transactions || []).filter(
    (t) =>
      isLedgerStatus(t.status) &&
      (t.accountId === account.id || t.targetAccountId === account.id),
  );

  interface TimelineEvent {
    type: "purchase" | "payment" | "manual_reserve" | "refund";
    amount: number;
    category?: string;
    date: string;
    createdAt: string;
    isLegacyDebt?: boolean;
    txId?: string;
  }

  const events: TimelineEvent[] = [];

  for (const t of allCardTransactions) {
    const kind = t.kind || "standard";
    const absAmt = Math.abs(t.amount);
    const createdAt = t.createdAt || t.postedDate || t.date;

    if (kind === "payment" && t.targetAccountId === account.id) {
      events.push({
        type: "payment",
        amount: absAmt,
        date: t.date,
        createdAt,
        txId: t.id,
      });
    } else if (kind === "standard" && t.accountId === account.id) {
      if (t.amount < 0) {
        events.push({
          type: "purchase",
          amount: absAmt,
          category: t.category,
          date: t.date,
          createdAt,
          isLegacyDebt: Boolean(t.isLegacyDebt),
          txId: t.id,
        });
      } else if (t.amount > 0) {
        events.push({
          type: "refund",
          amount: absAmt,
          category: t.category,
          date: t.date,
          createdAt,
          txId: t.id,
        });
      }
    }
  }

  for (const r of manualEntries) {
    events.push({
      type: "manual_reserve",
      amount: r.amount,
      date: r.date,
      createdAt: r.createdAt || r.date,
    });
  }

  const typePriority = { refund: 1, purchase: 2, manual_reserve: 3, payment: 4 };
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const tsA = a.createdAt.length === 10 ? `${a.createdAt}T00:00:00.000Z` : a.createdAt;
    const tsB = b.createdAt.length === 10 ? `${b.createdAt}T00:00:00.000Z` : b.createdAt;
    if (tsA !== tsB) return tsA.localeCompare(tsB);
    return typePriority[a.type] - typePriority[b.type];
  });

  const categoryBudgetSpentMap = new Map<string, number>();

  let runningCardLiability = account.opening;
  let reservePool = 0;

  interface ReserveLot {
    type: "auto" | "manual";
    amount: number;
  }
  const reserveLots: ReserveLot[] = [];

  for (const ev of events) {
    if (ev.type === "refund") {
      runningCardLiability -= ev.amount;
    } else if (ev.type === "purchase") {
      runningCardLiability += ev.amount;

      // Legacy debt transactions never auto-fund
      const isEligible =
        !ev.isLegacyDebt &&
        (!account.coveredCreditBaselineAt ||
          ev.date >= account.coveredCreditBaselineAt.slice(0, 7));

      if (isEligible) {
        // Purchases when card is in statement credit absorb that credit first
        const liabilityBefore = runningCardLiability - ev.amount;
        const absorbsCredit =
          liabilityBefore < 0
            ? Math.min(ev.amount, Math.abs(liabilityBefore))
            : 0;
        const netRequiringCoverage = ev.amount - absorbsCredit;

        if (netRequiringCoverage > 0) {
          const month = ev.date.slice(0, 7);
          const cat = ev.category || "General";
          const key = `${month}:${cat.toLowerCase()}`;
          const budget = (s.budgets || []).find(
            (b) => b.category.toLowerCase() === cat.toLowerCase(),
          );

          let coveredPortion = 0;
          if (budget) {
            const limit = budget.limit;
            const alreadyUsed = categoryBudgetSpentMap.get(key) || 0;
            const remaining = Math.max(0, limit - alreadyUsed);
            coveredPortion = Math.min(netRequiringCoverage, remaining);
            categoryBudgetSpentMap.set(key, alreadyUsed + coveredPortion);
          } else {
            coveredPortion = 0;
          }

          reservePool += coveredPortion;
          if (coveredPortion > 0) {
            reserveLots.push({ type: "auto", amount: coveredPortion });
          }
        }
      }
    } else if (ev.type === "payment") {
      runningCardLiability -= ev.amount;
      const consumed = Math.min(reservePool, ev.amount);
      reservePool -= consumed;
      let toConsume = ev.amount;
      for (let i = 0; i < reserveLots.length; i++) {
        const lot = reserveLots[i]!;
        if (toConsume <= 0) break;
        const take = Math.min(lot.amount, toConsume);
        lot.amount -= take;
        toConsume -= take;
      }
    } else if (ev.type === "manual_reserve") {
      reservePool = Math.max(0, reservePool + ev.amount);
      if (ev.amount > 0) {
        reserveLots.push({ type: "manual", amount: ev.amount });
      } else if (ev.amount < 0) {
        let toRelease = Math.abs(ev.amount);
        for (let i = reserveLots.length - 1; i >= 0; i--) {
          const lot = reserveLots[i]!;
          if (lot.type === "manual") {
            const take = Math.min(lot.amount, toRelease);
            lot.amount -= take;
            toRelease -= take;
            if (toRelease <= 0) break;
          }
        }
      }
    }
  }

  const manualReservePool = reserveLots
    .filter((l) => l.type === "manual")
    .reduce((sum, l) => sum + l.amount, 0);
  const autoReservePool = reserveLots
    .filter((l) => l.type === "auto")
    .reduce((sum, l) => sum + l.amount, 0);

  const readyToPay = Math.max(0, Math.min(totalOwed, reservePool));
  const uncoveredDebt = Math.max(0, totalOwed - readyToPay);
  const availableCredit = getAvailableCredit(account, s);
  const manualInReadyToPay = Math.max(0, readyToPay - autoReservePool);
  const manualReleasable = Math.max(0, Math.min(manualReservePool, manualInReadyToPay));
  const status = getCreditCardCoverageStatus({
    totalOwed,
    readyToPay,
    uncoveredDebt,
    statementCredit,
  });

  return {
    totalOwed,
    readyToPay,
    uncoveredDebt,
    statementCredit,
    availableCredit,
    grossReserve: reservePool,
    assignedReserve,
    manualReleasable,
    status,
  };
}

export function assignCardPaymentReserve(
  account: Account,
  amount: number,
  now = today(),
): void {
  if (account.type !== "credit" || amount <= 0) return;
  if (!Array.isArray(account.paymentReservations)) {
    account.paymentReservations = [];
  }
  const dateStr = now.slice(0, 10);
  const createdStr = now.length > 10 ? now : `${dateStr}T00:00:00.000Z`;
  const entry: PaymentReservation = {
    id: uid(),
    amount,
    date: dateStr,
    createdAt: createdStr,
  };
  account.paymentReservations.push(entry);
  account.assignedPaymentReserve = account.paymentReservations.reduce(
    (sum, r) => sum + r.amount,
    0,
  );
  account.updatedAt = createdStr;
}

export function releaseCardPaymentReserve(
  account: Account,
  amount: number,
  s: State,
  now = today(),
): boolean {
  if (account.type !== "credit" || amount <= 0) return false;
  const coverage = getCreditCardCoverage(account, s, now);
  if (amount > coverage.manualReleasable) return false;

  if (!Array.isArray(account.paymentReservations)) {
    account.paymentReservations = [];
  }
  const dateStr = now.slice(0, 10);
  const createdStr = now.length > 10 ? now : `${dateStr}T00:00:00.000Z`;
  const entry: PaymentReservation = {
    id: uid(),
    amount: -amount,
    date: dateStr,
    createdAt: createdStr,
  };
  account.paymentReservations.push(entry);
  account.assignedPaymentReserve = account.paymentReservations.reduce(
    (sum, r) => sum + r.amount,
    0,
  );
  account.updatedAt = createdStr;
  return true;
}

export function setCreditCardMinimumObligation(
  account: Account,
  dueDate: string,
  amount: number,
): Account {
  if (account.type !== "credit") return account;
  if (!isValidDateString(dueDate)) return account;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
    return account;
  }
  const rounded = Math.round(amount);
  const existing = account.minimumObligations || {};
  return {
    ...account,
    minimumObligations: {
      ...existing,
      [dueDate]: rounded,
    },
    updatedAt: today(),
  };
}

export function getCreditCardMinimumObligation(
  account: Account,
  dueDate: string,
): number | null {
  if (account.type !== "credit") return null;
  if (!isValidDateString(dueDate)) return null;
  const val = account.minimumObligations?.[dueDate];
  if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
    return Math.round(val);
  }
  return null;
}

export function confirmCreditCardMinimum(
  account: Account,
  dueDate: string,
): Account {
  if (account.type !== "credit") return account;
  if (!isValidDateString(dueDate)) return account;
  if (
    typeof account.dueDay !== "number" ||
    !Number.isInteger(account.dueDay) ||
    account.dueDay < 1 ||
    account.dueDay > 31
  ) {
    return account;
  }
  const [y, m] = dueDate.split("-").map(Number);
  if (!y || !m) return account;
  const expectedDue = getCreditCardDueDate(account, y, m);
  if (!expectedDue || expectedDue !== dueDate) {
    return account;
  }

  const existing = Array.isArray(account.confirmedMinimumDueDates)
    ? account.confirmedMinimumDueDates
    : [];
  if (existing.includes(dueDate)) return account;
  return {
    ...account,
    confirmedMinimumDueDates: [...existing, dueDate],
    updatedAt: today(),
  };
}

export function unconfirmCreditCardMinimum(
  account: Account,
  dueDate: string,
): Account {
  if (account.type !== "credit") return account;
  if (!isValidDateString(dueDate)) return account;
  const existing = Array.isArray(account.confirmedMinimumDueDates)
    ? account.confirmedMinimumDueDates
    : [];
  if (!existing.includes(dueDate)) return account;
  return {
    ...account,
    confirmedMinimumDueDates: existing.filter((d) => d !== dueDate),
    updatedAt: today(),
  };
}

export function getMonthlyExpenses(s: State, month: string): number {
  if (!s || !Array.isArray(s.transactions)) return 0;
  return s.transactions
    .filter(
      (t) =>
        t.status !== "scheduled" &&
        (!t.status || isLedgerStatus(t.status)) &&
        !t.isLegacyDebt &&
        (t.kind === "standard" || !t.kind) &&
        t.amount < 0 &&
        t.date.startsWith(month),
    )
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

export function getMonthlyIncome(s: State, month: string): number {
  if (!s || !Array.isArray(s.transactions)) return 0;
  return s.transactions
    .filter(
      (t) =>
        t.status !== "scheduled" &&
        (!t.status || isLedgerStatus(t.status)) &&
        !t.isLegacyDebt &&
        (t.kind === "standard" || !t.kind) &&
        t.amount > 0 &&
        t.date.startsWith(month),
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

export type CreditCardMinimumStatus =
  | "covered"
  | "partially_covered"
  | "uncovered"
  | "not_applicable"
  | "overdue";

export type CreditCardObligationType = "recorded" | "estimated" | "none";

export interface CreditCardMinimumProtection {
  account: Account;
  totalOwed: number; // Current liability (integer cents)
  configuredMin: number; // Configured minimum payment (integer cents)
  configuredMinimum: number; // Alias
  effectiveMin: number; // Math.min(configuredMin, totalOwed)
  effectiveMinimum: number; // Alias
  dueDate: string | null; // Applicable due date (YYYY-MM-DD)
  dueCycle: "current" | "following" | "none";
  isDueInCurrentWindow: boolean;
  isDueInFollowingWindow: boolean;
  isOverdue: boolean;
  isConfirmedPaid: boolean;
  paidTowardCycle: number; // Payments already made toward this cycle
  remainingMinimumRequirement: number;
  readyToPay: number; // Cash already held in Ready to Pay
  additionalProtection: number; // Additional cash to reserve in Safe to Spend in current cycle
  additionalProtectionRequired: number; // Alias
  followingAdditionalProtection: number; // Additional cash needed if evaluated in following cycle
  status: CreditCardMinimumStatus;
  isEstimated: boolean; // True when obligation amount is inferred rather than from a recorded statement snapshot
  obligationType: CreditCardObligationType; // "recorded" | "estimated" | "none"
}

export interface CreditCardMinimumBreakdown {
  currentCycleMinimums: number; // Additional protection for minimums due in current window (or overdue)
  followingCycleMinimums: number; // Potential additional protection for minimums due in following window
  protectedFollowingMinimums: number; // Portions of followingCycleMinimums where account.protected === true
  totalAdditionalProtection: number; // currentCycleMinimums + protectedFollowingMinimums
  totalConfiguredMinimums: number;
  totalEffectiveMinimums: number;
  details: CreditCardMinimumProtection[];
  cards: CreditCardMinimumProtection[]; // Alias for details
}

export function getCreditCardDueDate(
  account: Account,
  year: number,
  month: number,
): string | null {
  if (
    typeof account.dueDay !== "number" ||
    !Number.isInteger(account.dueDay) ||
    account.dueDay < 1 ||
    account.dueDay > 31 ||
    year < 1900 ||
    year > 2200 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clampedDay = Math.min(account.dueDay, daysInMonth);
  return `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export function getPastCreditCardDueDate(
  account: Account,
  asOf = today(),
): string | null {
  if (
    account.type !== "credit" ||
    typeof account.dueDay !== "number" ||
    !Number.isInteger(account.dueDay) ||
    account.dueDay < 1 ||
    account.dueDay > 31 ||
    !isValidDateString(asOf)
  ) {
    return null;
  }
  const [nowY, nowM] = asOf.split("-").map(Number);
  if (!nowY || !nowM) return null;
  const currentMonthDue = getCreditCardDueDate(account, nowY, nowM);
  if (!currentMonthDue) return null;

  if (asOf > currentMonthDue) {
    return currentMonthDue;
  }
  const [prevY, prevM] = nowM === 1 ? [nowY - 1, 12] : [nowY, nowM - 1];
  return getCreditCardDueDate(account, prevY, prevM);
}

export function updateCreditCardMinimumSettings(
  account: Account,
  newMinPayment: number | undefined,
  now = today(),
): Account {
  if (account.type !== "credit") return account;
  const sanitizedNewMin =
    typeof newMinPayment === "number" && Number.isFinite(newMinPayment) && newMinPayment > 0
      ? Math.round(newMinPayment)
      : undefined;

  // Never create a confirmed historical statement obligation solely from a later settings edit.
  // Preserve existing explicitly established occurrence-level obligations.
  return {
    ...account,
    minPayment: sanitizedNewMin,
    updatedAt: now,
  };
}

export function getCreditCardMinimumProtection(
  account: Account,
  s: State,
  now = today(),
): CreditCardMinimumProtection {
  const baseResult: CreditCardMinimumProtection = {
    account,
    totalOwed: 0,
    configuredMin: 0,
    configuredMinimum: 0,
    effectiveMin: 0,
    effectiveMinimum: 0,
    dueDate: null,
    dueCycle: "none",
    isDueInCurrentWindow: false,
    isDueInFollowingWindow: false,
    isOverdue: false,
    isConfirmedPaid: false,
    paidTowardCycle: 0,
    remainingMinimumRequirement: 0,
    readyToPay: 0,
    additionalProtection: 0,
    additionalProtectionRequired: 0,
    followingAdditionalProtection: 0,
    status: "not_applicable",
    isEstimated: false,
    obligationType: "none",
  };

  if (account.type !== "credit" || account.archived) {
    return baseResult;
  }

  const validNow = isValidDateString(now) ? now : today();
  const coverage = getCreditCardCoverage(account, s, validNow);
  const totalOwed = coverage.totalOwed;
  baseResult.totalOwed = totalOwed;
  baseResult.readyToPay = coverage.readyToPay;

  const rawMin = account.minPayment;
  const configuredMin =
    typeof rawMin === "number" && Number.isFinite(rawMin) && rawMin > 0
      ? Math.round(rawMin)
      : 0;
  baseResult.configuredMin = configuredMin;
  baseResult.configuredMinimum = configuredMin;

  if (totalOwed <= 0) {
    baseResult.status = "not_applicable";
    return baseResult;
  }

  if (configuredMin <= 0) {
    baseResult.status = "not_applicable";
    return baseResult;
  }

  if (
    typeof account.dueDay !== "number" ||
    !Number.isInteger(account.dueDay) ||
    account.dueDay < 1 ||
    account.dueDay > 31
  ) {
    baseResult.status = "not_applicable";
    return baseResult;
  }

  const effectiveMin = Math.min(configuredMin, totalOwed);
  baseResult.effectiveMin = effectiveMin;
  baseResult.effectiveMinimum = effectiveMin;

  const [nowY, nowM] = validNow.split("-").map(Number);
  const currentMonthDue = getCreditCardDueDate(account, nowY!, nowM!);
  if (!currentMonthDue) {
    baseResult.status = "not_applicable";
    return baseResult;
  }

  const [prevY, prevM] = nowM === 1 ? [nowY! - 1, 12] : [nowY!, nowM! - 1];
  const prevMonthDue =
    getCreditCardDueDate(account, prevY, prevM) ||
    `${prevY}-${String(prevM).padStart(2, "0")}-01`;

  const [nextY, nextM] = nowM === 12 ? [nowY! + 1, 1] : [nowY!, nowM! + 1];
  const nextMonthDue =
    getCreditCardDueDate(account, nextY, nextM) ||
    `${nextY}-${String(nextM).padStart(2, "0")}-01`;

  // Find all qualifying ledger payments to this card
  const payments = (s.transactions || []).filter(
    (t) =>
      isLedgerStatus(t.status) &&
      t.kind === "payment" &&
      t.targetAccountId === account.id &&
      t.amount < 0,
  );

  // Payday horizon windows
  const currentPayday = getCurrentPayday(s, validNow);
  const currentPaydayEnd =
    isValidDateString(currentPayday) && currentPayday >= validNow
      ? currentPayday
      : validNow;
  const rawFollowingEnd = getFollowingPayday(s, validNow);
  const followingEnd = isValidDateString(rawFollowingEnd)
    ? rawFollowingEnd
    : addDays(validNow, 14);

  let targetDueDate: string;
  let isOverdue = false;
  let isConfirmedPaid = false;
  let paidTowardCycle = 0;
  let remainingMinRequirement = 0;

  if (validNow <= currentMonthDue) {
    // Current month due date has NOT passed yet.
    // Check if the previous cycle (prevMonthDue) had an established snapshot obligation or active lifetime obligation.
    const prevSnapshot = getCreditCardMinimumObligation(account, prevMonthDue);
    const confirmedPrev = Boolean(
      account.confirmedMinimumDueDates?.includes(prevMonthDue),
    );

    const createdDate = account.createdAt ? account.createdAt.slice(0, 10) : "";
    const isKnownAccountCycle =
      isValidDateString(createdDate) && prevMonthDue >= createdDate;
    const shouldEvaluatePrev =
      prevSnapshot !== null ||
      (isKnownAccountCycle && configuredMin > 0 && account.dueDay !== undefined);
    const prevObligation = prevSnapshot !== null ? prevSnapshot : configuredMin;

    let isPrevUnfulfilled = false;
    let onTimePaidPrev = 0;
    let latePaidPrev = 0;
    let totalPaidPrev = 0;

    if (shouldEvaluatePrev && !confirmedPrev) {
      const [prevPrevY, prevPrevM] =
        prevM === 1 ? [prevY - 1, 12] : [prevY, prevM - 1];
      const prevPrevMonthDue =
        getCreditCardDueDate(account, prevPrevY, prevPrevM) ||
        `${prevPrevY}-${String(prevPrevM).padStart(2, "0")}-01`;

      const onTimePaymentsPrev = payments.filter(
        (t) => t.date > prevPrevMonthDue && t.date <= prevMonthDue,
      );
      onTimePaidPrev = onTimePaymentsPrev.reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0,
      );
      const latePaymentsPrev = payments.filter(
        (t) => t.date > prevMonthDue && t.date <= validNow,
      );
      latePaidPrev = latePaymentsPrev.reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0,
      );
      totalPaidPrev = onTimePaidPrev + latePaidPrev;

      if (totalPaidPrev < prevObligation) {
        isPrevUnfulfilled = true;
      }
    }

    if (isPrevUnfulfilled) {
      // Previous cycle obligation remains unfulfilled and is OVERDUE!
      targetDueDate = prevMonthDue;
      isOverdue = true;
      isConfirmedPaid = false;
      paidTowardCycle = totalPaidPrev;
      const rawRemaining = Math.max(0, prevObligation - paidTowardCycle);
      remainingMinRequirement = Math.min(rawRemaining, totalOwed);
      baseResult.configuredMin = prevObligation;
      baseResult.configuredMinimum = prevObligation;
      baseResult.effectiveMin = Math.min(prevObligation, totalOwed);
      baseResult.effectiveMinimum = baseResult.effectiveMin;
    } else {
      // Previous cycle is satisfied or has no snapshot. Active target is currentMonthDue.
      targetDueDate = currentMonthDue;
      isOverdue = false;
      const confirmedCurrent = Boolean(
        account.confirmedMinimumDueDates?.includes(currentMonthDue),
      );

      const onTimePayments = payments.filter(
        (t) => t.date > prevMonthDue && t.date <= currentMonthDue,
      );
      const onTimePaid = onTimePayments.reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0,
      );

      // Portions of payments after prevMonthDue absorbed by previous cycle obligation
      const unfulfilledPrev =
        shouldEvaluatePrev && !confirmedPrev
          ? Math.max(0, prevObligation - onTimePaidPrev)
          : 0;
      const absorbedByPrev = Math.min(onTimePaid, unfulfilledPrev);
      const effectivePaidCurrent = Math.max(0, onTimePaid - absorbedByPrev);

      if (confirmedCurrent) {
        isConfirmedPaid = true;
        paidTowardCycle = Math.max(effectivePaidCurrent, effectiveMin);
        remainingMinRequirement = 0;
      } else {
        isConfirmedPaid = false;
        paidTowardCycle = effectivePaidCurrent;
        remainingMinRequirement = Math.max(0, effectiveMin - paidTowardCycle);
      }
    }
  } else {
    // Current month due date has PASSED (validNow > currentMonthDue)
    const currentSnapshot = getCreditCardMinimumObligation(
      account,
      currentMonthDue,
    );
    const createdDate = account.createdAt ? account.createdAt.slice(0, 10) : "";
    const isKnownAccountCycle =
      currentSnapshot !== null ||
      (!createdDate || (isValidDateString(createdDate) && currentMonthDue >= createdDate));

    if (!isKnownAccountCycle) {
      // The card was configured AFTER currentMonthDue with no recorded obligation.
      // Do not fabricate an overdue statement for a past cycle before account creation.
      targetDueDate = nextMonthDue;
      isOverdue = false;
      const confirmedNext = Boolean(
        account.confirmedMinimumDueDates?.includes(nextMonthDue),
      );
      if (confirmedNext) {
        isConfirmedPaid = true;
        paidTowardCycle = effectiveMin;
        remainingMinRequirement = 0;
      } else {
        isConfirmedPaid = false;
        paidTowardCycle = 0;
        remainingMinRequirement = effectiveMin;
      }
    } else {
      const confirmedCurrent = Boolean(
        account.confirmedMinimumDueDates?.includes(currentMonthDue),
      );
      const pastObligation =
        currentSnapshot !== null ? currentSnapshot : configuredMin;

      const onTimePayments = payments.filter(
        (t) => t.date > prevMonthDue && t.date <= currentMonthDue,
      );
      const onTimePaid = onTimePayments.reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0,
      );

      const latePayments = payments.filter(
        (t) => t.date > currentMonthDue && t.date <= validNow,
      );
      const latePaid = latePayments.reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0,
      );

      const totalPaidCurrentCycle = onTimePaid + latePaid;

      if (confirmedCurrent || totalPaidCurrentCycle >= pastObligation) {
        // Current month was satisfied on time or late! Target advances to next month
        targetDueDate = nextMonthDue;
        isOverdue = false;

        const confirmedNext = Boolean(
          account.confirmedMinimumDueDates?.includes(nextMonthDue),
        );
        if (confirmedNext) {
          isConfirmedPaid = true;
          paidTowardCycle = effectiveMin;
          remainingMinRequirement = 0;
        } else {
          isConfirmedPaid = false;
          // Absorption & excess attribution:
          // What portion of late payments was absorbed by the past minimum?
          const unfulfilledPastMin = confirmedCurrent
            ? 0
            : Math.max(0, pastObligation - onTimePaid);
          const excessLatePaid = Math.max(0, latePaid - unfulfilledPastMin);
          paidTowardCycle = excessLatePaid;
          remainingMinRequirement = Math.max(0, effectiveMin - paidTowardCycle);
        }
      } else {
        // Current month minimum is OVERDUE!
        targetDueDate = currentMonthDue;
        isOverdue = true;
        isConfirmedPaid = false;
        paidTowardCycle = totalPaidCurrentCycle;
        const rawRemaining = Math.max(0, pastObligation - paidTowardCycle);
        remainingMinRequirement = Math.min(rawRemaining, totalOwed);
        baseResult.configuredMin = pastObligation;
        baseResult.configuredMinimum = pastObligation;
        baseResult.effectiveMin = Math.min(pastObligation, totalOwed);
        baseResult.effectiveMinimum = baseResult.effectiveMin;
      }
    }
  }

  baseResult.dueDate = targetDueDate;
  baseResult.isOverdue = isOverdue;
  baseResult.isConfirmedPaid = isConfirmedPaid;
  baseResult.paidTowardCycle = paidTowardCycle;
  baseResult.remainingMinimumRequirement = remainingMinRequirement;

  // Determine whether this obligation is an explicitly recorded snapshot or an inferred estimate
  if (targetDueDate) {
    const targetSnapshot = getCreditCardMinimumObligation(account, targetDueDate);
    if (targetSnapshot !== null) {
      baseResult.isEstimated = false;
      baseResult.obligationType = "recorded";
    } else {
      baseResult.isEstimated = true;
      baseResult.obligationType = "estimated";
    }
  } else {
    baseResult.isEstimated = false;
    baseResult.obligationType = "none";
  }

  // Window attribution
  if (isOverdue || targetDueDate <= currentPaydayEnd) {
    baseResult.dueCycle = "current";
    baseResult.isDueInCurrentWindow = true;
    baseResult.isDueInFollowingWindow = false;

    const additionalProtection = Math.max(
      0,
      remainingMinRequirement - coverage.readyToPay,
    );
    baseResult.additionalProtection = additionalProtection;
    baseResult.additionalProtectionRequired = additionalProtection;
    baseResult.followingAdditionalProtection = 0;

    if (isOverdue) {
      baseResult.status = "overdue";
    } else if (remainingMinRequirement === 0 || additionalProtection === 0) {
      baseResult.status = "covered";
    } else if (paidTowardCycle + coverage.readyToPay > 0) {
      baseResult.status = "partially_covered";
    } else {
      baseResult.status = "uncovered";
    }
  } else if (targetDueDate <= followingEnd) {
    baseResult.dueCycle = "following";
    baseResult.isDueInCurrentWindow = false;
    baseResult.isDueInFollowingWindow = true;

    const followingProtection = Math.max(
      0,
      remainingMinRequirement - coverage.readyToPay,
    );
    baseResult.followingAdditionalProtection = followingProtection;

    // Follows Phase 3A bill protection policy:
    // If account.protected is true, protect into following cycle; else reserve 0 for current paycheck
    if (account.protected) {
      baseResult.additionalProtection = followingProtection;
      baseResult.additionalProtectionRequired = followingProtection;
    } else {
      baseResult.additionalProtection = 0;
      baseResult.additionalProtectionRequired = 0;
    }

    if (remainingMinRequirement === 0 || followingProtection === 0) {
      baseResult.status = "covered";
    } else if (paidTowardCycle + coverage.readyToPay > 0) {
      baseResult.status = "partially_covered";
    } else {
      baseResult.status = "uncovered";
    }
  } else {
    // Beyond following payday horizon
    baseResult.dueCycle = "none";
    baseResult.isDueInCurrentWindow = false;
    baseResult.isDueInFollowingWindow = false;
    baseResult.additionalProtection = 0;
    baseResult.additionalProtectionRequired = 0;
    baseResult.followingAdditionalProtection = 0;

    if (remainingMinRequirement <= coverage.readyToPay) {
      baseResult.status = "covered";
    } else if (paidTowardCycle + coverage.readyToPay > 0) {
      baseResult.status = "partially_covered";
    } else {
      baseResult.status = "uncovered";
    }
  }

  return baseResult;
}

export function getCreditCardMinimumBreakdown(
  s: State,
  now = today(),
): CreditCardMinimumBreakdown {
  const activeCards = (s.accounts || []).filter(
    (a) => a.type === "credit" && !a.archived,
  );
  const details = activeCards.map((a) =>
    getCreditCardMinimumProtection(a, s, now),
  );

  let currentCycleMinimums = 0;
  let followingCycleMinimums = 0;
  let protectedFollowingMinimums = 0;

  for (const d of details) {
    if (d.dueCycle === "current") {
      currentCycleMinimums += d.additionalProtection;
    } else if (d.dueCycle === "following") {
      followingCycleMinimums += d.followingAdditionalProtection;
      if (d.account.protected) {
        protectedFollowingMinimums += d.additionalProtection;
      }
    }
  }

  const totalAdditionalProtection =
    currentCycleMinimums + protectedFollowingMinimums;

  const totalConfiguredMinimums = details.reduce(
    (sum, d) => sum + d.configuredMinimum,
    0,
  );
  const totalEffectiveMinimums = details.reduce(
    (sum, d) => sum + d.effectiveMinimum,
    0,
  );

  return {
    currentCycleMinimums,
    followingCycleMinimums,
    protectedFollowingMinimums,
    totalAdditionalProtection,
    totalConfiguredMinimums,
    totalEffectiveMinimums,
    details,
    cards: details,
  };
}

export function blank(): State {
  const payday = nextPayday();
  const d = today();
  const followingPayday = addDays(payday, 14);
  return {
    version: 5,
    demo: false,
    opening: 0,
    payday,
    followingPayday,
    paydaySchedule: {
      frequency: "manual",
      anchorDate: payday,
      manualFollowingPayday: followingPayday,
      weekendRule: "exact",
      overrides: [],
    },
    transactions: [],
    budgets: [],
    pots: [],
    bills: [],
    settledBills: [],
    accounts: [
      {
        id: "acc-default-checking",
        name: "Primary Checking",
        type: "checking",
        opening: 0,
        includeInSafeToSpend: true,
        archived: false,
        createdAt: d,
        updatedAt: d,
      },
    ],
  };
}

export function demo(): State {
  const d = today();
  const payday = nextPayday();
  const followingPayday = addDays(payday, 14);
  return {
    version: 5,
    demo: true,
    opening: 285675,
    payday,
    followingPayday,
    paydaySchedule: {
      frequency: "biweekly",
      anchorDate: payday,
      weekendRule: "exact",
      overrides: [],
    },
    transactions: [
      {
        id: "t1",
        name: "Paycheck",
        amount: 240000,
        category: "Income",
        date: d,
        status: "posted",
        accountId: "acc-default-checking",
        kind: "standard",
      },
      {
        id: "t2",
        name: "Weekly groceries",
        amount: -8635,
        category: "Groceries",
        date: d,
        status: "posted",
        accountId: "acc-default-checking",
        kind: "standard",
      },
      {
        id: "t3",
        name: "Savory Bites Bistro",
        amount: -5550,
        category: "Dining Out",
        date: d,
        status: "posted",
        accountId: "acc-default-checking",
        kind: "standard",
      },
      {
        id: "t4",
        name: "Internet",
        amount: -10000,
        category: "Bills",
        date: d,
        billId: "b2",
        status: "posted",
        accountId: "acc-default-checking",
        kind: "standard",
      },
      {
        id: "t5",
        name: "Game night",
        amount: -1500,
        category: "Entertainment",
        date: d,
        status: "posted",
        accountId: "acc-default-checking",
        kind: "standard",
      },
      {
        id: "t6",
        name: "Coffee stop",
        amount: -690,
        category: "Dining Out",
        date: d,
        status: "posted",
        accountId: "acc-default-checking",
        kind: "standard",
      },
    ],
    budgets: [
      {
        id: "u1",
        name: "Groceries",
        category: "Groceries",
        limit: 40000,
        color: colors[0]!,
      },
      {
        id: "u2",
        name: "Dining Out",
        category: "Dining Out",
        limit: 15000,
        color: colors[1]!,
      },
      {
        id: "u3",
        name: "Entertainment",
        category: "Entertainment",
        limit: 10000,
        color: colors[2]!,
      },
    ],
    pots: [
      {
        id: "p1",
        name: "Rainy day",
        saved: 50000,
        target: 200000,
        color: colors[0]!,
      },
      {
        id: "p2",
        name: "Next adventure",
        saved: 25000,
        target: 150000,
        color: colors[2]!,
      },
      {
        id: "p3",
        name: "Gifts",
        saved: 10000,
        target: 30000,
        color: colors[1]!,
      },
    ],
    bills: [
      { id: "b1", name: "Rent", amount: 130000, day: 1, protected: true, settledDueDates: [] },
      { id: "b2", name: "Internet", amount: 10000, day: new Date().getDate(), protected: false, settledDueDates: [] },
      { id: "b3", name: "Phone", amount: 5500, day: 12, protected: false, settledDueDates: [] },
    ],
    settledBills: [],
    accounts: [
      {
        id: "acc-default-checking",
        name: "Primary Checking",
        type: "checking",
        opening: 285675,
        includeInSafeToSpend: true,
        archived: false,
        createdAt: d,
        updatedAt: d,
      },
      {
        id: "acc-demo-savings",
        name: "Emergency Savings",
        type: "savings",
        opening: 450000,
        balance: 450000,
        includeInSafeToSpend: false,
        archived: false,
        createdAt: d,
        updatedAt: d,
      },
      {
        id: "acc-demo-credit",
        name: "Mika Rewards Visa",
        type: "credit",
        opening: 35000,
        balance: 35000,
        creditLimit: 200000,
        dueDay: 22,
        minPayment: 3500,
        includeInSafeToSpend: false,
        archived: false,
        createdAt: d,
        updatedAt: d,
        assignedPaymentReserve: 0,
        paymentReservations: [],
        coveredCreditBaselineAt: d,
      },
    ],
  };
}

export const spent = (
  s: State,
  category: string,
  month = today().slice(0, 7),
): number => {
  const transactions = (s.transactions || []).filter(
    (t) =>
      isLedgerStatus(t.status) &&
      t.category.toLowerCase() === category.toLowerCase() &&
      t.date.startsWith(month) &&
      (t.kind === "standard" || !t.kind) &&
      !t.isLegacyDebt,
  );

  let cashPurchases = 0;
  let cashRefunds = 0;
  let creditPurchases = 0;
  let creditRefunds = 0;

  for (const t of transactions) {
    const acc = (s.accounts || []).find(
      (a) => a.id === (t.accountId || "acc-default-checking"),
    );
    const isCredit = acc ? acc.type === "credit" : false;
    const absAmt = Math.abs(t.amount);

    if (t.amount < 0) {
      if (isCredit) {
        creditPurchases += absAmt;
      } else {
        cashPurchases += absAmt;
      }
    } else if (t.amount > 0) {
      if (isCredit) {
        creditRefunds += absAmt;
      } else {
        cashRefunds += absAmt;
      }
    }
  }

  // Account isolation: cash refunds offset cash purchases; credit refunds offset credit purchases.
  // Credit card statement credits cannot offset cash purchases or create cash spending availability.
  const netCash = Math.max(0, cashPurchases - cashRefunds);
  const netCredit = Math.max(0, creditPurchases - creditRefunds);

  return netCash + netCredit;
};

export function dueDate(b: Bill, month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(Math.min(b.day, new Date(y!, m!, 0).getDate())).padStart(2, "0")}`;
}

export function getBillDueDate(b: Bill, year: number, month: number): string {
  const daysInMonth = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(Math.max(1, b.day || 1), daysInMonth);
  return `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export function nextDueDate(b: Bill, fromDate = today()): string {
  const [y, m] = fromDate.split("-").map(Number);
  const currentMonthDue = getBillDueDate(b, y!, m!);

  if (currentMonthDue >= fromDate) {
    return currentMonthDue;
  }

  const nextY = m === 12 ? y! + 1 : y!;
  const nextM = m === 12 ? 1 : m! + 1;
  return getBillDueDate(b, nextY, nextM);
}

export function isBillSettled(
  s: State,
  b: Bill,
  occurrenceDate: string,
): boolean {
  if (Array.isArray(b.settledDueDates) && b.settledDueDates.includes(occurrenceDate)) {
    return true;
  }
  if (
    Array.isArray(s.settledBills) &&
    s.settledBills.some((sb) => sb.billId === b.id && sb.dueDate === occurrenceDate)
  ) {
    return true;
  }
  return false;
}

function hasEarlierUnpaidOccurrence(
  s: State,
  b: Bill,
  occurrenceDate: string,
): boolean {
  let trackingStart = b.trackingStartDate;
  if (!isValidDateString(trackingStart)) {
    trackingStart = `${occurrenceDate.slice(0, 7)}-01`;
  }
  if (occurrenceDate <= trackingStart) {
    return false;
  }

  const [startYear, startMonth] = trackingStart.split("-").map(Number);
  const [occYear, occMonth] = occurrenceDate.split("-").map(Number);

  if (!startYear || !startMonth || !occYear || !occMonth) {
    return false;
  }

  let y = startYear;
  let m = startMonth;

  while (y < occYear || (y === occYear && m < occMonth)) {
    const due = getBillDueDate(b, y, m);
    if (due >= trackingStart && due < occurrenceDate) {
      if (!isBillPaid(s, b, due)) {
        return true;
      }
    }
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return false;
}

export type BillPaymentStatus =
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "overpaid";

export interface BillOccurrenceStatus {
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  overpaidAmount: number;
  status: BillPaymentStatus;
  isSettled: boolean;
  transactions: Transaction[];
}

export function getBillOccurrenceStatus(
  s: State,
  b: Bill,
  occurrenceDate = nextDueDate(b, today()),
): BillOccurrenceStatus {
  const expectedAmount = b.amount;
  const isSettled = isBillSettled(s, b, occurrenceDate);

  // 1. Explicit occurrence linkage transactions (must be ledger status and expense payments)
  const explicitMatches = s.transactions.filter(
    (t) =>
      isLedgerStatus(t.status) &&
      t.billId === b.id &&
      t.amount < 0 &&
      t.billDueDate === occurrenceDate,
  );

  const qualifyingTransactions: Transaction[] = [...explicitMatches];

  // 2. Candidate legacy/unlinked transactions in the occurrence month (must be expense payments)
  // A legacy unlinked transaction matching this bill and month should attribute to this occurrence
  // even if an explicit payment is also present, provided it is unambiguous (single unlinked transaction in this month,
  // and no earlier unpaid occurrences).
  const occurrenceMonth = occurrenceDate.slice(0, 7);
  const unlinkedCandidates = s.transactions.filter(
    (t) =>
      isLedgerStatus(t.status) &&
      t.billId === b.id &&
      t.amount < 0 &&
      !t.billDueDate &&
      t.date.slice(0, 7) === occurrenceMonth,
  );

  if (unlinkedCandidates.length === 1) {
    if (!hasEarlierUnpaidOccurrence(s, b, occurrenceDate)) {
      qualifyingTransactions.push(unlinkedCandidates[0]!);
    }
  }

  const paidAmount = qualifyingTransactions.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0,
  );

  let remainingAmount = Math.max(0, expectedAmount - paidAmount);
  const overpaidAmount = Math.max(0, paidAmount - expectedAmount);

  if (isSettled) {
    remainingAmount = 0;
  }

  let status: BillPaymentStatus;
  if (remainingAmount === 0) {
    if (paidAmount > expectedAmount) {
      status = "overpaid";
    } else {
      status = "paid";
    }
  } else {
    if (paidAmount > 0) {
      status = "partially_paid";
    } else {
      status = "unpaid";
    }
  }

  return {
    expectedAmount,
    paidAmount,
    remainingAmount,
    overpaidAmount,
    status,
    isSettled,
    transactions: qualifyingTransactions,
  };
}

export function isBillPaid(
  s: State,
  b: Bill,
  occurrenceDate = nextDueDate(b, today()),
): boolean {
  return getBillOccurrenceStatus(s, b, occurrenceDate).remainingAmount === 0;
}

export function recordBillPayment(
  s: State,
  billId: string,
  options?: {
    dueDate?: string;
    accountId?: string;
    date?: string;
    amount?: number;
    name?: string;
    status?: TransactionStatus;
  },
): Transaction | null {
  const bill = s.bills.find((b) => b.id === billId);
  if (!bill) return null;

  // Validate date if explicitly provided
  if (options?.date !== undefined) {
    if (typeof options.date !== "string" || !isValidDateString(options.date)) {
      return null;
    }
  }
  const payDate = options?.date || today();

  // Validate dueDate if explicitly provided
  if (options?.dueDate !== undefined) {
    if (
      typeof options.dueDate !== "string" ||
      !isValidDateString(options.dueDate)
    ) {
      return null;
    }
  }
  let explicitDueDate = options?.dueDate;

  if (!explicitDueDate) {
    explicitDueDate = nextUnpaidDueDate(s, bill, payDate);
  }

  if (!isValidDateString(explicitDueDate)) {
    const [pY, pM] = payDate.split("-").map(Number);
    explicitDueDate = getBillDueDate(bill, pY || 2026, pM || 1);
  }

  if (!isValidDateString(explicitDueDate)) {
    return null;
  }

  // Validate supported status if provided
  const supportedStatuses: TransactionStatus[] = [
    "scheduled",
    "pending",
    "cleared",
    "posted",
  ];
  if (
    options?.status !== undefined &&
    !supportedStatuses.includes(options.status)
  ) {
    return null;
  }
  const txStatus: TransactionStatus = options?.status || "posted";

  // Validate amount
  let paymentAmount: number;
  if (options?.amount !== undefined) {
    if (
      typeof options.amount !== "number" ||
      !Number.isFinite(options.amount) ||
      Number.isNaN(options.amount) ||
      options.amount <= 0 ||
      !Number.isInteger(options.amount)
    ) {
      return null;
    }
    paymentAmount = options.amount;
  } else {
    const occStatus = getBillOccurrenceStatus(s, bill, explicitDueDate);
    paymentAmount =
      occStatus.remainingAmount > 0 ? occStatus.remainingAmount : bill.amount;
    if (
      typeof paymentAmount !== "number" ||
      !Number.isFinite(paymentAmount) ||
      Number.isNaN(paymentAmount) ||
      paymentAmount <= 0 ||
      !Number.isInteger(paymentAmount)
    ) {
      return null;
    }
  }

  const defaultChecking =
    s.accounts?.find((a) => a.type === "checking" && !a.archived)?.id ||
    "acc-default-checking";

  const targetAccountId = options?.accountId || defaultChecking;
  if (options?.accountId && s.accounts && s.accounts.length > 0) {
    const acct = s.accounts.find((a) => a.id === options.accountId);
    if (!acct) {
      return null;
    }
  }

  const tx: Transaction = {
    id: uid(),
    name: options?.name || bill.name,
    amount: -paymentAmount,
    category: "Bills",
    date: payDate,
    billId: bill.id,
    billDueDate: explicitDueDate,
    status: txStatus,
    postedDate: txStatus !== "scheduled" ? payDate : undefined,
    accountId: targetAccountId,
    kind: "standard",
    createdAt: new Date().toISOString(),
  };

  s.transactions.unshift(tx);
  return tx;
}

export function settleBillOccurrence(
  s: State,
  billId: string,
  occurrenceDate: string,
): boolean {
  const bill = s.bills.find((b) => b.id === billId);
  if (!bill) return false;

  // Prevent duplicate payment or settlement
  if (isBillPaid(s, bill, occurrenceDate)) {
    return false;
  }

  if (!Array.isArray(bill.settledDueDates)) {
    bill.settledDueDates = [];
  }
  if (!bill.settledDueDates.includes(occurrenceDate)) {
    bill.settledDueDates.push(occurrenceDate);
  }

  if (!Array.isArray(s.settledBills)) {
    s.settledBills = [];
  }
  if (!s.settledBills.some((sb) => sb.billId === billId && sb.dueDate === occurrenceDate)) {
    s.settledBills.push({ billId, dueDate: occurrenceDate, settledAt: today() });
  }

  return true;
}

export function unsettleBillOccurrence(
  s: State,
  billId: string,
  occurrenceDate: string,
): boolean {
  const bill = s.bills.find((b) => b.id === billId);
  if (bill && Array.isArray(bill.settledDueDates)) {
    bill.settledDueDates = bill.settledDueDates.filter((d) => d !== occurrenceDate);
  }
  if (Array.isArray(s.settledBills)) {
    s.settledBills = s.settledBills.filter(
      (sb) => !(sb.billId === billId && sb.dueDate === occurrenceDate),
    );
  }
  return true;
}

export function nextUnpaidDueDate(
  s: State,
  b: Bill,
  fromDate = today(),
): string {
  const validFrom = isValidDateString(fromDate) ? fromDate : today();
  let trackingStart = b.trackingStartDate;
  if (!isValidDateString(trackingStart)) {
    trackingStart = `${validFrom.slice(0, 7)}-01`;
  }
  const evalStart = trackingStart < validFrom ? trackingStart : validFrom;
  let [startY, startM] = evalStart.split("-").map(Number);
  let [fromY, fromM] = validFrom.split("-").map(Number);

  if (!startY || !startM || startY < 1900 || startY > 2200) {
    startY = Number(validFrom.slice(0, 4)) || 2026;
    startM = Number(validFrom.slice(5, 7)) || 1;
  }
  if (!fromY || !fromM || fromY < 1900 || fromY > 2200) {
    fromY = startY;
    fromM = startM;
  }

  // Look from evalStart up to 3 years past validFrom
  const futureHorizonYear = fromY + 3;
  const totalMonths = (futureHorizonYear - startY) * 12 + (fromM - startM) + 1;
  const maxSteps = Math.min(Math.max(totalMonths, 36), 3600);

  let y = startY;
  let m = startM;

  for (let i = 0; i < maxSteps; i++) {
    const due = getBillDueDate(b, y, m);
    if (due >= trackingStart) {
      if (!isBillPaid(s, b, due)) {
        return due;
      }
    }
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return getBillDueDate(b, y, m);
}

export const paid = (s: State, b: Bill, month = today().slice(0, 7)): boolean => {
  const due = dueDate(b, month);
  return isBillPaid(s, b, due);
};

export const isBillUnpaidThisMonth = (
  s: State,
  b: Bill,
  now = today(),
): boolean => {
  const currentMonth = now.slice(0, 7);
  const thisMonthDue = dueDate(b, currentMonth);
  if (b.trackingStartDate && thisMonthDue < b.trackingStartDate) {
    return false;
  }
  // If the occurrence for this month is already paid or settled, it is not unpaid this month
  if (isBillPaid(s, b, thisMonthDue)) {
    return false;
  }
  // If the next unpaid occurrence is in a future month (e.g. next month / next cycle), it is not unpaid this month
  const nextUnpaid = nextUnpaidDueDate(s, b, now);
  if (nextUnpaid.slice(0, 7) > currentMonth) {
    return false;
  }
  return true;
};

export type BillReservationDetail = {
  bill: Bill;
  dueDate: string;
  amount: number;
  cycle: "current" | "following_protected";
};

export type BillReservationBreakdown = {
  currentCycleBills: number;
  protectedCycleBills: number;
  total: number;
  details: BillReservationDetail[];
  diagnostics: string[];
};

export function reserveBillsBreakdown(
  s: State,
  now = today(),
): BillReservationBreakdown {
  const diagnostics: string[] = [];
  const validNow = isValidDateString(now) ? now : today();
  if (validNow !== now) {
    diagnostics.push(`Invalid 'now' date '${now}'; fell back to '${validNow}'.`);
  }

  const currentPayday = getCurrentPayday(s, validNow);
  const currentPaydayEnd =
    isValidDateString(currentPayday) && currentPayday >= validNow
      ? currentPayday
      : validNow;
  const rawFollowingEnd = getFollowingPayday(s, validNow);
  const followingEnd = isValidDateString(rawFollowingEnd)
    ? rawFollowingEnd
    : addDays(validNow, 14);
  const maxEnd =
    followingEnd > currentPaydayEnd ? followingEnd : currentPaydayEnd;

  let currentCycleBills = 0;
  let protectedCycleBills = 0;
  const details: BillReservationDetail[] = [];

  for (const b of s.bills) {
    let trackingStart = b.trackingStartDate;
    if (!isValidDateString(trackingStart)) {
      diagnostics.push(
        `Bill '${b.name}' has missing or invalid trackingStartDate '${b.trackingStartDate}'; defaulted to current month baseline.`,
      );
      trackingStart = `${validNow.slice(0, 7)}-01`;
    }

    let [startYear, startMonth] = trackingStart.split("-").map(Number);
    let [endYear, endMonth] = maxEnd.split("-").map(Number);

    if (!startYear || !startMonth || startYear < 1900) {
      diagnostics.push(
        `Bill '${b.name}' startYear '${startYear}' is before 1900; clamped to 1900-01.`,
      );
      startYear = 1900;
      startMonth = 1;
      trackingStart = "1900-01-01";
    } else if (startYear > 2200) {
      diagnostics.push(
        `Bill '${b.name}' startYear '${startYear}' exceeds 2200; clamped to 2200-01.`,
      );
      startYear = 2200;
      startMonth = 1;
      trackingStart = "2200-01-01";
    }

    if (!endYear || !endMonth || endYear > 2200) {
      diagnostics.push(
        `Planning horizon endYear '${endYear}' exceeds 2200; clamped to 2200-12.`,
      );
      endYear = 2200;
      endMonth = 12;
    } else if (endYear < 1900) {
      diagnostics.push(
        `Planning horizon endYear '${endYear}' is before 1900; clamped to 1900-12.`,
      );
      endYear = 1900;
      endMonth = 12;
    }

    if (
      endYear < startYear ||
      (endYear === startYear && endMonth < startMonth)
    ) {
      // Future-dated tracking start outside current planning window
      continue;
    }

    const totalMonths =
      (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    if (totalMonths <= 0) {
      diagnostics.push(
        `Bill '${b.name}' calculated non-positive totalMonths (${totalMonths}); safely reserving current cycle amount.`,
      );
      const fallbackDue = getBillDueDate(
        b,
        Number(validNow.slice(0, 4)) || 2026,
        Number(validNow.slice(5, 7)) || 1,
      );
      const occStatus = getBillOccurrenceStatus(s, b, fallbackDue);
      const reserveAmt = occStatus.remainingAmount;
      if (reserveAmt > 0) {
        currentCycleBills += reserveAmt;
        details.push({
          bill: b,
          dueDate: fallbackDue,
          amount: reserveAmt,
          cycle: "current",
        });
      }
      continue;
    }

    const SAFETY_CAP_MONTHS = 3600;
    let maxSteps = totalMonths;
    if (totalMonths > SAFETY_CAP_MONTHS) {
      diagnostics.push(
        `Bill '${b.name}' totalMonths (${totalMonths}) exceeds safety cap of ${SAFETY_CAP_MONTHS} months; evaluating latest ${SAFETY_CAP_MONTHS} months up to planning horizon.`,
      );
      maxSteps = SAFETY_CAP_MONTHS;
      const shiftMonths = totalMonths - SAFETY_CAP_MONTHS;
      startMonth += shiftMonths;
      while (startMonth > 12) {
        startMonth -= 12;
        startYear++;
      }
    }

    let y = startYear;
    let m = startMonth;
    let evaluatedCount = 0;

    for (let step = 0; step < maxSteps; step++) {
      const due = getBillDueDate(b, y, m);

      if (due >= trackingStart && due <= maxEnd) {
        evaluatedCount++;
        const occStatus = getBillOccurrenceStatus(s, b, due);
        if (occStatus.remainingAmount > 0) {
          if (due <= currentPaydayEnd) {
            currentCycleBills += occStatus.remainingAmount;
            details.push({
              bill: b,
              dueDate: due,
              amount: occStatus.remainingAmount,
              cycle: "current",
            });
          } else if (due <= followingEnd && b.protected) {
            protectedCycleBills += occStatus.remainingAmount;
            details.push({
              bill: b,
              dueDate: due,
              amount: occStatus.remainingAmount,
              cycle: "following_protected",
            });
          }
        }
      }

      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    if (evaluatedCount === 0 && trackingStart <= maxEnd) {
      diagnostics.push(
        `Bill '${b.name}' yielded 0 evaluated occurrences within window; safely reserving current cycle amount.`,
      );
      const fallbackDue = getBillDueDate(
        b,
        Number(validNow.slice(0, 4)) || 2026,
        Number(validNow.slice(5, 7)) || 1,
      );
      const occStatus = getBillOccurrenceStatus(s, b, fallbackDue);
      const reserveAmt = occStatus.remainingAmount;
      if (reserveAmt > 0) {
        currentCycleBills += reserveAmt;
        details.push({
          bill: b,
          dueDate: fallbackDue,
          amount: reserveAmt,
          cycle: "current",
        });
      }
    }
  }

  return {
    currentCycleBills,
    protectedCycleBills,
    total: currentCycleBills + protectedCycleBills,
    details,
    diagnostics,
  };
}

export function reserveBills(s: State, now = today()): number {
  return reserveBillsBreakdown(s, now).total;
}

export type BillDisplayStatus =
  | "overdue"
  | "due_soon"
  | "partially_paid"
  | "upcoming"
  | "paid";

export type BillProtectionStatus =
  | "current_cycle"
  | "following_protected"
  | "unprotected";

export interface BillItemPresentation {
  bill: Bill;
  dueDate: string;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  overpaidAmount: number;
  reservedAmount: number;
  status: BillDisplayStatus;
  statusLabel: string;
  isOverdue: boolean;
  isDueSoon: boolean;
  isPartiallyPaid: boolean;
  isPaid: boolean;
  isSettled: boolean;
  protectionStatus: BillProtectionStatus;
  protectionLabel: string;
  sortRank: number;
}

/**
 * Checks if a bill occurrence is "due soon" from asOf date.
 * Default window is 3 days: inclusive of asOf through addDays(asOf, windowDays).
 * Returns false if dueDate is in the past (overdue) or beyond windowDays.
 */
export function isBillDueSoon(
  dueDate: string,
  asOf = today(),
  windowDays = 3,
): boolean {
  if (!isValidDateString(dueDate) || !isValidDateString(asOf)) {
    return false;
  }
  if (dueDate < asOf) {
    return false; // Past due dates are overdue, not due soon
  }
  const horizon = addDays(asOf, windowDays);
  return dueDate <= horizon;
}

/**
 * Resolves the tracking baseline for a bill:
 * Uses explicit trackingStartDate if valid.
 * If not set, checks for any prior linked transactions or settlements;
 * defaults to the first of the current calendar month.
 */
export function getBillTrackingBaseline(
  s: State,
  b: Bill,
  now = today(),
): string {
  const validNow = isValidDateString(now) ? now : today();
  if (isValidDateString(b.trackingStartDate)) {
    return b.trackingStartDate;
  }
  let earliest = `${validNow.slice(0, 7)}-01`;
  if (Array.isArray(s.transactions)) {
    for (const t of s.transactions) {
      if (t.billId === b.id) {
        if (
          t.billDueDate &&
          isValidDateString(t.billDueDate) &&
          t.billDueDate < earliest
        ) {
          earliest = t.billDueDate;
        } else if (t.date && isValidDateString(t.date) && t.date < earliest) {
          earliest = `${t.date.slice(0, 7)}-01`;
        }
      }
    }
  }
  if (Array.isArray(b.settledDueDates)) {
    for (const d of b.settledDueDates) {
      if (isValidDateString(d) && d < earliest) {
        earliest = d;
      }
    }
  }
  if (Array.isArray(s.settledBills)) {
    for (const sb of s.settledBills) {
      if (
        sb.billId === b.id &&
        isValidDateString(sb.dueDate) &&
        sb.dueDate < earliest
      ) {
        earliest = sb.dueDate;
      }
    }
  }
  return earliest;
}

/**
 * Resolves the actionable target occurrence date for a bill:
 * 1. Checks chronologically from the bill's tracking baseline for the earliest outstanding occurrence
 *    (remainingAmount > 0). If an overdue occurrence (dueDate < now) is outstanding, it is returned
 *    immediately so past-due obligations are never hidden.
 * 2. If all past occurrences are satisfied, evaluates the current calendar month occurrence.
 *    If the current month is outstanding, returns the current month occurrence.
 * 3. If all tracked occurrences through the current month are satisfied, returns the current month
 *    occurrence to represent the completed/paid state sensibly without prematurely jumping to next month.
 * 4. If the bill's tracking starts in a future month, returns the earliest upcoming occurrence.
 */
export function getBillTargetOccurrenceDate(
  s: State,
  b: Bill,
  now = today(),
): string {
  const validNow = isValidDateString(now) ? now : today();
  const baseline = getBillTrackingBaseline(s, b, validNow);

  const [nowY, nowM] = validNow.split("-").map(Number);
  const currentMonthDue = getBillDueDate(b, nowY!, nowM!);

  // If tracking begins in a future month beyond the current month, target the earliest upcoming occurrence
  if (currentMonthDue < baseline) {
    return nextUnpaidDueDate(s, b, validNow);
  }

  // Iterate month-by-month from baseline up to current month to find the earliest outstanding occurrence
  let [startY, startM] = baseline.split("-").map(Number);
  if (!startY || !startM || startY < 1900 || startY > 2200) {
    startY = nowY || 2026;
    startM = nowM || 1;
  }

  let y = startY;
  let m = startM;
  const maxSteps = Math.max(1, (nowY! - startY) * 12 + (nowM! - startM) + 1);

  for (let step = 0; step < maxSteps; step++) {
    const due = getBillDueDate(b, y, m);
    if (due >= baseline) {
      const occ = getBillOccurrenceStatus(s, b, due);
      if (occ.remainingAmount > 0) {
        // Earliest outstanding occurrence found!
        return due;
      }
    }

    if (y === nowY && m === nowM) {
      break;
    }
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  // All occurrences from baseline through current month are satisfied; target current month occurrence
  return currentMonthDue;
}

/**
 * Derives the active presentation model for a single bill, answering:
 * 1. What do I owe? (expectedAmount)
 * 2. When is it due? (dueDate)
 * 3. How much have I already paid? (paidAmount)
 * 4. What still needs to be paid? (remainingAmount)
 * Along with payment status, payday protection status, and sort rank.
 */
export function getBillItemPresentation(
  s: State,
  b: Bill,
  now = today(),
  precomputedBreakdown?: BillReservationBreakdown,
): BillItemPresentation {
  const validNow = isValidDateString(now) ? now : today();
  const targetDue = getBillTargetOccurrenceDate(s, b, validNow);

  const occStatus = getBillOccurrenceStatus(s, b, targetDue);
  const expectedAmount = occStatus.expectedAmount;
  const paidAmount = occStatus.paidAmount;
  const remainingAmount = occStatus.remainingAmount;
  const overpaidAmount = occStatus.overpaidAmount;
  const isSettled = occStatus.isSettled;

  const isPaid = remainingAmount === 0;
  const isOverdue = !isPaid && targetDue < validNow;
  const isDueSoon = !isPaid && !isOverdue && isBillDueSoon(targetDue, validNow, 3);
  const isPartiallyPaid = !isPaid && paidAmount > 0;

  let status: BillDisplayStatus;
  let statusLabel: string;
  let sortRank: number;

  if (isPaid) {
    status = "paid";
    statusLabel = overpaidAmount > 0 ? "Overpaid" : "Paid";
    sortRank = 3;
  } else if (isOverdue) {
    status = "overdue";
    statusLabel = "Overdue";
    sortRank = 0;
  } else if (isPartiallyPaid) {
    status = "partially_paid";
    statusLabel = "Partially paid";
    sortRank = isDueSoon ? 1 : 2;
  } else if (isDueSoon) {
    status = "due_soon";
    statusLabel = "Due soon";
    sortRank = 1;
  } else {
    status = "upcoming";
    statusLabel = "Upcoming";
    sortRank = 2;
  }

  let protectionStatus: BillProtectionStatus = "unprotected";
  let protectionLabel = "Not reserved";
  let reservedAmount = 0;

  if (isPaid) {
    protectionStatus = "unprotected";
    protectionLabel = "Paid";
    reservedAmount = 0;
  } else {
    const breakdown = precomputedBreakdown || reserveBillsBreakdown(s, validNow);
    const match = breakdown.details.find(
      (d) => d.bill.id === b.id && d.dueDate === targetDue,
    );
    if (match) {
      reservedAmount = match.amount;
      const formattedReserved = `$${(reservedAmount / 100).toFixed(2)}`;

      if (match.cycle === "current") {
        protectionStatus = "current_cycle";
        if (reservedAmount < remainingAmount) {
          const formattedRemaining = `$${(remainingAmount / 100).toFixed(2)}`;
          protectionLabel = `Partially reserved through payday (${formattedReserved} of ${formattedRemaining})`;
        } else {
          protectionLabel = `Reserved through payday (${formattedReserved})`;
        }
      } else if (match.cycle === "following_protected") {
        protectionStatus = "following_protected";
        if (reservedAmount < remainingAmount) {
          const formattedRemaining = `$${(remainingAmount / 100).toFixed(2)}`;
          protectionLabel = `Partially protected next cycle (${formattedReserved} of ${formattedRemaining})`;
        } else {
          protectionLabel = `Protected next cycle (${formattedReserved})`;
        }
      }
    }
  }

  return {
    bill: b,
    dueDate: targetDue,
    expectedAmount,
    paidAmount,
    remainingAmount,
    overpaidAmount,
    reservedAmount,
    status,
    statusLabel,
    isOverdue,
    isDueSoon,
    isPartiallyPaid,
    isPaid,
    isSettled,
    protectionStatus,
    protectionLabel,
    sortRank,
  };
}

/**
 * Organizes bills by actionable priority:
 * 1. Overdue bills (rank 0)
 * 2. Due soon bills (rank 1, within 3 days or partially paid due soon)
 * 3. Other upcoming bills (rank 2)
 * 4. Fully paid bills (rank 3, visually quieter)
 * Secondary sort by due date ascending, tiebreaker by bill name ascending.
 */
export function getOrganizedBills(
  s: State,
  now = today(),
): BillItemPresentation[] {
  const validNow = isValidDateString(now) ? now : today();
  const breakdown = reserveBillsBreakdown(s, validNow);
  const items = s.bills.map((b) =>
    getBillItemPresentation(s, b, validNow, breakdown),
  );

  return items.sort((a, b) => {
    if (a.sortRank !== b.sortRank) {
      return a.sortRank - b.sortRank;
    }
    if (a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    return a.bill.name.localeCompare(b.bill.name);
  });
}

// ============================================================================
// Phase 4A: Daily Home Dashboard Selectors
// ============================================================================

export type AttentionItemCategory =
  | "shortfall"
  | "overdue_minimum"
  | "overdue_bill"
  | "scheduled_expense"
  | "uncovered_minimum"
  | "due_soon_bill";

export type AttentionItemSeverity = "critical" | "warning" | "info";

export interface DailyAttentionItem {
  id: string;
  category: AttentionItemCategory;
  severity: AttentionItemSeverity;
  title: string;
  description: string;
  amount?: number;
  dueDate?: string;
  actionLabel: string;
  targetPage?: string;
  billId?: string;
  billDueDate?: string;
  accountId?: string;
  transactionId?: string;
  urgencyRank: number;
}

export interface DailyAttentionSummary {
  items: DailyAttentionItem[];
  totalCount: number;
  hasMore: boolean;
  moreTargetPage?: string;
  moreLabel?: string;
}

export interface DailySuggestedAction {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  targetPage?: string;
  modalAction?: {
    modal: string;
    id?: string;
    category?: string;
  };
  isUrgent: boolean;
}

export interface DailyPaydayPresentation {
  date: string;
  daysAway: number;
  daysLabel: string;
  isConfirmed: boolean;
  isProjected: boolean;
  statusLabel: string;
  statusDescription: string;
  frequency: PaydayFrequency;
  hasUpcomingPayday: boolean;
}

/**
 * Derives daily attention items from existing state, prioritizing by urgency and financial impact.
 * Limits returned items to a maximum of 3, providing a path to more if additional items exist.
 * Deduplicates related concerns (e.g. scheduled transactions linked to an overdue bill).
 */
export function getDailyAttentionItems(
  s: State,
  now = today(),
): DailyAttentionSummary {
  const validNow = isValidDateString(now) ? now : today();
  const candidates: DailyAttentionItem[] = [];

  // 1. Safe to Spend Shortfall (Highest urgency: Rank 10)
  const t = totals(s, validNow);
  if (t.shortfall > 0) {
    const formattedShortfall = `$${(t.shortfall / 100).toFixed(2)}`;
    candidates.push({
      id: "attention-shortfall",
      category: "shortfall",
      severity: "critical",
      title: "Reserve Shortfall",
      description: `Planned reserves exceed available cash by ${formattedShortfall}. Adjust budgets, pots, or bills.`,
      amount: t.shortfall,
      actionLabel: "Review budgets",
      targetPage: "Budgets",
      urgencyRank: 10,
    });
  }

  // 2. Overdue Credit Card Minimums (Rank 20)
  const ccBreakdown = getCreditCardMinimumBreakdown(s, validNow);
  for (const d of ccBreakdown.details) {
    if (d.additionalProtection > 0 && d.isOverdue && d.dueDate) {
      const formattedAmt = `$${(d.additionalProtection / 100).toFixed(2)}`;
      candidates.push({
        id: `attention-overdue-min-${d.account.id}`,
        category: "overdue_minimum",
        severity: "critical",
        title: `${d.account.name} Minimum Overdue`,
        description: `Minimum payment of ${formattedAmt} was due on ${d.dueDate}.`,
        amount: d.additionalProtection,
        dueDate: d.dueDate,
        actionLabel: "Review card",
        targetPage: "Accounts",
        accountId: d.account.id,
        urgencyRank: 20,
      });
    }
  }

  // 3. Overdue Recurring Bills (Rank 30)
  const organizedBills = getOrganizedBills(s, validNow);
  for (const b of organizedBills) {
    if (b.status === "overdue" && b.remainingAmount > 0) {
      const formattedAmt = `$${(b.remainingAmount / 100).toFixed(2)}`;
      candidates.push({
        id: `attention-overdue-bill-${b.bill.id}`,
        category: "overdue_bill",
        severity: "warning",
        title: `${b.bill.name} Overdue`,
        description: `Was due on ${b.dueDate} · ${formattedAmt} remaining.`,
        amount: b.remainingAmount,
        dueDate: b.dueDate,
        actionLabel: "Pay bill",
        targetPage: "Recurring Bills",
        billId: b.bill.id,
        billDueDate: b.dueDate,
        urgencyRank: 30,
      });
    }
  }

  // Set of bill keys already tracked in attention items to prevent duplicate scheduled alerts
  const activeBillKeys = new Set(
    candidates
      .filter((c) => c.billId)
      .map((c) => `${c.billId}::${c.billDueDate || ""}`),
  );

  // 4. Scheduled Expenses Due Today or Past Due (Rank 40)
  if (Array.isArray(s.transactions)) {
    for (const tx of s.transactions) {
      if (tx.status === "scheduled" && tx.amount < 0 && tx.date <= validNow) {
        if (
          tx.billId &&
          activeBillKeys.has(`${tx.billId}::${tx.billDueDate || ""}`)
        ) {
          // Omit duplicate alert for bill already listed in attention items
          continue;
        }
        const formattedAmt = `$${(Math.abs(tx.amount) / 100).toFixed(2)}`;
        const dateNote = tx.date === validNow ? "today" : tx.date;
        candidates.push({
          id: `attention-scheduled-${tx.id}`,
          category: "scheduled_expense",
          severity: "info",
          title: `${tx.name} scheduled for ${dateNote}`,
          description: `${formattedAmt} scheduled expense is ready to review and confirm.`,
          amount: Math.abs(tx.amount),
          dueDate: tx.date,
          actionLabel: "Review scheduled",
          targetPage: "Transactions",
          transactionId: tx.id,
          urgencyRank: 40,
        });
      }
    }
  }

  // 5. Uncovered Credit Card Minimums in Current Cycle (Rank 50)
  for (const d of ccBreakdown.details) {
    if (
      d.additionalProtection > 0 &&
      !d.isOverdue &&
      d.dueCycle === "current" &&
      d.dueDate
    ) {
      const formattedAmt = `$${(d.additionalProtection / 100).toFixed(2)}`;
      candidates.push({
        id: `attention-uncovered-min-${d.account.id}`,
        category: "uncovered_minimum",
        severity: "warning",
        title: `${d.account.name} Minimum Due Soon`,
        description: `${formattedAmt} minimum due on ${d.dueDate} needs payment coverage.`,
        amount: d.additionalProtection,
        dueDate: d.dueDate,
        actionLabel: "Review card",
        targetPage: "Accounts",
        accountId: d.account.id,
        urgencyRank: 50,
      });
    }
  }

  // 6. Bills Due Soon (within 3 days) (Rank 60)
  for (const b of organizedBills) {
    if (b.status === "due_soon" && b.remainingAmount > 0) {
      const days = daysBetween(validNow, b.dueDate);
      const timing =
        days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
      const formattedAmt = `$${(b.remainingAmount / 100).toFixed(2)}`;
      candidates.push({
        id: `attention-due-soon-bill-${b.bill.id}`,
        category: "due_soon_bill",
        severity: "info",
        title: `${b.bill.name} Due Soon`,
        description: `Due ${timing} (${b.dueDate}) · ${formattedAmt} remaining.`,
        amount: b.remainingAmount,
        dueDate: b.dueDate,
        actionLabel: "Pay bill",
        targetPage: "Recurring Bills",
        billId: b.bill.id,
        billDueDate: b.dueDate,
        urgencyRank: 60,
      });
    }
  }

  // Deterministic sort: urgencyRank ascending, dueDate ascending, amount descending, id ascending
  candidates.sort((a, b) => {
    if (a.urgencyRank !== b.urgencyRank) {
      return a.urgencyRank - b.urgencyRank;
    }
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (
      a.amount !== undefined &&
      b.amount !== undefined &&
      a.amount !== b.amount
    ) {
      return b.amount - a.amount;
    }
    return a.id.localeCompare(b.id);
  });

  const totalCount = candidates.length;
  const items = candidates.slice(0, 3);
  const hasMore = totalCount > 3;
  let moreTargetPage: string | undefined;
  let moreLabel: string | undefined;

  if (hasMore) {
    const remaining = candidates.slice(3);
    const billCount = remaining.filter(
      (i) => i.category === "overdue_bill" || i.category === "due_soon_bill",
    ).length;
    const cardCount = remaining.filter(
      (i) =>
        i.category === "overdue_minimum" || i.category === "uncovered_minimum",
    ).length;

    if (billCount >= cardCount) {
      moreTargetPage = "Recurring Bills";
      moreLabel = `View all bills (${totalCount - 3} more)`;
    } else {
      moreTargetPage = "Accounts";
      moreLabel = `View accounts (${totalCount - 3} more)`;
    }
  }

  return {
    items,
    totalCount,
    hasMore,
    moreTargetPage,
    moreLabel,
  };
}

/**
 * Derives at most one suggested primary next action based on the highest-priority actionable issue.
 * Never implies automatic execution, and provides a calm, neutral suggestion when no urgent issues exist.
 */
export function getDailySuggestedAction(
  s: State,
  items?: DailyAttentionItem[],
  now = today(),
): DailySuggestedAction {
  const validNow = isValidDateString(now) ? now : today();
  const attentionItems = items || getDailyAttentionItems(s, validNow).items;

  if (attentionItems.length > 0) {
    const top = attentionItems[0]!;
    if (top.category === "shortfall") {
      const formattedDeficit = `$${((top.amount || 0) / 100).toFixed(2)}`;
      return {
        id: "action-shortfall",
        title: "Check your Safe to Spend shortfall",
        description: `Your planned reserves exceed cash by ${formattedDeficit}. Adjust budgets or pot allocations to bring your plan into balance.`,
        actionLabel: "Review budgets",
        targetPage: "Budgets",
        isUrgent: true,
      };
    }
    if (top.category === "overdue_minimum") {
      return {
        id: `action-overdue-min-${top.accountId || ""}`,
        title: `Review overdue ${top.title}`,
        description: top.description,
        actionLabel: "Review card",
        targetPage: "Accounts",
        isUrgent: true,
      };
    }
    if (top.category === "overdue_bill") {
      return {
        id: `action-overdue-bill-${top.billId || ""}`,
        title: `Pay overdue bill: ${top.title.replace(" Overdue", "")}`,
        description: top.description,
        actionLabel: "Pay bill",
        targetPage: "Recurring Bills",
        modalAction: {
          modal: "Pay bill",
          id: top.billId,
          category: top.billDueDate,
        },
        isUrgent: true,
      };
    }
    if (top.category === "scheduled_expense") {
      return {
        id: `action-scheduled-${top.id}`,
        title: "Review scheduled expense",
        description: top.description,
        actionLabel: "Review scheduled",
        targetPage: "Transactions",
        isUrgent: false,
      };
    }
    if (top.category === "uncovered_minimum") {
      return {
        id: `action-uncovered-min-${top.accountId || ""}`,
        title: `Protect card minimum: ${top.title.replace(" Minimum Due Soon", "")}`,
        description: top.description,
        actionLabel: "Review card",
        targetPage: "Accounts",
        isUrgent: false,
      };
    }
    if (top.category === "due_soon_bill") {
      return {
        id: `action-due-bill-${top.billId || ""}`,
        title: `Pay upcoming bill: ${top.title.replace(" Due Soon", "")}`,
        description: top.description,
        actionLabel: "Pay bill",
        targetPage: "Recurring Bills",
        modalAction: {
          modal: "Pay bill",
          id: top.billId,
          category: top.billDueDate,
        },
        isUrgent: false,
      };
    }
  }

  // Neutral, optional actions when no urgent attention items exist
  const hasConfiguredBalance =
    (Array.isArray(s.accounts) &&
      s.accounts.some((a) => (a.opening || 0) > 0 || (a.balance || 0) > 0)) ||
    (Number.isFinite(s.opening) && s.opening > 0);
  const hasTransactions =
    Array.isArray(s.transactions) && s.transactions.length > 0;

  if (!hasConfiguredBalance && !hasTransactions) {
    return {
      id: "action-add-account",
      title: "Set up your accounts",
      description:
        "Add your starting bank balance to calculate your Safe to Spend accurately.",
      actionLabel: "Add account",
      modalAction: { modal: "Add account" },
      isUrgent: false,
    };
  }

  const isManual =
    !s.paydaySchedule || s.paydaySchedule.frequency === "manual";
  if (isManual && isValidDateString(s.payday) && s.payday < validNow) {
    return {
      id: "action-update-payday",
      title: "Update your next payday",
      description:
        "Your previous payday date has passed. Set your next payday in Settings to keep daily calculations accurate.",
      actionLabel: "Update payday",
      targetPage: "Settings",
      isUrgent: false,
    };
  }

  return {
    id: "action-record-spending",
    title: "Record daily spending",
    description:
      "Your budget is in good shape today. Record purchases as they happen to keep your Safe to Spend accurate.",
    actionLabel: "Add expense",
    modalAction: { modal: "Add transaction", category: "Expense" },
    isUrgent: false,
  };
}

/**
 * Derives next payday presentation for the daily home dashboard, explicitly distinguishing
 * between confirmed deposit dates and automated projected dates.
 * Never treats projected income as confirmed available cash.
 */
export function getDailyPaydayPresentation(
  s: State,
  now = today(),
): DailyPaydayPresentation {
  const validNow = isValidDateString(now) ? now : today();
  const schedule = s.paydaySchedule;
  const frequency: PaydayFrequency = schedule?.frequency || "manual";

  let targetDate = "";
  let isConfirmed = false;
  let isProjected = false;
  let statusLabel = "";
  let statusDescription = "";

  if (frequency === "manual") {
    const hasManualAnchor =
      isValidDateString(schedule?.anchorDate) || isValidDateString(s.payday);
    const confirmed = hasManualAnchor
      ? getConfirmedUpcomingPaydays(schedule, validNow)
      : [];
    if (confirmed.length > 0) {
      targetDate = confirmed[0]!;
      isConfirmed = true;
      isProjected = false;
      statusLabel = "Confirmed next payday";
      statusDescription = "Explicitly scheduled deposit date.";
    } else if (isValidDateString(s.payday) && s.payday < validNow) {
      targetDate = s.payday;
      isConfirmed = false;
      isProjected = false;
      statusLabel = "Payday passed";
      statusDescription =
        "Your payday has passed. Update it in Settings to refresh your daily plan.";
    } else {
      targetDate = "";
      isConfirmed = false;
      isProjected = false;
      statusLabel = "No payday set";
      statusDescription = "Set your next payday in Settings.";
    }
  } else {
    // Automated cadence
    const current = getCurrentPayday(s, validNow);
    if (isValidDateString(current)) {
      targetDate = current;
      const hasOverride = schedule?.overrides?.some(
        (o) =>
          o.overrideDate === targetDate || o.scheduledDate === targetDate,
      );
      if (hasOverride) {
        isConfirmed = true;
        isProjected = false;
        statusLabel = "Confirmed (adjusted)";
        statusDescription = "One-time payday adjustment for this cycle.";
      } else {
        isConfirmed = false;
        isProjected = true;
        statusLabel = "Projected next payday";
        statusDescription = `Calculated from your ${frequency} cadence.`;
      }
    }
  }

  let daysAway = 0;
  let daysLabel = "";
  const hasUpcomingPayday =
    isValidDateString(targetDate) && targetDate >= validNow;

  if (isValidDateString(targetDate)) {
    if (targetDate === validNow) {
      daysAway = 0;
      daysLabel = "Today";
    } else if (targetDate > validNow) {
      daysAway = daysBetween(validNow, targetDate);
      daysLabel = daysAway === 1 ? "Tomorrow" : `in ${daysAway} days`;
    } else {
      daysAway = -daysBetween(targetDate, validNow);
      daysLabel = "Past due";
    }
  } else {
    daysLabel = "Not set";
  }

  return {
    date: targetDate,
    daysAway,
    daysLabel,
    isConfirmed,
    isProjected,
    statusLabel,
    statusDescription,
    frequency,
    hasUpcomingPayday,
  };
}

export function getUncoveredScheduledExpenses(s: State, now = today()): number {
  const validNow = isValidDateString(now) ? now : today();
  const currentMonth = validNow.slice(0, 7);
  const currentPayday = getCurrentPayday(s, validNow);
  const currentPaydayEnd =
    isValidDateString(currentPayday) && currentPayday >= validNow
      ? currentPayday
      : validNow;

  const billBreakdown = reserveBillsBreakdown(s, validNow);
  const scheduledExpensesByCategory = new Map<string, number>();

  // Track scheduled totals per bill occurrence: key = `${billId}::${dueDate}`
  const scheduledByBillOccurrence = new Map<string, number>();

  for (const t of s.transactions) {
    if (
      t.status === "scheduled" &&
      t.amount < 0 &&
      (t.kind === "standard" || !t.kind)
    ) {
      if (t.date > currentPaydayEnd) continue;

      // Scheduled transactions on non-Safe-to-Spend accounts (such as credit cards or non-included savings)
      // do not reduce spendable cash checking upon confirmation.
      if (t.accountId && s.accounts && s.accounts.length > 0) {
        const acc = s.accounts.find((a) => a.id === t.accountId);
        if (acc && !acc.includeInSafeToSpend) {
          continue;
        }
      }

      if (t.billId) {
        const bill = s.bills.find((b) => b.id === t.billId);
        if (bill) {
          const targetDue =
            t.billDueDate && isValidDateString(t.billDueDate)
              ? t.billDueDate
              : nextUnpaidDueDate(s, bill, t.date);
          const key = `${bill.id}::${targetDue}`;
          scheduledByBillOccurrence.set(
            key,
            (scheduledByBillOccurrence.get(key) || 0) + Math.abs(t.amount),
          );
          continue;
        }
      }

      const cat = t.category;
      scheduledExpensesByCategory.set(
        cat,
        (scheduledExpensesByCategory.get(cat) || 0) + Math.abs(t.amount),
      );
    }
  }

  // Evaluate scheduled bill payments against bill reservations
  for (const [key, totalSched] of scheduledByBillOccurrence.entries()) {
    const [billId, dueDate] = key.split("::");
    const bill = s.bills.find((b) => b.id === billId);
    if (!bill) {
      const cat = "Bills";
      scheduledExpensesByCategory.set(
        cat,
        (scheduledExpensesByCategory.get(cat) || 0) + totalSched,
      );
      continue;
    }

    // Check how much is already reserved in the planning window for this bill occurrence
    const detail = billBreakdown.details.find(
      (d) => d.bill.id === billId && d.dueDate === dueDate,
    );
    const reservedAmt = detail ? detail.amount : 0;

    if (totalSched > reservedAmt) {
      // Excess scheduled commitment beyond the bill's reserved amount must be protected
      const excess = totalSched - reservedAmt;
      const cat = "Bills";
      scheduledExpensesByCategory.set(
        cat,
        (scheduledExpensesByCategory.get(cat) || 0) + excess,
      );
    }
  }

  let uncovered = 0;
  for (const [cat, schedAmt] of scheduledExpensesByCategory.entries()) {
    const budget = s.budgets.find(
      (b) => b.category.toLowerCase() === cat.toLowerCase(),
    );
    if (budget) {
      const remainingBudget = Math.max(
        0,
        budget.limit - spent(s, budget.category, currentMonth),
      );
      if (schedAmt > remainingBudget) {
        uncovered += schedAmt - remainingBudget;
      }
    } else {
      uncovered += schedAmt;
    }
  }

  return uncovered;
}

export function totals(s: State, now = today()) {
  const ledgerTransactions = s.transactions.filter(
    (t) => isLedgerStatus(t.status),
  );
  const scheduledTransactions = s.transactions.filter(
    (t) => t.status === "scheduled",
  );

  const eligibleCashAccounts = (s.accounts || []).filter(
    (a) =>
      !a.archived &&
      (a.type === "checking" || a.type === "savings") &&
      a.includeInSafeToSpend,
  );

  const balance =
    eligibleCashAccounts.length > 0
      ? eligibleCashAccounts.reduce((sum, a) => sum + getAccountBalance(a, s), 0)
      : s.opening + ledgerTransactions.reduce((n, t) => n + t.amount, 0);

  const scheduledIncome = scheduledTransactions
    .filter((t) => (t.kind === "standard" || !t.kind) && t.amount > 0)
    .reduce((n, t) => n + t.amount, 0);

  const scheduledExpenses = Math.abs(
    scheduledTransactions
      .filter((t) => (t.kind === "standard" || !t.kind) && t.amount < 0)
      .reduce((n, t) => n + t.amount, 0),
  );

  const pots = s.pots.reduce((n, p) => n + p.saved, 0);
  const budgets = s.budgets.reduce(
    (n, b) =>
      n + Math.max(0, b.limit - spent(s, b.category, now.slice(0, 7))),
    0,
  );
  const billBreakdown = reserveBillsBreakdown(s, now);
  const bills = billBreakdown.total;
  const uncoveredScheduledExpenses = getUncoveredScheduledExpenses(s, now);

  const creditCardAccounts = (s.accounts || []).filter(
    (a) => !a.archived && a.type === "credit",
  );
  const creditCoverage = creditCardAccounts.map((a) =>
    getCreditCardCoverage(a, s, now),
  );
  const totalReadyToPay = creditCoverage.reduce(
    (sum, c) => sum + c.readyToPay,
    0,
  );
  const totalCreditOwed = creditCoverage.reduce(
    (sum, c) => sum + c.totalOwed,
    0,
  );
  const totalUncoveredDebt = creditCoverage.reduce(
    (sum, c) => sum + c.uncoveredDebt,
    0,
  );
  const totalStatementCredits = creditCoverage.reduce(
    (sum, c) => sum + c.statementCredit,
    0,
  );

  const creditMinBreakdown = getCreditCardMinimumBreakdown(s, now);
  const creditCardMinimums = creditMinBreakdown.totalAdditionalProtection;

  const rawSafe =
    balance -
    pots -
    budgets -
    bills -
    uncoveredScheduledExpenses -
    totalReadyToPay -
    creditCardMinimums;
  const safe = Math.max(0, rawSafe);
  const shortfall = rawSafe < 0 ? Math.abs(rawSafe) : 0;

  return {
    balance,
    pots,
    budgets,
    bills,
    currentCycleBills: billBreakdown.currentCycleBills,
    protectedCycleBills: billBreakdown.protectedCycleBills,
    uncoveredScheduledExpenses,
    creditCardMinimums,
    currentCycleMinimums: creditMinBreakdown.currentCycleMinimums,
    followingCycleMinimums: creditMinBreakdown.followingCycleMinimums,
    protectedFollowingMinimums: creditMinBreakdown.protectedFollowingMinimums,
    scheduledIncome,
    scheduledExpenses,
    totalReadyToPay,
    totalCreditOwed,
    totalUncoveredDebt,
    totalStatementCredits,
    creditCardMinimumBreakdown: creditMinBreakdown,
    rawSafe,
    safe,
    shortfall,
    diagnostics: billBreakdown.diagnostics,
  };
}

export function migrateState(raw: any, now = today()): State {
  if (!raw || typeof raw !== "object") {
    return blank();
  }

  const hasCoveredCredit = raw.version === 4 || raw.version === 5;
  const creditAccountIds = new Set<string>();
  if (Array.isArray(raw.accounts)) {
    for (const a of raw.accounts) {
      if (a && a.type === "credit" && a.id) {
        creditAccountIds.add(String(a.id));
      }
    }
  }

  const transactions: Transaction[] = Array.isArray(raw.transactions)
    ? raw.transactions.map((t: any) => {
        const isFuture = typeof t.date === "string" && t.date > now;
        let status: TransactionStatus;
        if (t.status === "scheduled") {
          status = "scheduled";
        } else if (t.status === "cleared") {
          status = "cleared";
        } else if (t.status === "pending") {
          status = "pending";
        } else if (t.status === "posted") {
          // Requirement 11: Do not automatically classify old posted transactions as bank-reconciled
          status = "pending";
        } else {
          status = isFuture ? "scheduled" : "pending";
        }
        const kind: TransactionKind =
          t.kind === "transfer" || t.kind === "payment" ? t.kind : "standard";

        const accountId = t.accountId ? String(t.accountId) : "acc-default-checking";
        const isCreditTx = creditAccountIds.has(accountId);
        const isLegacyDebt = hasCoveredCredit ? Boolean(t.isLegacyDebt) : isCreditTx;

        return {
          id: String(t.id || uid()),
          name: String(t.name || ""),
          amount: Number(t.amount) || 0,
          category: String(
            t.category ||
              (kind === "transfer"
                ? "Transfer"
                : kind === "payment"
                  ? "Payment"
                  : "General"),
          ),
          date: String(t.date || now),
          billId: t.billId ? String(t.billId) : undefined,
          billDueDate: t.billDueDate ? String(t.billDueDate) : undefined,
          status,
          postedDate: t.postedDate ? String(t.postedDate) : undefined,
          accountId,
          kind,
          targetAccountId: t.targetAccountId ? String(t.targetAccountId) : undefined,
          isLegacyDebt,
          createdAt: t.createdAt ? String(t.createdAt) : undefined,
        };
      })
    : [];

  const migrationMonthStart = `${now.slice(0, 7)}-01`;
  const bills: Bill[] = Array.isArray(raw.bills)
    ? raw.bills.map((b: any) => ({
        id: String(b.id || uid()),
        name: String(b.name || ""),
        amount: Number(b.amount) || 0,
        day: Math.min(31, Math.max(1, Math.round(Number(b.day)) || 1)),
        protected: Boolean(b.protected),
        settledDueDates: Array.isArray(b.settledDueDates)
          ? b.settledDueDates.map(String)
          : [],
        trackingStartDate: isValidDateString(b.trackingStartDate)
          ? b.trackingStartDate
          : migrationMonthStart,
      }))
    : [];

  const settledBills: BillSettlement[] = Array.isArray(raw.settledBills)
    ? raw.settledBills.map((sb: any) => ({
        billId: String(sb.billId),
        dueDate: String(sb.dueDate),
        settledAt: sb.settledAt ? String(sb.settledAt) : undefined,
      }))
    : [];

  const budgets: Budget[] = Array.isArray(raw.budgets)
    ? raw.budgets.map((b: any) => ({
        id: String(b.id || uid()),
        name: b.name ? String(b.name) : undefined,
        category: String(b.category || "General"),
        limit: Number(b.limit) || 0,
        color: String(b.color || colors[0]),
      }))
    : [];

  const pots: Pot[] = Array.isArray(raw.pots)
    ? raw.pots.map((p: any) => ({
        id: String(p.id || uid()),
        name: String(p.name || ""),
        saved: Number(p.saved) || 0,
        target: Number(p.target) || 0,
        color: String(p.color || colors[0]),
      }))
    : [];

  const payday = isValidDateString(raw.payday) ? raw.payday : nextPayday();
  const followingPayday =
    isValidDateString(raw.followingPayday) && raw.followingPayday > payday
      ? raw.followingPayday
      : addDays(payday, 14);

  let paydaySchedule: PaydaySchedule;
  if (raw.paydaySchedule && typeof raw.paydaySchedule === "object") {
    const rawSched = raw.paydaySchedule;
    const validFreqs: PaydayFrequency[] = [
      "manual",
      "weekly",
      "biweekly",
      "semimonthly",
      "monthly",
    ];
    const frequency: PaydayFrequency = validFreqs.includes(rawSched.frequency)
      ? rawSched.frequency
      : "manual";

    const anchorDate = isValidDateString(rawSched.anchorDate)
      ? rawSched.anchorDate
      : payday;

    const weekendRule: WeekendRule =
      rawSched.weekendRule === "preceding_friday" ? "preceding_friday" : "exact";

    let manualFollowingPayday: string | undefined;
    if (
      isValidDateString(rawSched.manualFollowingPayday) &&
      rawSched.manualFollowingPayday > anchorDate
    ) {
      manualFollowingPayday = rawSched.manualFollowingPayday;
    } else if (frequency === "manual") {
      manualFollowingPayday =
        followingPayday > anchorDate
          ? followingPayday
          : addDays(anchorDate, 14);
    }

    const sanitizeScheduleDay = (val: any): number | undefined => {
      if (val === undefined || val === null || val === "") return undefined;
      const num = typeof val === "number" ? val : Number(val);
      if (!Number.isFinite(num)) return undefined;
      const rounded = Math.round(num);
      return Math.min(31, Math.max(1, rounded));
    };

    let dayOfMonth: number | undefined;
    if (rawSched.dayOfMonth !== undefined) {
      dayOfMonth = sanitizeScheduleDay(rawSched.dayOfMonth);
    } else if (frequency === "monthly") {
      dayOfMonth = Number(anchorDate.split("-")[2]) || 1;
    }

    let firstDay: number | undefined;
    let secondDay: number | undefined;
    if (rawSched.firstDay !== undefined || rawSched.secondDay !== undefined) {
      firstDay = sanitizeScheduleDay(rawSched.firstDay);
      secondDay = sanitizeScheduleDay(rawSched.secondDay);
    }
    if (frequency === "semimonthly") {
      firstDay = firstDay ?? 15;
      secondDay = secondDay ?? 31;
    }
    if (firstDay !== undefined && secondDay !== undefined) {
      if (firstDay > secondDay) {
        const tmp = firstDay;
        firstDay = secondDay;
        secondDay = tmp;
      }
      if (firstDay === secondDay) {
        if (secondDay < 31) secondDay++;
        else firstDay--;
      }
    }

    const baseSchedule: PaydaySchedule = {
      frequency,
      anchorDate,
      weekendRule,
      overrides: [],
    };
    if (dayOfMonth !== undefined) baseSchedule.dayOfMonth = dayOfMonth;
    if (firstDay !== undefined) baseSchedule.firstDay = firstDay;
    if (secondDay !== undefined) baseSchedule.secondDay = secondDay;
    if (manualFollowingPayday !== undefined) {
      baseSchedule.manualFollowingPayday = manualFollowingPayday;
    }

    const sanitizedOverrides: PaydayOverride[] = [];
    if (Array.isArray(rawSched.overrides)) {
      for (const o of rawSched.overrides) {
        if (!o || typeof o !== "object") continue;
        const scheduledDate = String(o.scheduledDate || "");
        const overrideDate = String(o.overrideDate || "");

        // Reject invalid calendar dates
        if (
          !isValidDateString(scheduledDate) ||
          !isValidDateString(overrideDate)
        ) {
          continue;
        }

        // Must resolve to a valid nominal occurrence
        const resolvedNominal = resolveNominalOccurrenceDate(
          baseSchedule,
          scheduledDate,
        );
        if (!resolvedNominal) {
          continue;
        }

        // Reject duplicate overrides for the same nominal scheduledDate
        if (
          sanitizedOverrides.some((so) => so.scheduledDate === resolvedNominal)
        ) {
          continue;
        }

        // Reject duplicate overrideDate (collision)
        if (
          sanitizedOverrides.some((so) => so.overrideDate === overrideDate)
        ) {
          continue;
        }

        // Reject invalid sequence bounds using validatePaydayOverride
        const scheduleWithCurrent: PaydaySchedule = {
          ...baseSchedule,
          overrides: sanitizedOverrides,
        };
        const valResult = validatePaydayOverride(
          scheduleWithCurrent,
          resolvedNominal,
          overrideDate,
        );
        if (!valResult.valid) {
          continue;
        }

        sanitizedOverrides.push({
          id: String(o.id || uid()),
          scheduledDate: resolvedNominal,
          overrideDate,
          note: o.note ? String(o.note) : undefined,
          createdAt: o.createdAt ? String(o.createdAt) : now,
        });
      }
      sanitizedOverrides.sort((a, b) =>
        a.scheduledDate.localeCompare(b.scheduledDate),
      );
    }

    paydaySchedule = {
      ...baseSchedule,
      overrides: sanitizedOverrides,
    };
  } else {
    // Schema v5 Migration: Preserves existing v4 payday values and defaults to manual mode
    paydaySchedule = {
      frequency: "manual",
      anchorDate: payday,
      manualFollowingPayday: followingPayday,
      weekendRule: "exact",
      overrides: [],
    };
  }

  const rawOpening = Number(raw.opening) || 0;
  let accounts: Account[] = [];

  if (Array.isArray(raw.accounts) && raw.accounts.length > 0) {
    accounts = raw.accounts.map((a: any) => {
      const isCredit = a.type === "credit";
      const isPrimaryChecking = a.id === "acc-default-checking";
      const type: AccountType =
        a.type === "savings" || a.type === "credit" ? a.type : "checking";

      const opening = isPrimaryChecking
        ? rawOpening
        : a.opening !== undefined
          ? Number(a.opening)
          : a.balance !== undefined
            ? Number(a.balance)
            : 0;

      const acc: Account = {
        id: String(a.id || uid()),
        name: String(a.name || (isCredit ? "Credit Card" : "Account")),
        type,
        opening,
        includeInSafeToSpend: isCredit
          ? false
          : a.includeInSafeToSpend !== undefined
            ? Boolean(a.includeInSafeToSpend)
            : isPrimaryChecking,
        archived: Boolean(a.archived),
        createdAt: String(a.createdAt || now),
        updatedAt: String(a.updatedAt || now),
      };
      if (a.balance !== undefined) {
        acc.balance = Number(a.balance);
      }
      if (isCredit) {
        acc.creditLimit = Number(a.creditLimit) || 0;
        if (a.dueDay) {
          acc.dueDay = Math.min(31, Math.max(1, Number(a.dueDay)));
        }
        if (a.minPayment !== undefined) {
          acc.minPayment = Number(a.minPayment);
        }
        acc.assignedPaymentReserve = hasCoveredCredit ? (Number(a.assignedPaymentReserve) || 0) : 0;
        acc.paymentReservations = (hasCoveredCredit && Array.isArray(a.paymentReservations))
          ? a.paymentReservations.map((pr: any) => ({
              id: String(pr.id || uid()),
              amount: Number(pr.amount) || 0,
              date: String(pr.date || now),
              createdAt: String(pr.createdAt || now),
            }))
          : [];
        acc.coveredCreditBaselineAt = (hasCoveredCredit && a.coveredCreditBaselineAt)
          ? String(a.coveredCreditBaselineAt)
          : now;
        if (a.protected !== undefined) {
          acc.protected = Boolean(a.protected);
        }
        if (Array.isArray(a.confirmedMinimumDueDates)) {
          acc.confirmedMinimumDueDates = a.confirmedMinimumDueDates.map(String);
        }
        if (a.minimumObligations && typeof a.minimumObligations === "object") {
          const sanitized: Record<string, number> = {};
          for (const [d, amt] of Object.entries(a.minimumObligations)) {
            if (isValidDateString(d) && typeof amt === "number" && Number.isFinite(amt) && amt >= 0) {
              sanitized[d] = Math.round(amt);
            }
          }
          acc.minimumObligations = sanitized;
        }
      }
      return acc;
    });
  } else {
    // Phase 1 Migration: convert existing single cash balance into a default checking account
    accounts = [
      {
        id: "acc-default-checking",
        name: "Primary Checking",
        type: "checking",
        opening: rawOpening,
        includeInSafeToSpend: true,
        archived: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  // Ensure there is at least one safe-to-spend cash account
  if (!accounts.some((a) => a.includeInSafeToSpend && !a.archived && a.type !== "credit")) {
    const primary =
      accounts.find((a) => a.type === "checking" && !a.archived) ||
      accounts.find((a) => a.type === "checking");
    if (primary) {
      primary.includeInSafeToSpend = true;
    }
  }

  const version: 2 | 3 | 4 | 5 = (raw.version === 1 || raw.version === 2) ? 2 : (raw.version === 3 ? 4 : 5);

  return {
    version,
    demo: Boolean(raw.demo),
    opening: rawOpening,
    payday,
    followingPayday,
    paydaySchedule,
    transactions,
    budgets,
    pots,
    bills,
    settledBills,
    accounts,
  };
}

export function resetWorkspace(current: State, keepPlan: boolean): State {
  const fresh = blank();
  if (keepPlan) {
    fresh.budgets = current.budgets.map((b) => ({ ...b }));
    fresh.bills = current.bills.map((b) => ({ ...b }));
    fresh.accounts = (current.accounts || []).map((a) => ({ ...a }));
    if (current.paydaySchedule) {
      fresh.paydaySchedule = JSON.parse(JSON.stringify(current.paydaySchedule));
      fresh.payday = current.payday;
      fresh.followingPayday = current.followingPayday;
    }
  }
  return fresh;
}
