<script setup lang="ts">
import { colors, today } from "../../model";
import { money, date } from "../../utils/format";
import { useBudget } from "../../composables/useBudget";
import { useModal } from "../../composables/useModal";

const {
  state,
  search,
  sort,
  category,
  categories,
  list,
} = useBudget();
const { open } = useModal();
</script>

<template>
  <section class="card">
    <div class="filters">
      <label class="search">
        <span class="sr-only">Search transactions</span>
        <input v-model="search" placeholder="Search transactions" />
        <span>⌕</span>
      </label>
      <label>
        Sort by
        <select v-model="sort">
          <option>Latest</option>
          <option>Oldest</option>
          <option>Largest amount</option>
        </select>
      </label>
      <label>
        Category
        <select v-model="category">
          <option>All</option>
          <option v-for="c in categories" :key="c">{{ c }}</option>
        </select>
      </label>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Recipient / Sender</th>
            <th>Category</th>
            <th>Transaction date</th>
            <th class="align-right">Amount</th>
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in list" :key="t.id">
            <td>
              <div class="person">
                <span
                  class="avatar"
                  :style="{
                    background:
                      colors[
                        categories.indexOf(t.category) % colors.length
                      ],
                  }"
                >
                  {{ t.name.slice(0, 1).toUpperCase() }}
                </span>
                <strong>{{ t.name }}</strong>
              </div>
            </td>
            <td>{{ t.category }}</td>
            <td>
              {{ date(t.date) }}
              <span v-if="t.date > today()" class="badge" style="margin-left: 0.375rem;">Upcoming</span>
            </td>
            <td
              class="align-right amount"
              :class="{ positive: t.amount > 0 }"
            >
              {{ t.amount > 0 ? "+" : "" }}{{ money(t.amount) }}
            </td>
            <td>
              <button
                class="delete-icon"
                @click="open('Delete transaction', t.id)"
                :aria-label="'Delete ' + t.name"
              >
                ×
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="empty" v-if="!list.length">
      <h3>No transactions here yet.</h3>
      <p>
        {{
          state.transactions.length
            ? "Try a different search or category."
            : "Your next small step: record one expense."
        }}
      </p>
    </div>

    <div class="table-footer">
      {{ list.length }} transaction{{ list.length === 1 ? "" : "s" }}
    </div>
  </section>
</template>
