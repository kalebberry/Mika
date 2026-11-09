import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";

/**
 * Helper to initialize a clean non-demo workspace via UI ("Use my own numbers →" -> "Clear everything")
 */
async function seedCleanWorkspace(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Wait for Demo Banner and click "Use my own numbers →"
  const demoBtn = page.locator(".demo-banner button");
  await expect(demoBtn).toBeVisible();
  await demoBtn.click();

  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="radio"][value="all"]').check();
  await dialog.locator(".reset-confirm input[type='checkbox']").check();
  await dialog.getByRole("button", { name: /Confirm and start fresh/i }).click();
  await expect(dialog).toBeHidden();
}

test.describe("Mika Budget — Phase 6C Critical Browser Regression Journeys", () => {
  test("Journey 1 — First-time setup checklist & onboarding workflows", async ({
    page,
  }) => {
    await seedCleanWorkspace(page);

    const checklist = page.locator(".setup-checklist-card");
    await expect(checklist).toBeVisible();
    await expect(checklist).toContainText("0 of 4 complete");

    // Verify all 4 items are initially uncompleted (including payday even with default date)
    const completedItems = checklist.locator(".checklist-item.is-completed");
    await expect(completedItems).toHaveCount(0);

    // 1. Open and complete checking-balance workflow from checklist
    await checklist.getByRole("button", { name: "Adjust balance" }).click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#dialog-title")).toContainText(
      "Adjust balance — Primary Checking",
    );

    const balanceInput = dialog.getByLabel(/New Current Balance/i);
    await balanceInput.fill("2500.00");
    await dialog.getByRole("button", { name: /Update balance/i }).click();
    await expect(dialog).toBeHidden();

    // Checklist should now reflect 1 of 4 complete
    await expect(checklist).toContainText("1 of 4 complete");

    // 2. Verify "Add bill" opens the actual Add bill form and completes item
    await checklist.getByRole("button", { name: "Add bill" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#dialog-title")).toHaveText("Add bill");
    await dialog.getByLabel(/^Name/i).fill("Electric Utility");
    await dialog.getByLabel(/Amount \(\$\)/i).fill("120.00");
    await dialog.getByLabel(/Day of each month/i).fill("15");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(checklist).toContainText("2 of 4 complete");

    // 3. Verify "Add budget" opens the actual Add budget form and completes item
    await checklist.getByRole("button", { name: "Add budget" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#dialog-title")).toHaveText("Add budget");
    await dialog.getByLabel(/^Name/i).fill("Groceries Plan");
    await dialog.getByLabel(/Amount \(\$\)/i).fill("400.00");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(checklist).toContainText("3 of 4 complete");
  });

  test("Journey 2 — Savings pots metadata editing & balance preservation", async ({
    page,
  }) => {
    await seedCleanWorkspace(page);

    // Fund checking account with $2,000.00 first
    const checklist = page.locator(".setup-checklist-card");
    await checklist.getByRole("button", { name: "Adjust balance" }).click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByLabel(/New Current Balance/i).fill("2000.00");
    await dialog.getByRole("button", { name: /Update balance/i }).click();
    await expect(dialog).toBeHidden();

    // Navigate to Pots
    await page.locator(".sidebar").getByRole("button", { name: /Pots/i }).click();
    await expect(page.locator(".page-header h1")).toHaveText("Pots");

    // Create a pot
    await page.locator(".page-header button.primary").click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/^Name/i).fill("Emergency Fund");
    await dialog.getByLabel(/Savings target \(\$\)/i).fill("1000.00");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    // Add $350.00 to the pot
    const potCard = page.locator(".pot-grid .pot-card").first();
    await expect(potCard).toContainText("Emergency Fund");
    await potCard.getByRole("button", { name: /Add money/i }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Amount \(\$\)/i).fill("350.00");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    await expect(potCard.locator(".pot-amount strong")).toHaveText("$350.00");

    // Edit pot name, target, and color
    await potCard.getByRole("button", { name: /Edit Emergency Fund pot/i }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#dialog-title")).toContainText("Edit pot");
    // Ensure no saved balance input exists in Edit pot mode
    await expect(dialog.getByLabel(/Amount \(\$\)/i)).toHaveCount(0);

    await dialog.getByLabel(/^Name/i).fill("Core Emergency Reserve");
    await dialog.getByLabel(/Savings target \(\$\)/i).fill("1500.00");
    await dialog.locator(".swatch-btn").nth(2).click();
    await dialog.getByRole("button", { name: /Save changes/i }).click();
    await expect(dialog).toBeHidden();

    // Verify metadata updated while saved balance ($350.00) is strictly unchanged
    await expect(potCard).toContainText("Core Emergency Reserve");
    await expect(potCard).toContainText("Target of $1,500.00");
    await expect(potCard.locator(".pot-amount strong")).toHaveText("$350.00");

    // Verify Safe to Spend on Overview is $2,000.00 - $350.00 = $1,650.00
    await page.locator(".sidebar").getByRole("button", { name: /Overview/i }).click();
    await expect(page.locator(".safe-card .safe-number")).toHaveText("$1,650.00");
  });

  test("Journey 3 — Dialog transitions, focus management & Escape handling", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await seedCleanWorkspace(page);

    // Navigate to Accounts
    await page.locator(".sidebar").getByRole("button", { name: /Accounts/i }).click();

    // 1. Open "Add account" when Primary Checking exists, then transition in-place to "Adjust balance"
    await page.getByRole("button", { name: /Add account/i }).first().click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#dialog-title")).toHaveText("Add account");

    const transitionBtn = dialog.getByRole("button", {
      name: /Adjust Primary Checking instead/i,
    });
    await expect(transitionBtn).toBeVisible();
    await transitionBtn.click();

    // Verify no InvalidStateError occurred and dialog transitioned cleanly
    expect(pageErrors).toHaveLength(0);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#dialog-title")).toContainText(
      "Adjust balance — Primary Checking",
    );

    // Close via Escape and verify no error
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // 2. Add a secondary savings account ($0 balance), open Edit account from 3-dot menu, transition to Delete account
    await page.getByRole("button", { name: /Add account/i }).first().click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Account Type/i).selectOption("savings");
    await dialog.getByLabel(/Account Name/i).fill("Vacation Savings");
    await dialog.getByLabel(/Starting Balance/i).fill("0");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    // Open 3-dot menu for Vacation Savings
    const menuTrigger = page.getByRole("button", {
      name: "More actions for Vacation Savings",
      exact: true,
    });
    await menuTrigger.click();
    await page.getByRole("menuitem", { name: /Edit details/i }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#dialog-title")).toHaveText("Edit account");

    // Transition into Delete account inside the open dialog
    await dialog.getByRole("button", { name: /Delete account/i }).click();
    expect(pageErrors).toHaveLength(0);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#dialog-title")).toHaveText("Delete account");

    // Press Escape to close and verify focus returns to the connected 3-dot menu trigger
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(menuTrigger).toBeFocused();
  });

  test("Journey 4 — Mobile navigation & More sheet focus containment", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const moreTrigger = page.locator(".mobile-more-btn");
    await expect(moreTrigger).toBeVisible();
    await moreTrigger.click();

    const moreSheet = page.locator(".mobile-more-sheet");
    await expect(moreSheet).toBeVisible();

    // First destination item inside sheet receives initial focus
    const closeBtn = moreSheet.locator(".mobile-more-close");
    const itemButtons = moreSheet.locator(".mobile-more-item");
    await expect(itemButtons.first()).toBeFocused();

    // Shift+Tab moves to the close button (first focusable in sheet), and Shift+Tab again wraps to last item
    await page.keyboard.press("Shift+Tab");
    await expect(closeBtn).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(itemButtons.last()).toBeFocused();

    // Tab from last item wraps to first focusable in sheet (close button)
    await page.keyboard.press("Tab");
    await expect(closeBtn).toBeFocused();

    // Escape closes the sheet and restores focus to the More trigger button
    await page.keyboard.press("Escape");
    await expect(moreSheet).toBeHidden();
    await expect(moreTrigger).toBeFocused();

    // Reopen and navigate to Settings via the More sheet
    await moreTrigger.click();
    await expect(moreSheet).toBeVisible();
    await moreSheet.getByRole("button", { name: /Settings/i }).click();
    await expect(moreSheet).toBeHidden();
    await expect(page.locator(".page-header h1")).toHaveText("Settings");
  });

  test("Journey 5 — Money Outlook single keyboard interaction target", async ({
    page,
  }) => {
    await page.goto("/");

    const outlookCard = page.locator(".money-outlook-summary-card");
    await expect(outlookCard).toBeVisible();

    // Verify the outer card is not a duplicate tab stop (no tabindex attribute)
    await expect(outlookCard).not.toHaveAttribute("tabindex");

    // Verify there is exactly one interactive button inside the card
    const ctaBtn = outlookCard.locator("button.outlook-cta-link");
    await expect(ctaBtn).toHaveCount(1);

    // Focus the single CTA button and activate with Enter
    await ctaBtn.focus();
    await expect(ctaBtn).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.locator(".page-header h1")).toHaveText("Your Insights");
  });

  test("Journey 6 — Backup export download, restore & reminder truthfulness", async ({
    page,
  }) => {
    await seedCleanWorkspace(page);

    // Set checking balance to $1,845.50
    await page
      .locator(".setup-checklist-card")
      .getByRole("button", { name: "Adjust balance" })
      .click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByLabel(/New Current Balance/i).fill("1845.50");
    await dialog.getByRole("button", { name: /Update balance/i }).click();
    await expect(dialog).toBeHidden();

    // Newly created workspace should NOT show an overdue backup reminder banner
    await expect(page.locator(".backup-reminder-banner")).toHaveCount(0);

    // Navigate to Settings
    await page.locator(".sidebar").getByRole("button", { name: /Settings/i }).click();
    await expect(page.locator(".page-header h1")).toHaveText("Settings");
    await expect(page.locator(".storage-health-indicator")).toContainText(
      "Local Browser Storage: Active & Healthy",
    );

    // Export backup and capture the download
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download backup/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^budget-backup-.*\.json$/);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const exportedJson = fs.readFileSync(downloadPath!, "utf-8");
    const parsedEnvelope = JSON.parse(exportedJson);
    expect(parsedEnvelope.app).toBe("mika-budget");
    expect(parsedEnvelope.exportedAt).toBeTruthy();

    // Verify toast message is truthful (does not claim file is safely stored on disk)
    await expect(page.locator(".toast-message")).toContainText(
      "Backup file download started",
    );

    // Reset workspace to $0, then restore the exported backup file
    await page.getByRole("button", { name: /Start fresh/i }).click();
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="radio"][value="all"]').check();
    await dialog.locator(".reset-confirm input[type='checkbox']").check();
    await dialog.getByRole("button", { name: /Confirm and start fresh/i }).click();
    await expect(dialog).toBeHidden();

    // Start fresh returns to Overview; navigate back to Settings to import the backup
    await page.locator(".sidebar").getByRole("button", { name: /Settings/i }).click();
    await expect(page.locator(".page-header h1")).toHaveText("Settings");

    // Upload the backup file via the file input
    const fileInput = page.locator('input[type="file"][accept=".json"]');
    await fileInput.setInputFiles(downloadPath!);

    // Confirm restore in preview modal
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#dialog-title")).toHaveText("Restore backup");
    await expect(dialog).toContainText("$1,845.50");
    await dialog.locator(".reset-confirm input[type='checkbox']").check();
    await dialog.getByRole("button", { name: /Replace and restore backup/i }).click();
    await expect(dialog).toBeHidden();

    // Navigate to Overview and verify $1,845.50 Safe to Spend is restored
    await page.locator(".sidebar").getByRole("button", { name: /Overview/i }).click();
    await expect(page.locator(".safe-card .safe-number")).toHaveText("$1,845.50");
  });

  test("Journey 7 — Transaction and budget workflow updates ledger & Safe to Spend", async ({
    page,
  }) => {
    await seedCleanWorkspace(page);

    // 1. Set checking balance to $1,000.00
    const checklist = page.locator(".setup-checklist-card");
    await checklist.getByRole("button", { name: "Adjust balance" }).click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByLabel(/New Current Balance/i).fill("1000.00");
    await dialog.getByRole("button", { name: /Update balance/i }).click();
    await expect(dialog).toBeHidden();

    // 2. Create a "Dining Out" budget of $200.00
    await checklist.getByRole("button", { name: "Add budget" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/^Name/i).fill("Dining Out");
    await dialog.getByLabel(/Category/i).selectOption("Dining Out");
    await dialog.getByLabel(/Amount \(\$\)/i).fill("200.00");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    // Safe to Spend should now be $1,000.00 - $200.00 reserved budget = $800.00
    await expect(page.locator(".safe-card .safe-number")).toHaveText("$800.00");

    // 3. Add a $45.00 Dining Out expense transaction
    await page.locator(".page-header button.primary").click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#dialog-title")).toHaveText("Add transaction");
    await dialog.getByLabel(/Amount \(\$\)/i).fill("45.00");
    await dialog.getByLabel(/Category/i).selectOption("Dining Out");
    await dialog.getByLabel(/Payee \/ Description/i).fill("Local Cafe");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    // Because $45.00 was spent within the $200.00 Dining Out budget, Safe to Spend remains $800.00!
    await expect(page.locator(".safe-card .safe-number")).toHaveText("$800.00");

    // 4. Verify the transaction in Transactions ledger
    await page
      .locator(".sidebar")
      .getByRole("button", { name: /Transactions/i })
      .click();
    await expect(page.locator("table")).toContainText("Local Cafe");
    await expect(page.locator("table")).toContainText("$45.00");

    // 5. Verify budget progress in Budgets view ($45.00 spent, $155.00 remaining)
    await page.locator(".sidebar").getByRole("button", { name: /Budgets/i }).click();
    await expect(page.locator(".budgets-layout")).toContainText("$45.00");
    await expect(page.locator(".budgets-layout")).toContainText("$155.00");
  });

  test("Journey 8 — Responsive accessibility, overflow & 48px touch targets (320px, 375px, desktop)", async ({
    page,
  }) => {
    await seedCleanWorkspace(page);

    // Create a pot on desktop first so we can verify pot Edit/Delete touch targets across viewports
    await page.locator(".sidebar").getByRole("button", { name: /Pots/i }).click();
    await page.locator(".page-header button.primary").click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByLabel(/^Name/i).fill("Rainy Day");
    await dialog.getByLabel(/Savings target \(\$\)/i).fill("500.00");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    // 1. Check Pots view across 320px, 375px, and 1280px
    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({ width, height: 800 });

      const potsOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(potsOverflow).toBe(false);

      if (width <= 375) {
        const editPotBtn = page
          .getByRole("button", { name: /Edit Rainy Day pot/i })
          .first();
        const editBox = await editPotBtn.boundingBox();
        expect(editBox?.height).toBeGreaterThanOrEqual(48);

        const deletePotBtn = page
          .getByRole("button", { name: /Delete Rainy Day pot/i })
          .first();
        const deleteBox = await deletePotBtn.boundingBox();
        expect(deleteBox?.height).toBeGreaterThanOrEqual(48);
        expect(deleteBox?.width).toBeGreaterThanOrEqual(48);
      }
    }

    // 2. Navigate to Overview and check across 320px, 375px, and 1280px
    await page
      .locator(".sidebar")
      .getByRole("button", { name: /Overview/i })
      .click();

    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({ width, height: 800 });

      const overflowingEls = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth <= vw) return [];
        const bad: string[] = [];
        for (const el of Array.from(document.querySelectorAll("*"))) {
          const r = el.getBoundingClientRect();
          if (r.right > vw + 1) {
            bad.push(
              `${el.tagName.toLowerCase()}.${Array.from(el.classList).join(".")} (right=${Math.round(r.right)} > ${vw})`,
            );
          }
        }
        return bad.slice(0, 10);
      });
      expect(overflowingEls, `Overflow at ${width}px`).toEqual([]);

      if (width <= 375) {
        const checklistActionBtn = page
          .locator(".setup-checklist-card .setup-action-btn")
          .first();
        const actionBox = await checklistActionBtn.boundingBox();
        expect(actionBox?.height).toBeGreaterThanOrEqual(48);

        const dismissBtn = page.locator(
          ".setup-checklist-card .dismiss-btn",
        );
        const dismissBox = await dismissBtn.boundingBox();
        expect(dismissBox?.height).toBeGreaterThanOrEqual(48);
        expect(dismissBox?.width).toBeGreaterThanOrEqual(48);

        // Verify visible mobile bottom navigation buttons meet 48px touch target
        const navBtns = page.locator(".sidebar nav > button:visible");
        const navCount = await navBtns.count();
        expect(navCount).toBeGreaterThanOrEqual(5);
        for (let i = 0; i < navCount; i++) {
          const box = await navBtns.nth(i).boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(48);
        }
      }
    }
  });

  test("Journey 9 — Seven-Day Financial Simulation & Persistence Round-Trip (Nov 10–16, 2026)", async ({
    page,
  }) => {
    // Set deterministic system clock starting on Day 1 (2026-11-10) without freezing timers
    await page.clock.setSystemTime(new Date("2026-11-10T09:00:00"));

    const baselineState = {
      version: 5,
      demo: false,
      setupDismissed: true,
      workspaceCreatedAt: "2026-11-01",
      opening: 320000,
      payday: "2026-11-15",
      followingPayday: "2026-11-29",
      paydaySchedule: {
        frequency: "biweekly",
        anchorDate: "2026-11-15",
        weekendRule: "exact",
        overrides: [],
        configured: true,
      },
      accounts: [
        {
          id: "acc-default-checking",
          name: "Primary Checking",
          type: "checking",
          opening: 320000, // $3,200.00
          includeInSafeToSpend: true,
          archived: false,
          createdAt: "2026-11-01",
          updatedAt: "2026-11-10",
          lastVerifiedAt: "2026-11-10",
        },
        {
          id: "acc-savings-1",
          name: "High-Yield Savings",
          type: "savings",
          opening: 500000, // $5,000.00 (excluded from Safe to Spend)
          includeInSafeToSpend: false,
          archived: false,
          createdAt: "2026-11-01",
          updatedAt: "2026-11-10",
          lastVerifiedAt: "2026-11-10",
        },
        {
          id: "acc-cc-sapphire",
          name: "Sapphire Rewards Card",
          type: "credit",
          opening: 45000, // $450.00 prior uncovered debt
          creditLimit: 500000, // $5,000.00
          dueDay: 18,
          minPayment: 5000, // $50.00 minimum due 2026-11-18
          protected: true,
          includeInSafeToSpend: false,
          archived: false,
          createdAt: "2026-11-01",
          updatedAt: "2026-11-10",
          coveredCreditBaselineAt: "2026-11-01",
          assignedPaymentReserve: 0,
          paymentReservations: [],
        },
      ],
      pots: [
        {
          id: "pot-emergency",
          name: "Emergency Fund",
          saved: 60000, // $600.00
          target: 200000,
          color: "#277c78",
        },
        {
          id: "pot-vacation",
          name: "Vacation Fund",
          saved: 30000, // $300.00
          target: 100000,
          color: "#82c9d7",
        },
      ],
      budgets: [
        {
          id: "b-groceries",
          name: "Groceries",
          category: "Groceries",
          limit: 40000, // $400.00
          color: "#277c78",
        },
        {
          id: "b-dining",
          name: "Dining Out",
          category: "Dining Out",
          limit: 15000, // $150.00
          color: "#f2cdac",
        },
        {
          id: "b-fun",
          name: "Entertainment",
          category: "Entertainment",
          limit: 10000, // $100.00
          color: "#826cb0",
        },
      ],
      bills: [
        {
          id: "bill-internet",
          name: "Internet Fiber",
          amount: 8000, // $80.00
          day: 11,
          protected: true,
          settledDueDates: [],
          trackingStartDate: "2026-11-01",
        },
        {
          id: "bill-electric",
          name: "Electric Utility",
          amount: 14000, // $140.00
          day: 14,
          protected: true,
          settledDueDates: [],
          trackingStartDate: "2026-11-01",
        },
        {
          id: "bill-rent",
          name: "Apartment Rent",
          amount: 120000, // $1,200.00
          day: 25,
          protected: false,
          settledDueDates: [],
          trackingStartDate: "2026-11-01",
        },
      ],
      settledBills: [],
      transactions: [],
    };

    await page.goto("/");
    await page.evaluate((stateJson) => {
      localStorage.setItem("budget-companion-v1", stateJson);
    }, JSON.stringify(baselineState));
    await page.reload();

    const dialog = page.locator("dialog[open]");
    const safeNumber = page.locator(".safe-card .safe-number");
    const safeBreakdown = page.locator("#safe-breakdown-details");

    // Expand Safe to Spend breakdown once on Overview
    await expect(safeNumber).toHaveText("$1,380.00");
    await page.locator("#safe-breakdown-toggle").click();
    await expect(safeBreakdown).toBeVisible();
    await expect(safeBreakdown).toContainText("$3,200.00"); // Checking balance
    await expect(safeBreakdown).toContainText("− $900.00"); // Pots
    await expect(safeBreakdown).toContainText("− $650.00"); // Budgets
    await expect(safeBreakdown).toContainText("− $220.00"); // Bills due before payday
    await expect(safeBreakdown).toContainText("− $50.00"); // Next cycle card minimums protected

    // -----------------------------------------------------------------------
    // Day 1 (2026-11-10): Cash Groceries (-$125.00) + Add $150.00 to Vacation Fund pot
    // -----------------------------------------------------------------------
    await page.locator(".page-header button.primary").click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Amount \(\$\)/i).fill("125.00");
    await dialog.getByLabel(/Category/i).selectOption("Groceries");
    await dialog.getByLabel(/Payee \/ Description/i).fill("Trader Joe's");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    // Navigate to Pots and add $150.00 to Vacation Fund
    await page.locator(".sidebar").getByRole("button", { name: /Pots/i }).click();
    const vacationPot = page
      .locator(".pot-card")
      .filter({ hasText: "Vacation Fund" });
    await vacationPot.getByRole("button", { name: /Add money/i }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Amount \(\$\)/i).fill("150.00");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(vacationPot.locator(".pot-amount strong")).toHaveText("$450.00");

    // Verify Day 1 on Overview
    await page.locator(".sidebar").getByRole("button", { name: /Overview/i }).click();
    await expect(safeNumber).toHaveText("$1,230.00");
    await page.locator("#safe-breakdown-toggle").click();
    await expect(safeBreakdown).toContainText("$3,075.00");
    await expect(safeBreakdown).toContainText("− $1,050.00");
    await expect(safeBreakdown).toContainText("− $525.00");

    // -----------------------------------------------------------------------
    // Day 2 (2026-11-11): Pay Internet Fiber bill (-$80.00) + Credit Card Dining Out (-$90.00)
    // -----------------------------------------------------------------------
    await page.clock.setSystemTime(new Date("2026-11-11T09:00:00"));

    await page
      .locator(".sidebar")
      .getByRole("button", { name: /Recurring Bills/i })
      .click();
    const internetBill = page
      .locator(".bill-item")
      .filter({ hasText: "Internet Fiber" });
    await internetBill.getByRole("button", { name: /Pay bill/i }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Confirm payment/i }).click();
    await expect(dialog).toBeHidden();

    // Log $90.00 Dining Out purchase on Sapphire Rewards Card
    await page.locator(".sidebar").getByRole("button", { name: /Overview/i }).click();
    await page.locator(".page-header button.primary").click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox", { name: /^Account/i }).selectOption("acc-cc-sapphire");
    await dialog.getByLabel(/Amount \(\$\)/i).fill("90.00");
    await dialog.getByLabel(/Category/i).selectOption("Dining Out");
    await dialog.getByLabel(/Payee \/ Description/i).fill("Bistro Maya");
    await expect(dialog.locator(".credit-impact-card")).toContainText(
      "Fully Covered",
    );
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    // Verify Day 2 on Overview ($1,280.00 Safe to Spend: +$50 because $90 RTP covers the $50 CC minimum!)
    await expect(safeNumber).toHaveText("$1,280.00");
    await page.locator("#safe-breakdown-toggle").click();
    await expect(safeBreakdown).toContainText("$2,995.00");
    await expect(safeBreakdown).toContainText("− $140.00"); // Bills due before payday
    await expect(safeBreakdown).toContainText("− $435.00"); // Remaining budgets
    await expect(safeBreakdown).toContainText("− $90.00"); // Credit card payment reserves

    // -----------------------------------------------------------------------
    // Day 3 (2026-11-12): Transfer -$300.00 Checking -> Savings + Unexpected Auto Repair (-$210.00)
    // -----------------------------------------------------------------------
    await page.clock.setSystemTime(new Date("2026-11-12T09:00:00"));

    // Transfer $300.00 from Primary Checking to High-Yield Savings
    await page.locator(".page-header button.primary").click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Transaction Type/i).selectOption("Transfer");
    await dialog.getByLabel(/To Account/i).selectOption("acc-savings-1");
    await dialog.getByLabel(/Amount \(\$\)/i).fill("300.00");
    await dialog
      .getByLabel(/Description/i)
      .fill("Transfer to High-Yield Savings");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    // Unexpected Auto Repair (-$210.00) on Primary Checking (with status 'posted' to test edit status preservation on Day 7)
    await page.locator(".page-header button.primary").click();
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("combobox", { name: /^Account/i })
      .selectOption("acc-default-checking");
    await dialog.getByLabel(/Amount \(\$\)/i).fill("210.00");
    await dialog.getByLabel(/Category/i).selectOption("Transport");
    await dialog
      .getByLabel(/Payee \/ Description/i)
      .fill("Metro Auto Tire Repair");
    await dialog.getByLabel(/Status/i).selectOption("posted");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    await expect(safeNumber).toHaveText("$770.00");

    // Verify Accounts stat cards on Day 3
    await page
      .locator(".sidebar")
      .getByRole("button", { name: /Accounts/i })
      .click();
    const accountsGrid = page.locator(".accounts-stat-grid");
    await expect(accountsGrid).toContainText("$7,785.00"); // Total Cash Assets ($2,485 + $5,300)
    await expect(accountsGrid).toContainText("$540.00"); // Total Credit Card Debt
    await expect(accountsGrid).toContainText("$90.00"); // Ready to Pay

    // -----------------------------------------------------------------------
    // Day 4 (2026-11-13): Cash Dining Out (-$85.00) exceeds remaining $60.00 Dining Out budget by $25.00
    // -----------------------------------------------------------------------
    await page.clock.setSystemTime(new Date("2026-11-13T09:00:00"));

    await page.locator(".sidebar").getByRole("button", { name: /Overview/i }).click();
    await page.locator(".page-header button.primary").click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Amount \(\$\)/i).fill("85.00");
    await dialog.getByLabel(/Category/i).selectOption("Dining Out");
    await dialog.getByLabel(/Payee \/ Description/i).fill("Sushi Omakase");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    // Verify Day 4: Safe to Spend drops by $25 overage to $745.00, while Day 2's $90.00 Ready to Pay stays intact!
    await expect(safeNumber).toHaveText("$745.00");
    await page.locator("#safe-breakdown-toggle").click();
    await expect(safeBreakdown).toContainText("$2,400.00");
    await expect(safeBreakdown).toContainText("− $375.00"); // Remaining budgets ($275 Groceries + $0 Dining + $100 Fun)
    await expect(safeBreakdown).toContainText("− $90.00"); // Credit card payment reserves preserved!

    // -----------------------------------------------------------------------
    // Day 5 (2026-11-14): Pay Electric Utility bill (-$140.00) + Credit Card Payment (-$140.00)
    // -----------------------------------------------------------------------
    await page.clock.setSystemTime(new Date("2026-11-14T09:00:00"));

    await page
      .locator(".sidebar")
      .getByRole("button", { name: /Recurring Bills/i })
      .click();
    const electricBill = page
      .locator(".bill-item")
      .filter({ hasText: "Electric Utility" });
    await electricBill.getByRole("button", { name: /Pay bill/i }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Confirm payment/i }).click();
    await expect(dialog).toBeHidden();

    // Make $140.00 Credit Card Payment ($90.00 covered by Ready to Pay + $50.00 uncovered debt paydown)
    await page.locator(".sidebar").getByRole("button", { name: /Overview/i }).click();
    await page.locator(".page-header button.primary").click();
    await expect(dialog).toBeVisible();
    await dialog
      .getByLabel(/Transaction Type/i)
      .selectOption("Credit Card Payment");
    await dialog.getByLabel(/Amount \(\$\)/i).fill("140.00");
    await expect(dialog.locator(".payment-coverage-callout")).toContainText(
      "Partially Covered",
    );
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    // Verify Day 5 on Overview ($695.00 Safe to Spend, $2,120.00 Checking, $0.00 Bills)
    await expect(safeNumber).toHaveText("$695.00");
    await page.locator("#safe-breakdown-toggle").click();
    await expect(safeBreakdown).toContainText("$2,120.00");
    await expect(safeBreakdown).toContainText("− $0.00"); // Bills due before payday

    // -----------------------------------------------------------------------
    // Day 6 (2026-11-15, Payday): Biweekly Paycheck (+$1,850.00) posted to Checking
    // -----------------------------------------------------------------------
    await page.clock.setSystemTime(new Date("2026-11-15T09:00:00"));

    await page.locator(".page-header button.primary").click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Transaction Type/i).selectOption("Income");
    await dialog.getByLabel(/Amount \(\$\)/i).fill("1850.00");
    await dialog.getByLabel(/Payer \/ Description/i).fill("Acme Corp Payroll");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(dialog).toBeHidden();

    await expect(safeNumber).toHaveText("$2,545.00");
    await expect(safeBreakdown).toContainText("$3,970.00");

    // -----------------------------------------------------------------------
    // Day 7 (2026-11-16): Payday horizon rollover + Reload persistence + Edit Day 3 Auto Repair (-$210 -> -$180)
    // -----------------------------------------------------------------------
    await page.clock.setSystemTime(new Date("2026-11-16T09:00:00"));
    await page.reload();

    // Navigate to Transactions and edit Day 3 Auto Repair from $210.00 to $180.00
    await page
      .locator(".sidebar")
      .getByRole("button", { name: /Transactions/i })
      .click();
    await page
      .getByRole("button", { name: "Edit Metro Auto Tire Repair" })
      .click();
    await expect(dialog).toBeVisible();
    // Verify status select preserved ledger posted/pending state across reload
    await expect(dialog.getByLabel(/Status/i)).toHaveValue(/^(posted|pending)$/);
    await dialog.getByLabel(/Amount \(\$\)/i).fill("180.00");
    await dialog.getByRole("button", { name: /Save changes/i }).click();
    await expect(dialog).toBeHidden();

    // Verify Day 7 on Overview ($1,295.00 Safe to Spend, $4,000.00 Checking, $1,200.00 current-cycle Rent + $80.00 next-cycle protected Internet Fiber)
    await page.locator(".sidebar").getByRole("button", { name: /Overview/i }).click();
    await expect(safeNumber).toHaveText("$1,295.00");
    await page.locator("#safe-breakdown-toggle").click();
    await expect(safeBreakdown).toContainText("$4,000.00");
    await expect(safeBreakdown).toContainText("− $1,200.00"); // Bills due before payday (Rent due Nov 25)
    await expect(safeBreakdown).toContainText("− $80.00"); // Next cycle bills protected (Internet Fiber due Dec 11 <= Dec 13)

    // -----------------------------------------------------------------------
    // Backup Export & Full Restore Integrity Verification on Day 7
    // -----------------------------------------------------------------------
    await page.locator(".sidebar").getByRole("button", { name: /Settings/i }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download backup/i }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Reset workspace to $0, then restore the Day 7 backup file
    await page.getByRole("button", { name: /Start fresh/i }).click();
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="radio"][value="all"]').check();
    await dialog.locator(".reset-confirm input[type='checkbox']").check();
    await dialog
      .getByRole("button", { name: /Confirm and start fresh/i })
      .click();
    await expect(dialog).toBeHidden();
    await expect(safeNumber).toHaveText("$0.00");

    // Import and restore Day 7 backup
    await page.locator(".sidebar").getByRole("button", { name: /Settings/i }).click();
    const fileInput = page.locator('input[type="file"][accept=".json"]');
    await fileInput.setInputFiles(downloadPath!);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#dialog-title")).toHaveText("Restore backup");
    await dialog.locator(".reset-confirm input[type='checkbox']").check();
    await dialog
      .getByRole("button", { name: /Replace and restore backup/i })
      .click();
    await expect(dialog).toBeHidden();

    // Verify restored Day 7 state on Overview and Accounts
    await page.locator(".sidebar").getByRole("button", { name: /Overview/i }).click();
    await expect(safeNumber).toHaveText("$1,295.00");
    await page.locator(".sidebar").getByRole("button", { name: /Accounts/i }).click();
    await expect(accountsGrid).toContainText("$9,300.00"); // Total Cash Assets ($4,000 + $5,300)
    await expect(accountsGrid).toContainText("$400.00"); // Total Credit Card Debt
    await expect(accountsGrid).toContainText("$0.00"); // Ready to Pay
  });

  test("Journey 10 — Release candidate hardening: Start fresh confirmation, Keep budgets and bills reset, reload persistence, duplicate prevention, Vercel routing, and reduced motion", async ({
    page,
  }) => {
    // 1. Reduced-motion preference emulation & Vercel URL routing check
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#insights");
    const insightsHeader = page.locator(".page-header h1");
    await expect(insightsHeader).toHaveText("Your Insights");

    // 2. Start fresh confirmation button guard
    await page.goto("/#settings");
    const startFreshBtn = page.getByRole("button", { name: /Start fresh/i });
    await expect(startFreshBtn).toBeVisible();
    await startFreshBtn.click();

    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#dialog-title")).toHaveText("Start fresh");

    const confirmBtn = dialog.getByRole("button", {
      name: /Confirm and start fresh/i,
    });
    const confirmCheckbox = dialog.locator(
      ".reset-confirm input[type='checkbox']",
    );

    // Destructive confirmation button must be disabled until checkbox is checked
    await expect(confirmBtn).toBeDisabled();
    await confirmCheckbox.check();
    await expect(confirmBtn).toBeEnabled();
    await confirmCheckbox.uncheck();
    await expect(confirmBtn).toBeDisabled();

    // 3. "Keep my budgets and bills" reset execution
    await dialog.locator('input[type="radio"][value="keep"]').check();
    await confirmCheckbox.check();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await expect(dialog).toBeHidden();

    // After reset: lands on Overview with Safe to Spend = $0.00
    const safeNumber = page.locator(".safe-card .safe-number");
    await expect(safeNumber).toHaveText("$0.00");

    // Budgets preserved
    await page.locator(".sidebar").getByRole("button", { name: /Budgets/i }).click();
    const budgetLines = page.locator(".budget-summary .summary-line");
    const budgetCount = await budgetLines.count();
    expect(budgetCount).toBeGreaterThan(0);

    // Recurring bills preserved and marked unpaid
    await page
      .locator(".sidebar")
      .getByRole("button", { name: /Recurring Bills/i })
      .click();
    const billItems = page.locator(".bill-item");
    const billCount = await billItems.count();
    expect(billCount).toBeGreaterThan(0);
    const paidBadges = page.locator(".bill-item .badge.paid");
    await expect(paidBadges).toHaveCount(0); // All kept bills reset to unpaid

    // Accounts preserved with $0.00 balances
    await page.locator(".sidebar").getByRole("button", { name: /Accounts/i }).click();
    const accountsGrid = page.locator(".accounts-stat-grid");
    await expect(accountsGrid).toContainText("$0.00");

    // 4. Reload persistence
    await page.reload();
    await expect(accountsGrid).toContainText("$0.00");
    await page.locator(".sidebar").getByRole("button", { name: /Overview/i }).click();
    await expect(safeNumber).toHaveText("$0.00");

    // 5. Duplicate-submit prevention via modal submission guard
    await page.locator(".sidebar").getByRole("button", { name: /Transactions/i }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(0);

    const addTxBtn = page.getByRole("button", { name: /Record first transaction|Add transaction/i }).first();
    await addTxBtn.click();
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/Payee \/ Description/i).fill("Hardware Store");
    await dialog.getByLabel(/Amount \(\$\)/i).fill("34.50");
    const submitBtn = dialog.getByRole("button", { name: /^Save$/i });

    // Submit and ensure modal closes cleanly
    await submitBtn.click();
    await expect(dialog).toBeHidden();

    // Verify exactly one transaction was recorded
    const finalTxRows = page.locator("table tbody tr");
    await expect(finalTxRows).toHaveCount(1);

    // 6. Navigation to Vercel-compatible URLs: both /#recurring-bills and /recurring-bills
    await page.goto("/#recurring-bills");
    const billsHeader = page.locator(".page-header h1");
    await expect(billsHeader).toHaveText("Recurring Bills");

    // Pathname deep link (/recurring-bills) served via SPA routing and normalized to hash navigation
    await page.goto("/recurring-bills");
    await expect(billsHeader).toHaveText("Recurring Bills");
    await expect(page).toHaveURL(/.*#recurring-bills/);

    // Another pathname deep link (/budgets)
    await page.goto("/budgets");
    await expect(page.locator(".page-header h1")).toHaveText("Budgets");
    await expect(page).toHaveURL(/.*#budgets/);
  });
});
