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
  if (account.id === "acc-default-checking") {
    const opening =
      account.opening !== 0
        ? account.opening
        : s && typeof s.opening === "number"
          ? s.opening
          : account.opening;
    return opening + delta;
  }
  if (hasAccountLedgerActivity(account, s)) {
    return account.opening + delta;
  }
  return account.balance !== undefined ? account.balance : account.opening;
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

export function isBillPaid(
  s: State,
  b: Bill,
  occurrenceDate = nextDueDate(b, today()),
): boolean {
  // 1. Settlement priority
  if (isBillSettled(s, b, occurrenceDate)) {
    return true;
  }

  // 2. Explicit occurrence linkage has absolute priority (must be an expense payment)
  const hasExplicitMatch = s.transactions.some(
    (t) =>
      isLedgerStatus(t.status) &&
      t.billId === b.id &&
      t.amount < 0 &&
      t.billDueDate === occurrenceDate,
  );
  if (hasExplicitMatch) {
    return true;
  }

  // 3. Candidate legacy/unlinked transactions in the occurrence month (must be expense payments)
  const occurrenceMonth = occurrenceDate.slice(0, 7);
  const unlinkedCandidates = s.transactions.filter(
    (t) =>
      isLedgerStatus(t.status) &&
      t.billId === b.id &&
      t.amount < 0 &&
      !t.billDueDate &&
      t.date.slice(0, 7) === occurrenceMonth,
  );

  if (unlinkedCandidates.length === 0) {
    return false;
  }

  // 4. Ambiguity check 1: If there are earlier unpaid occurrences since tracking began,
  // an unlinked payment cannot be unambiguously assigned to this occurrence without guessing.
  // We retain the obligation rather than guessing or silently releasing the wrong bill.
  if (hasEarlierUnpaidOccurrence(s, b, occurrenceDate)) {
    return false;
  }

  // 5. Ambiguity check 2: If there are multiple unlinked transactions in the same month for this bill,
  // it is ambiguous which occurrence or portion they represent. Retain obligation for reconciliation.
  if (unlinkedCandidates.length > 1) {
    return false;
  }

  return true;
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

  const payDate = isValidDateString(options?.date) ? options!.date! : today();
  let explicitDueDate = options?.dueDate;

  if (!explicitDueDate || !isValidDateString(explicitDueDate)) {
    explicitDueDate = nextUnpaidDueDate(s, bill, payDate);
  }

  if (!isValidDateString(explicitDueDate)) {
    const [pY, pM] = payDate.split("-").map(Number);
    explicitDueDate = getBillDueDate(bill, pY || 2026, pM || 1);
  }

  const txStatus: TransactionStatus = options?.status || "posted";
  const defaultChecking =
    s.accounts?.find((a) => a.type === "checking" && !a.archived)?.id ||
    "acc-default-checking";

  const tx: Transaction = {
    id: uid(),
    name: options?.name || bill.name,
    amount:
      options?.amount !== undefined ? -Math.abs(options.amount) : -bill.amount,
    category: "Bills",
    date: payDate,
    billId: bill.id,
    billDueDate: explicitDueDate,
    status: txStatus,
    postedDate: txStatus !== "scheduled" ? payDate : undefined,
    accountId: options?.accountId || defaultChecking,
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
      currentCycleBills += b.amount;
      details.push({
        bill: b,
        dueDate: validNow,
        amount: b.amount,
        cycle: "current",
      });
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
        if (!isBillPaid(s, b, due)) {
          if (due <= currentPaydayEnd) {
            currentCycleBills += b.amount;
            details.push({
              bill: b,
              dueDate: due,
              amount: b.amount,
              cycle: "current",
            });
          } else if (due <= followingEnd && b.protected) {
            protectedCycleBills += b.amount;
            details.push({
              bill: b,
              dueDate: due,
              amount: b.amount,
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
      currentCycleBills += b.amount;
      details.push({
        bill: b,
        dueDate: validNow,
        amount: b.amount,
        cycle: "current",
      });
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

export function getUncoveredScheduledExpenses(s: State, now = today()): number {
  const currentMonth = now.slice(0, 7);
  const currentPayday = getCurrentPayday(s, now);
  const currentPaydayEnd = currentPayday >= now ? currentPayday : now;
  const scheduledExpensesByCategory = new Map<string, number>();

  for (const t of s.transactions) {
    if (
      t.status === "scheduled" &&
      t.amount < 0 &&
      (t.kind === "standard" || !t.kind)
    ) {
      if (t.date > currentPaydayEnd) continue;
      // Deduplicate only scheduled transactions linked to an active tracked recurring bill
      if (t.billId && s.bills.some((b) => b.id === t.billId)) continue;

      const cat = t.category;
      scheduledExpensesByCategory.set(
        cat,
        (scheduledExpensesByCategory.get(cat) || 0) + Math.abs(t.amount),
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

  const rawSafe =
    balance - pots - budgets - bills - uncoveredScheduledExpenses - totalReadyToPay;
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
    scheduledIncome,
    scheduledExpenses,
    totalReadyToPay,
    totalCreditOwed,
    totalUncoveredDebt,
    totalStatementCredits,
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
