import type { MLCEngineInterface, InitProgressReport } from "@mlc-ai/web-llm";
import {
  type State,
  today,
  totals,
  spent,
  paid,
  isBillPaid,
  dueDate,
  nextDueDate,
} from "./model";
import { type CompanionExpression, companionMessage } from "./companion";

export interface WebLLMModelOption {
  id: string;
  name: string;
  sizeDesc: string;
  recommended?: boolean;
}

export const AVAILABLE_WEB_MODELS: WebLLMModelOption[] = [
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    name: "SmolLM2 360M (Fastest & Smallest · ~140MB)",
    sizeDesc: "Lightweight · Ideal for laptops & mobile",
    recommended: true,
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 0.5B (Balanced · ~300MB)",
    sizeDesc: "Great financial reasoning",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 1B (High Quality · ~600MB)",
    sizeDesc: "Meta Llama 3.2 · Best advice depth",
  },
];

export const DEFAULT_WEB_MODEL = "SmolLM2-360M-Instruct-q4f16_1-MLC";

export interface WebLLMAdvice {
  expression: CompanionExpression;
  title: string;
  text: string;
  action: string;
  destination: "Settings" | "Budgets" | "Pots" | "Add transaction";
  modelUsed: string;
  timestamp: string;
}

let activeEngine: MLCEngineInterface | null = null;
let currentModelId: string | null = null;

/**
 * Check if the browser supports WebGPU and has a compatible GPU adapter.
 */
export async function isWebGPUSupported(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    !("gpu" in navigator) ||
    !(navigator as any).gpu
  ) {
    return false;
  }
  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

function formatCurrency(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents) / 100;
  return `${sign}$${abs.toFixed(2)}`;
}

/**
 * Format financial context for in-browser AI.
 */
export function formatFinancialPrompt(state: State): string {
  const now = today();
  const sum = totals(state, now);
  const currentMonth = now.slice(0, 7);

  const daysToPayday = Math.max(
    1,
    Math.ceil(
      (new Date(state.payday + "T12:00:00").getTime() -
        new Date(now + "T12:00:00").getTime()) /
        86400000,
    ),
  );
  const dailyRate = Math.floor(sum.safe / daysToPayday);

  const budgetsSummary = state.budgets
    .map((b) => {
      const currentSpent = spent(state, b.category, currentMonth);
      const remaining = b.limit - currentSpent;
      const percent = Math.round((currentSpent / (b.limit || 1)) * 100);
      const displayName =
        b.name && b.name !== b.category
          ? `${b.name} (${b.category})`
          : b.name || b.category;
      return `- ${displayName}: spent ${formatCurrency(currentSpent)} of ${formatCurrency(b.limit)} limit (${percent}% used, ${formatCurrency(remaining)} remaining)`;
    })
    .join("\n");

  const potsSummary = state.pots
    .map((p) => {
      const percent =
        p.target > 0 ? Math.round((p.saved / p.target) * 100) : 100;
      return `- ${p.name}: saved ${formatCurrency(p.saved)} towards ${formatCurrency(p.target)} target (${percent}%)`;
    })
    .join("\n");

  const upcomingBills = state.bills
    .filter((b) => !isBillPaid(state, b))
    .map(
      (b) => `- ${b.name}: ${formatCurrency(b.amount)} (due ${nextDueDate(b)})`,
    )
    .join("\n");

  const recentTransactions = [...state.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map(
      (t) =>
        `- ${t.date} ${t.name}: ${formatCurrency(t.amount)} (${t.category})`,
    )
    .join("\n");

  return `Financial Snapshot:
- Balance: ${formatCurrency(sum.balance)}
- Safe to spend: ${formatCurrency(sum.safe)} (${daysToPayday} days until payday on ${state.payday}, ~${formatCurrency(dailyRate)}/day)
- Saved in pots: ${formatCurrency(sum.pots)}
- Remaining budget reserves: ${formatCurrency(sum.budgets)}
- Reserved bills: ${formatCurrency(sum.bills)}

Budgets:
${budgetsSummary || "No category budgets set."}

Pots:
${potsSummary || "No savings pots created."}

Bills:
${upcomingBills || "All monthly bills paid."}

Recent Activity:
${recentTransactions || "No transactions yet."}`;
}

/**
 * Get or initialize WebLLM engine with progress feedback.
 */
export async function getOrInitWebLLMEngine(
  modelId: string = DEFAULT_WEB_MODEL,
  onProgress?: (progress: number, text: string) => void,
): Promise<MLCEngineInterface> {
  if (activeEngine && currentModelId === modelId) {
    return activeEngine;
  }

  if (activeEngine && currentModelId !== modelId) {
    try {
      await activeEngine.unload();
    } catch {}
    activeEngine = null;
    currentModelId = null;
  }

  const progressCallback = (report: InitProgressReport) => {
    if (onProgress) {
      onProgress(Math.min(1, Math.max(0, report.progress)), report.text);
    }
  };

  const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
  const engine = await CreateMLCEngine(modelId, {
    initProgressCallback: progressCallback,
  });

  activeEngine = engine;
  currentModelId = modelId;
  return engine;
}

/**
 * Fetch advice using in-browser WebGPU model.
 */
export async function fetchInBrowserAdvice(
  state: State,
  modelId: string = DEFAULT_WEB_MODEL,
  onProgress?: (progress: number, text: string) => void,
): Promise<WebLLMAdvice> {
  if (!(await isWebGPUSupported())) {
    throw new Error(
      'WebGPU hardware acceleration is disabled or no compatible GPU was found. Enable "Graphics Acceleration" in your browser settings.',
    );
  }

  const engine = await getOrInitWebLLMEngine(modelId, onProgress);
  const financialData = formatFinancialPrompt(state);

  const systemPrompt = `You are Mika, a warm, supportive personal budgeting companion.
Given the financial snapshot, provide encouraging and practical guidance (1-2 sentences).
You MUST output ONLY a valid JSON object without markdown or commentary.

Example output:
{
  "expression": "welcome",
  "title": "Staying on track",
  "text": "Your daily spending is steady and well within your plan. Keep logging daily expenses to stay ahead.",
  "action": "Add transaction",
  "destination": "Add transaction"
}

Allowed expressions: "welcome", "celebrating", "concerned", "focused".
Allowed destinations: "Settings", "Budgets", "Pots", "Add transaction".`;

  const response = await engine.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${financialData}\n\nProvide your JSON advice:` },
    ],
    temperature: 0.5,
    max_tokens: 380,
  });

  const rawContent = response.choices[0]?.message?.content || "";
  return parseAdviceResult(rawContent, modelId, state);
}

function cleanSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  // If already ending with sentence punctuation, return as-is
  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }

  // Find the last complete sentence ending
  const lastPeriod = trimmed.lastIndexOf(".");
  const lastExcl = trimmed.lastIndexOf("!");
  const lastQuest = trimmed.lastIndexOf("?");
  const lastPunctuation = Math.max(lastPeriod, lastExcl, lastQuest);

  if (lastPunctuation > 25) {
    return trimmed.slice(0, lastPunctuation + 1).trim();
  }

  return trimmed + ".";
}

function isPromptEcho(text: string): boolean {
  return /my expression would be|personal budgeting companion|allowed expressions|respond only with|analyze the user/i.test(
    text,
  );
}

function parseAdviceResult(
  raw: string,
  modelId: string,
  state: State,
): WebLLMAdvice {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }

  // Attempt to isolate JSON between braces if surrounded by text
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  const defaultAdvice = companionMessage(state);
  const validExpressions: CompanionExpression[] = [
    "welcome",
    "celebrating",
    "concerned",
    "focused",
  ];
  const validDestinations = [
    "Settings",
    "Budgets",
    "Pots",
    "Add transaction",
  ];

  try {
    const parsed = JSON.parse(cleaned);

    const expression: CompanionExpression = validExpressions.includes(
      parsed.expression,
    )
      ? parsed.expression
      : defaultAdvice.expression;

    const destination = validDestinations.includes(parsed.destination)
      ? parsed.destination
      : defaultAdvice.destination;

    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? cleanSentence(parsed.title.trim()).replace(/[.!?]$/, "")
        : defaultAdvice.title;

    let text =
      typeof parsed.text === "string" && parsed.text.trim()
        ? parsed.text.trim()
        : "";

    if (!text || isPromptEcho(text)) {
      text = defaultAdvice.text;
    } else {
      text = cleanSentence(text);
    }

    const action =
      typeof parsed.action === "string" && parsed.action.trim()
        ? parsed.action.trim()
        : defaultAdvice.action;

    return {
      expression,
      title,
      text,
      action,
      destination: destination as WebLLMAdvice["destination"],
      modelUsed: modelId.split("-")[0] || modelId,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  } catch {
    // If JSON parsing fails, salvage any valid text or fallback to complete companion advice
    let text = "";
    const textMatch = raw.match(/"text"\s*:\s*"([^"]+)/i);
    if (textMatch && textMatch[1] && !isPromptEcho(textMatch[1])) {
      text = cleanSentence(textMatch[1]);
    }

    if (!text || isPromptEcho(text)) {
      text = defaultAdvice.text;
    }

    return {
      expression: defaultAdvice.expression,
      title: defaultAdvice.title,
      text,
      action: defaultAdvice.action,
      destination: defaultAdvice.destination,
      modelUsed: modelId.split("-")[0] || modelId,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }
}
