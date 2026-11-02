import type { DishSnapshot } from "@/lib/services/dish-snapshot";
import { questionInput } from "@/lib/validation/quiz";

/**
 * Rule-based quiz generation from a dish's recorded, manager-verified data. No AI model is involved:
 * every correct answer is copied from a field the manager entered, so a generated question can be
 * wrong only if the dish data is wrong. Safety-critical facts (allergens) are never inferred.
 *
 * Distractors (the wrong options) come from the restaurant's other data: other dishes' ingredients,
 * the allergen vocabulary, other dishes' cooking methods, and so on.
 *
 * Deterministic: the same dish + pools + seed always yield the same questions, so re-running the
 * generator on unchanged content produces no change (and therefore no new quiz revision).
 */

export type GeneratorPools = {
  /** Ingredient library (names). Anything the dish itself uses is filtered out of distractors. */
  ingredientNames: string[];
  /** The allergen vocabulary managers pick from. */
  allergenNames: string[];
  /** Values used by the restaurant's OTHER dishes, for plausible wrong answers. */
  cookingMethods: string[];
  garnishes: string[];
  servingTemperatures: string[];
  categoryNames: string[];
};

/** Same shape as a manager-written question, with the fields the generator always fills in. */
export type GeneratedQuestion = {
  questionText: string;
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  explanation: string;
  options: { text: string; isCorrect: boolean }[];
  trueFalseAnswer?: boolean;
};

export const MIN_GENERATED_QUESTIONS = 3;
export const MAX_GENERATED_QUESTIONS = 8;

const DIETARY_PRESETS = ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Halal", "Kosher", "Spicy"];
const SERVING_TEMPS = ["Hot", "Warm", "Room temperature", "Chilled", "Frozen"];

// Pantry staples are used in nearly everything and often go unlisted, so "X is NOT in this dish" would be
// an unsafe assertion. They are never used as wrong options.
const PANTRY = new Set(["salt", "pepper", "black pepper", "water", "oil", "olive oil", "sugar", "butter", "flour", "garlic", "onion", "sea salt"]);

// A dish with the left tag always also satisfies the right tags, so those can't be "wrong" options.
const IMPLIES: Record<string, string[]> = { vegan: ["vegetarian", "dairy-free"], "gluten-free": [], vegetarian: [] };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// ───────── seeded randomness ─────────
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function rngFrom(seed: string) {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
function shuffled<T>(items: readonly T[], rand: Rand): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
const pick = <T,>(items: readonly T[], n: number, rand: Rand) => shuffled(items, rand).slice(0, n);

function distinctBy<T>(items: readonly T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((t) => (seen.has(key(t)) ? false : (seen.add(key(t)), true)));
}

/** One correct option + wrong ones, in a seeded random order. */
function mc(text: string, correct: string, wrong: string[], explanation: string, rand: Rand): GeneratedQuestion {
  const options = shuffled([{ text: correct, isCorrect: true }, ...wrong.map((w) => ({ text: w, isCorrect: false }))], rand);
  return { questionText: text, questionType: "MULTIPLE_CHOICE", explanation, options };
}
const tf = (statement: string, answer: boolean, explanation: string): GeneratedQuestion => ({
  questionText: statement, questionType: "TRUE_FALSE", explanation, options: [], trueFalseAnswer: answer,
});

const list = (xs: string[], max = 8) => (xs.length <= max ? xs.join(", ") : `${xs.slice(0, max).join(", ")} and more`);

export function generateQuestions(dish: DishSnapshot, pools: GeneratorPools, seed: string, max = MAX_GENERATED_QUESTIONS): GeneratedQuestion[] {
  const rand = rngFrom(seed);
  const name = dish.name;
  const out: GeneratedQuestion[] = [];

  // ── ingredient facts ──
  const ingNames = dish.ingredients.map((i) => i.name);
  const ingNorms = ingNames.map(norm);
  const overlapsDish = (candidate: string) => {
    const c = norm(candidate);
    return ingNorms.some((n) => n === c || n.includes(c) || c.includes(n));
  };
  const ingredientDistractors = distinctBy(
    pools.ingredientNames.filter((n) => !overlapsDish(n) && !PANTRY.has(norm(n))),
    (n) => norm(n),
  );
  const mains = dish.ingredients.filter((i) => !i.isOptional);
  const optional = dish.ingredients.filter((i) => i.isOptional);
  const ingredientExplanation = `The recipe for ${name} lists: ${list(ingNames)}.`;
  const ingredientQs = (): GeneratedQuestion[] => {
    if (ingredientDistractors.length < 3) return [];
    const subjects = pick(mains.length ? mains : dish.ingredients, 2, rand);
    return subjects.map((s, i) => mc(i === 0 ? `Which of these is an ingredient of ${name}?` : `Which of the following goes into ${name}?`, s.name, pick(ingredientDistractors, 3, rand), ingredientExplanation, rand));
  };

  // ── allergen facts (from the verified record; absence claims rely on that record being complete) ──
  const contains = dish.allergens.filter((a) => a.presence === "CONTAINS").map((a) => a.name);
  const may = dish.allergens.filter((a) => a.presence === "MAY_CONTAIN").map((a) => a.name);
  const listed = new Set(dish.allergens.map((a) => norm(a.name)));
  const unlisted = pools.allergenNames.filter((n) => !listed.has(norm(n)));
  const allergenNote = "Always check with the kitchen or your manager if a guest has an allergy.";
  const allergenQs = {
    contains: (): GeneratedQuestion[] =>
      contains.length && unlisted.length >= 3
        ? [mc(`Which of these allergens does ${name} contain?`, pick(contains, 1, rand)[0]!, pick(unlisted, 3, rand), `${name} is recorded as containing: ${list(contains)}. ${allergenNote}`, rand)]
        : [],
    may: (): GeneratedQuestion[] =>
      may.length && unlisted.length >= 3
        ? [mc(`Which allergen may be present in ${name} through cross-contact?`, pick(may, 1, rand)[0]!, pick(unlisted, 3, rand), `${name} is recorded as possibly containing: ${list(may)}. ${allergenNote}`, rand)]
        : [],
    tfTrue: (): GeneratedQuestion[] =>
      contains.length ? [tf(`${name} contains ${pick(contains, 1, rand)[0]!.toLowerCase()}.`, true, `${name} is recorded as containing: ${list(contains)}.`)] : [],
    tfFalse: (): GeneratedQuestion[] => {
      if (!contains.length || !unlisted.length) return [];
      const x = pick(unlisted, 1, rand)[0]!;
      return [tf(`${name} contains ${x.toLowerCase()}.`, false, `${x} is not recorded as an allergen in ${name}. ${allergenNote}`)];
    },
  };

  // ── dietary labels ──
  const tags = dish.dietaryTags;
  const appliedNorm = new Set(tags.map(norm));
  for (const t of tags) for (const implied of IMPLIES[norm(t)] ?? []) appliedNorm.add(implied);
  const dietaryDistractors = DIETARY_PRESETS.filter((p) => !appliedNorm.has(norm(p)));
  const dietaryQs = (): GeneratedQuestion[] =>
    tags.length && dietaryDistractors.length >= 3
      ? [mc(`Which dietary label applies to ${name}?`, pick(tags, 1, rand)[0]!, pick(dietaryDistractors, 3, rand), `${name} is labelled: ${list(tags)}.`, rand)]
      : [];

  // ── preparation facts ──
  const others = (arr: string[], own: string | null) => distinctBy(arr.filter((v) => v.trim() && norm(v) !== norm(own ?? "")), norm);
  const textMc = (question: string, correct: string | null, pool: string[], extra: string[] = []): GeneratedQuestion[] => {
    if (!correct?.trim()) return [];
    const wrong = others([...pool, ...extra], correct);
    return wrong.length >= 3 ? [mc(question, correct.trim(), pick(wrong, 3, rand), `For ${name}: ${correct.trim()}.`, rand)] : [];
  };
  const cookingQs = () => textMc(`How is ${name} cooked?`, dish.cookingMethod, pools.cookingMethods);
  const servingQs = () => textMc(`At what temperature is ${name} served?`, dish.servingTemperature, pools.servingTemperatures, SERVING_TEMPS);
  const garnishQs = () => textMc(`What is the garnish for ${name}?`, dish.garnishes, pools.garnishes);
  const categoryQs = () => textMc(`Which menu category is ${name} in?`, dish.category, pools.categoryNames);
  const prepTimeQs = (): GeneratedQuestion[] => {
    const n = dish.prepTimeMinutes;
    if (!n || n < 2) return [];
    const wrong = distinctBy([Math.round(n / 2), Math.round(n * 1.5), n * 2, n + 10, Math.max(1, n - 5)].filter((x) => x >= 1 && x !== n), String);
    if (wrong.length < 3) return [];
    return [mc(`Approximately how long does ${name} take to prepare?`, `${n} minutes`, pick(wrong, 3, rand).map((x) => `${x} minutes`), `${name} takes about ${n} minutes to prepare.`, rand)];
  };
  const optionalQs = (): GeneratedQuestion[] =>
    optional.length && mains.length >= 3
      ? [mc(`Which ingredient of ${name} is optional?`, pick(optional, 1, rand)[0]!.name, pick(mains, 3, rand).map((m) => m.name), `In ${name}, optional: ${list(optional.map((o) => o.name))}.`, rand)]
      : [];

  // Priority order: the facts that matter most on the floor first; capped at `max`.
  const ing = ingredientQs();
  const queue: GeneratedQuestion[][] = [
    ing.slice(0, 1), allergenQs.contains(), allergenQs.tfTrue(), cookingQs(), prepTimeQs(), servingQs(), ing.slice(1),
    allergenQs.tfFalse(), allergenQs.may(), optionalQs(), garnishQs(), dietaryQs(), categoryQs(),
  ];
  for (const group of queue) {
    for (const q of group) {
      if (out.length >= max) break;
      // Never trust our own output: it must pass the same validation as a manager-written question.
      if (questionInput.safeParse(q).success && !out.some((o) => norm(o.questionText) === norm(q.questionText) && o.questionType === q.questionType && JSON.stringify(o.options) === JSON.stringify(q.options))) out.push(q);
    }
  }
  return out;
}
