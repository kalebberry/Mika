<script setup lang="ts">
import { today } from "../../model";
import { companionPortraits } from "../../companion";
import { useBudget } from "../../composables/useBudget";
import { useCompanion } from "../../composables/useCompanion";
import { useModal } from "../../composables/useModal";

const {
  settingsBalance,
  settingsPayday,
  settingsFollowingPayday,
  settingsSaved,
  saveSettings,
  backup,
  importBackup,
} = useBudget();

const {
  showCompanion,
  selectedWebModel,
  webGpuAvailable,
  availableWebModels,
} = useCompanion();

const { open } = useModal();
</script>

<template>
  <div class="settings-layout">
    <div class="settings-col">
      <section class="card settings-card">
        <div class="section-heading">
          <h2>
            <span class="settings-heading-icon">💰</span>
            Financial Baseline
          </h2>
        </div>
        <p class="muted settings-desc">
          Update your starting balance and regular payday schedule so your
          Safe-to-Spend calculations remain accurate.
        </p>
        <form @submit.prevent="saveSettings" class="settings-form">
          <label>
            <span>Current account balance ($)</span>
            <input
              v-model="settingsBalance"
              type="number"
              step="0.01"
              required
              inputmode="decimal"
              placeholder="0.00"
            />
            <small>
              Total cash available, including any money designated for savings
              pots.
            </small>
          </label>
          <label>
            <span>Next payday</span>
            <input
              v-model="settingsPayday"
              type="date"
              :min="today()"
              required
            />
            <small>
              Used to calculate daily safe-to-spend allowance until your next
              income.
            </small>
          </label>
          <label>
            <span>Following payday</span>
            <input
              v-model="settingsFollowingPayday"
              type="date"
              :min="settingsPayday || today()"
              required
            />
            <small>
              The paycheck after your next one. Used to identify upcoming essential bills to protect (like next month’s rent).
            </small>
          </label>
          <div class="formula-note">
            <strong>Formula:</strong> Safe to spend = balance − pots − remaining
            monthly budgets − unpaid bills through payday − protected next cycle bills.
          </div>
          <div class="settings-action-row">
            <button class="primary" type="submit">Save baseline</button>
            <span v-if="settingsSaved" class="saved-badge">
              ✓ Changes saved
            </span>
          </div>
        </form>
      </section>

      <section class="card settings-card">
        <div class="section-heading">
          <h2>
            <span class="settings-heading-icon">💾</span>
            Data Storage & Privacy
          </h2>
        </div>
        <p class="muted settings-desc">
          Your financial details are stored 100% locally in your browser
          storage. Zero tracking and no external servers.
        </p>
        <div class="settings-data-actions">
          <div class="data-action-item">
            <div>
              <strong>Export Backup</strong>
              <p class="muted">
                Download a complete JSON file of all your transactions, budgets,
                pots, and bills.
              </p>
            </div>
            <button type="button" class="secondary" @click="backup">
              Download backup ↓
            </button>
          </div>
          <div class="data-action-item">
            <div>
              <strong>Import Backup</strong>
              <p class="muted">
                Restore your budget data from an exported JSON file.
              </p>
            </div>
            <label class="secondary file-upload-btn">
              <span>Choose file ↑</span>
              <input
                type="file"
                accept=".json"
                @change="importBackup"
                class="sr-only"
              />
            </label>
          </div>
        </div>
        <div class="reset-settings">
          <div>
            <h3>Need a fresh start?</h3>
            <p class="muted">
              Restart anytime. You can keep your budgets and recurring bills or
              clear everything.
            </p>
          </div>
          <button
            class="secondary"
            type="button"
            @click="open('Start fresh')"
          >
            Start fresh ›
          </button>
        </div>
      </section>
    </div>

    <div class="settings-col">
      <section class="card settings-card">
        <div class="section-heading">
          <h2>
            <span class="settings-heading-icon">✨</span>
            Budget Companion
          </h2>
          <span class="companion-tag">Mika</span>
        </div>
        <div class="companion-settings-banner">
          <div class="companion-preview-avatar">
            <img
              :src="companionPortraits.welcome"
              alt="Mika avatar"
              width="56"
              height="56"
            />
          </div>
          <div class="companion-preview-info">
            <strong>Mika</strong>
            <p class="muted">
              Your mindful financial companion who offers encouraging tips and
              payday reminders.
            </p>
          </div>
        </div>
        <div class="toggle-card">
          <label>
            <input type="checkbox" v-model="showCompanion" />
            <div>
              <strong>Show Mika on Overview</strong>
              <small>
                Display gentle spending prompts, goal milestones, and on-device
                AI advice.
              </small>
            </div>
          </label>
        </div>
      </section>

      <section class="card settings-card">
        <div class="section-heading">
          <h2>
            <span class="settings-heading-icon">⚡</span>
            On-Device AI (WebGPU)
          </h2>
          <span
            class="ai-status-tag"
            :class="{ online: webGpuAvailable }"
          >
            {{ webGpuAvailable ? "● WebGPU Active" : "○ WebGPU Inactive" }}
          </span>
        </div>
        <p class="muted settings-desc">
          Mika can use private in-browser neural models to analyze your budget.
          100% free, runs entirely on your device GPU, with zero token costs and
          zero telemetry.
        </p>
        <div class="ai-settings-form">
          <label>
            <span>On-Device Model</span>
            <select v-model="selectedWebModel">
              <option
                v-for="m in availableWebModels"
                :key="m.id"
                :value="m.id"
              >
                {{ m.name }} — {{ m.sizeDesc }}
              </option>
            </select>
          </label>
          <div v-if="webGpuAvailable" class="formula-note success-note">
            ✓ <strong>Hardware acceleration active!</strong> The model downloads
            once directly into browser cache on your first "Ask Mika" click and
            executes locally via WebGPU.
          </div>
          <div v-else class="formula-note warning">
            ⚠ <strong>Hardware acceleration not active.</strong> Ensure "Use
            graphics acceleration when available" is turned on in browser
            settings (Chrome/Edge/Brave). In the meantime, Mika uses smart
            built-in rule guidance.
          </div>
          <div class="ai-features-list">
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>
                <strong>100% Private:</strong> Financial amounts and transaction
                history never leave your computer
              </span>
            </div>
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>
                <strong>Zero Subscription Costs:</strong> No API keys or token
                fees required
              </span>
            </div>
            <div class="feature-item">
              <span class="check-icon">✓</span>
              <span>
                <strong>Offline Capable:</strong> Once downloaded, models run
                without needing an internet connection
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
