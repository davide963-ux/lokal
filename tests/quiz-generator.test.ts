import { describe, expect, it } from "vitest";
import { generateQuestions, MAX_GENERATED_QUESTIONS, type GeneratorPools } from "@/lib/quiz/generator";
import { questionInput } from "@/lib/validation/quiz";
import type { DishSnapshot } from "@/lib/services/dish-snapshot";

const dish = (over: Partial<DishSnapshot> = {}): DishSnapshot => ({
  name: "Spaghetti Carbonara", category: "Pasta", imageUrl: null, shortDescription: null, description: null, price: null, isAvailable: true,
  ingredients: [
    { name: "Spaghetti", quantity: "100 g", isOptional: false, isRemovable: false, substitutionNotes: null },
    { name: "Guanciale", quantity: "80 g", isOptional: false, isRemovable: false, substitutionNotes: null },
    { name: "Egg yolk", quantity: null, isOptional: false, isRemovable: false, substitutionNotes: null },
    { name: "Pecorino Romano", quantity: null, isOptional: true, isRemovable: true, substitutionNotes: null },
  ],
  allergens: [{ name: "Eggs", presence: "CONTAINS" }, { name: "Cereals containing gluten", presence: "CONTAINS" }, { name: "Milk", presence: "MAY_CONTAIN" }],
  dietaryTags: ["Halal"], crossContactWarnings: null, allergenNotes: null,
  cookingMethod: "Pan-fried", preparationInstructions: null, prepTimeMinutes: 12, servingTemperature: "Hot", garnishes: "Black pepper",
  presentationDetails: null, waiterDescription: null, recommendedPairings: null, guestInformation: null, managerNotes: null, ...over,
});

const pools = (over: Partial<GeneratorPools> = {}): GeneratorPools => ({
  ingredientNames: ["Spaghetti", "Guanciale", "Egg yolk", "Pecorino Romano", "Tomato", "Basil", "Mozzarella", "Chicken", "Cream", "Salt", "Garlic", "Prawns"],
  allergenNames: ["Celery", "Cereals containing gluten", "Crustaceans", "Eggs", "Fish", "Lupin", "Milk", "Molluscs", "Mustard", "Tree nuts", "Peanuts", "Sesame", "Soybeans"],
  cookingMethods: ["Grilled", "Baked", "Deep-fried", "Poached", "Raw"],
  garnishes: ["Fresh basil", "Parmesan shavings", "Lemon zest", "Parsley"],
  servingTemperatures: ["Warm", "Chilled"],
  categoryNames: ["Pasta", "Desserts", "Salads", "Drinks"],
  ...over,
});

const gen = (d = dish(), p = pools(), seed = "dish-1", max?: number) => generateQuestions(d, p, seed, max);
const correct = (q: ReturnType<typeof gen>[number]) => q.options.find((o) => o.isCorrect)?.text;

describe("quiz generator", () => {
  it("produces a full, valid quiz from a well-documented dish", () => {
    const qs = gen();
    expect(qs.length).toBe(MAX_GENERATED_QUESTIONS);
    for (const q of qs) expect(questionInput.safeParse(q).success, q.questionText).toBe(true);
    const text = qs.map((q) => q.questionText).join("\n");
    expect(text).toMatch(/ingredient of Spaghetti Carbonara/);
    expect(text).toMatch(/allergens does Spaghetti Carbonara contain/);
    expect(text).toMatch(/How is Spaghetti Carbonara cooked/);
    expect(text).toMatch(/how long/i);
  });
  it("every multiple-choice question has exactly one correct answer, distinct options, and an explanation", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      for (const q of gen(dish(), pools(), seed)) {
        expect(q.explanation, q.questionText).toBeTruthy();
        if (q.questionType === "MULTIPLE_CHOICE") {
          expect(q.options.filter((o) => o.isCorrect)).toHaveLength(1);
          expect(q.options).toHaveLength(4);
          expect(new Set(q.options.map((o) => o.text.toLowerCase())).size).toBe(4);
        }
      }
    }
  });
  it("correct answers come straight from the recorded data", () => {
    const d = dish();
    const qs = gen(d);
    const ingQ = qs.find((q) => /Which of these is an ingredient of/.test(q.questionText))!;
    expect(d.ingredients.map((i) => i.name)).toContain(correct(ingQ));
    const allergenQ = qs.find((q) => /Which of these allergens does/.test(q.questionText))!;
    expect(["Eggs", "Cereals containing gluten"]).toContain(correct(allergenQ));
    expect(correct(qs.find((q) => /How is/.test(q.questionText))!)).toBe("Pan-fried");
    expect(correct(qs.find((q) => /how long/i.test(q.questionText))!)).toBe("12 minutes");
  });
  it("never offers one of the dish's own ingredients (or an overlapping name) as a wrong option", () => {
    const p = pools({ ingredientNames: ["Spaghetti", "Egg", "Pecorino", "Guanciale di Amatrice", "Tomato", "Basil", "Mozzarella", "Chicken"] });
    for (const seed of ["1", "2", "3", "4", "5", "6"]) {
      for (const q of gen(dish(), p, seed).filter((q) => /Which of these is an ingredient of|goes into/.test(q.questionText))) {
        const wrong = q.options.filter((o) => !o.isCorrect).map((o) => o.text);
        for (const w of wrong) expect(["Spaghetti", "Egg", "Pecorino", "Guanciale di Amatrice"], w).not.toContain(w);
      }
    }
  });
  it("never uses pantry staples (salt, garlic…) as wrong options, since they are often unlisted", () => {
    for (const seed of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      const opts = gen(dish(), pools(), seed).flatMap((q) => q.options.map((o) => o.text.toLowerCase()));
      expect(opts).not.toContain("salt");
      expect(opts).not.toContain("garlic");
    }
  });
  it("never offers a recorded allergen as a wrong allergen option, and the false statement is about an unlisted allergen", () => {
    const listed = new Set(["eggs", "cereals containing gluten", "milk"]);
    for (const seed of ["1", "2", "3", "4", "5", "6"]) {
      for (const q of gen(dish(), pools(), seed)) {
        if (/allergens does|through cross-contact/.test(q.questionText)) {
          for (const o of q.options.filter((o) => !o.isCorrect)) expect(listed.has(o.text.toLowerCase()), o.text).toBe(false);
        }
        if (q.questionType === "TRUE_FALSE" && q.trueFalseAnswer === false) {
          const stated = q.questionText.replace("Spaghetti Carbonara contains ", "").replace(/\.$/, "");
          expect(listed.has(stated.toLowerCase()), q.questionText).toBe(false);
        }
        if (q.questionType === "TRUE_FALSE" && q.trueFalseAnswer === true) {
          const stated = q.questionText.replace("Spaghetti Carbonara contains ", "").replace(/\.$/, "");
          expect(["eggs", "cereals containing gluten"]).toContain(stated);
        }
      }
    }
  });
  it("a dietary tag's implied tags are never offered as wrong options (a vegan dish is also vegetarian)", () => {
    for (const seed of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
      const q = gen(dish({ dietaryTags: ["Vegan"] }), pools(), seed, 30).find((q) => /dietary label/.test(q.questionText))!;
      const wrong = q.options.filter((o) => !o.isCorrect).map((o) => o.text.toLowerCase());
      expect(wrong).not.toContain("vegetarian");
      expect(wrong).not.toContain("dairy-free");
      expect(wrong).not.toContain("vegan");
    }
  });
  it("is deterministic for the same seed, and varies across seeds", () => {
    expect(gen(dish(), pools(), "same")).toEqual(gen(dish(), pools(), "same"));
    expect(JSON.stringify(gen(dish(), pools(), "x"))).not.toBe(JSON.stringify(gen(dish(), pools(), "y")));
  });
  it("skips question types the data can't support instead of inventing content", () => {
    const sparse = dish({ ingredients: [], allergens: [], dietaryTags: [], cookingMethod: null, prepTimeMinutes: null, servingTemperature: null, garnishes: null });
    expect(gen(sparse, pools())).toHaveLength(1); // only the category question is supportable
    const bare = gen(sparse, pools({ categoryNames: ["Pasta"] }));
    expect(bare).toHaveLength(0);
  });
  it("no allergen questions when the dish records no allergens (no 'contains nothing' claims)", () => {
    const qs = gen(dish({ allergens: [] }));
    expect(qs.some((q) => /allergen|contains/i.test(q.questionText))).toBe(false);
  });
  it("skips ingredient questions when there aren't enough unrelated ingredients for wrong options", () => {
    const qs = gen(dish(), pools({ ingredientNames: ["Spaghetti", "Guanciale", "Tomato"] }));
    expect(qs.some((q) => /Which of these is an ingredient of|goes into/.test(q.questionText))).toBe(false);
  });
  it("respects the maximum and never repeats a question", () => {
    expect(generateQuestions(dish(), pools(), "s", 4)).toHaveLength(4);
    const qs = gen();
    expect(new Set(qs.map((q) => JSON.stringify([q.questionText, q.options]))).size).toBe(qs.length);
  });
  it("prep-time wrong options are plausible numbers different from the right one", () => {
    const q = gen(dish({ prepTimeMinutes: 20 })).find((q) => /how long/i.test(q.questionText))!;
    const nums = q.options.map((o) => parseInt(o.text, 10));
    expect(new Set(nums).size).toBe(4);
    expect(nums.every((n) => n >= 1)).toBe(true);
  });
});
