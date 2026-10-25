"use client";

import { AlertTriangle, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormMessage } from "@/components/ui/form-message";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { ImageUpload } from "@/components/forms/image-upload";
import { useAction } from "@/components/use-action";
import { cn } from "@/lib/utils";
import { saveDishAction } from "./actions";
import { newKey, type DishFormState } from "./dish-form-state";

const DIETARY_PRESETS = ["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Halal", "Kosher", "Spicy"];

export function DishForm({
  dishId, status, initial, categories, allergens, ingredientLibrary, verifiedAt, isPublished,
}: {
  dishId: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;
  initial: DishFormState;
  categories: { id: string; name: string }[];
  allergens: { id: string; name: string }[];
  ingredientLibrary: string[];
  verifiedAt: string | null;
  isPublished: boolean;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [s, setS] = useState<DishFormState>(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const [tagDraft, setTagDraft] = useState("");
  const readOnly = status === "ARCHIVED";
  const set = <K extends keyof DishFormState>(k: K, v: DishFormState[K]) => setS((p) => ({ ...p, [k]: v }));
  const err = (k: string) => errors[k]?.[0];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(undefined);
    const price = s.price.trim() === "" ? null : Number(s.price);
    const prep = s.prepTimeMinutes.trim() === "" ? null : Number(s.prepTimeMinutes);
    if ((price !== null && Number.isNaN(price)) || (prep !== null && !Number.isInteger(prep))) {
      return void setFormError("Price and preparation time must be numbers.");
    }
    run(
      () => saveDishAction(dishId, {
        ...s,
        price,
        prepTimeMinutes: prep,
        ingredients: s.ingredients.filter((i) => i.name.trim()).map((i) => ({ name: i.name, quantity: i.quantity, isOptional: i.isOptional, isRemovable: i.isRemovable, substitutionNotes: i.substitutionNotes })),
        allergens: Object.entries(s.allergens).map(([allergenId, presence]) => ({ allergenId, presence })),
      }),
      {
        onSuccess: (r) => {
          if (!dishId && r.data) router.push(`/admin/menu/${r.data.id}`);
        },
        onError: (r) => { setErrors(r.fieldErrors ?? {}); if (!r.fieldErrors) setFormError(r.error); },
      },
    );
  }

  const cycleAllergen = (id: string) =>
    setS((p) => {
      const next = { ...p.allergens };
      const cur = next[id];
      if (!cur) next[id] = "CONTAINS";
      else if (cur === "CONTAINS") next[id] = "MAY_CONTAIN";
      else delete next[id];
      return { ...p, allergens: next };
    });

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (t && !s.dietaryTags.some((x) => x.toLowerCase() === t.toLowerCase()) && s.dietaryTags.length < 20) set("dietaryTags", [...s.dietaryTags, t]);
    setTagDraft("");
  };

  return (
    <form onSubmit={submit} className="grid gap-6 pb-28" aria-label="Dish form">
      <fieldset disabled={readOnly || pending} className="contents">
        {readOnly && <FormMessage type="error">This dish is archived and read-only. Restore it to make changes.</FormMessage>}

        {/* ───── Basics ───── */}
        <Card>
          <CardHeader><CardTitle>Basics</CardTitle><CardDescription>Only the name and category are required.</CardDescription></CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[minmax(0,18rem)_1fr]">
            <Field label="Photo"><ImageUpload folder="dishes" value={s.imageUrl} onChange={(u) => set("imageUrl", u)} /></Field>
            <div className="grid gap-4">
              <Field label="Dish name" htmlFor="name" required error={err("name")}>
                <Input id="name" value={s.name} onChange={(e) => set("name", e.target.value)} maxLength={120} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category" htmlFor="category" required error={err("categoryId")} hint={undefined}>
                  <Select id="category" value={s.categoryId} onChange={(e) => set("categoryId", e.target.value)} required>
                    <option value="" disabled>Choose…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label="Price" htmlFor="price" error={err("price")}>
                  <Input id="price" inputMode="decimal" value={s.price} onChange={(e) => set("price", e.target.value)} placeholder="Optional" />
                </Field>
              </div>
              <Field label="Short description" htmlFor="short" error={err("shortDescription")} hint="One line shown on menu cards.">
                <Input id="short" value={s.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} maxLength={200} />
              </Field>
              <Checkbox label="Currently available" hint="Untick when the dish is sold out. It stays on the training menu." checked={s.isAvailable} onChange={(e) => set("isAvailable", e.target.checked)} />
            </div>
            <Field label="Detailed description" htmlFor="desc" className="md:col-span-2" error={err("description")}>
              <Textarea id="desc" value={s.description} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={4000} />
            </Field>
          </CardContent>
        </Card>

        {/* ───── Ingredients ───── */}
        <Card>
          <CardHeader><CardTitle>Ingredients</CardTitle><CardDescription>Start typing to reuse an ingredient from your library, or type a new one.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            <datalist id="ingredient-library">{ingredientLibrary.map((n) => <option key={n} value={n} />)}</datalist>
            {s.ingredients.length === 0 && <p className="text-sm text-muted-foreground">No ingredients added yet.</p>}
            {s.ingredients.map((ing, idx) => (
              <div key={ing.key} className="grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-[1fr_9rem_auto]">
                <Input list="ingredient-library" placeholder="Ingredient" aria-label={`Ingredient ${idx + 1} name`} value={ing.name} maxLength={80}
                  onChange={(e) => set("ingredients", s.ingredients.map((x) => x.key === ing.key ? { ...x, name: e.target.value } : x))} />
                <Input placeholder="Quantity" aria-label={`Ingredient ${idx + 1} quantity`} value={ing.quantity} maxLength={60}
                  onChange={(e) => set("ingredients", s.ingredients.map((x) => x.key === ing.key ? { ...x, quantity: e.target.value } : x))} />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove ingredient ${idx + 1}`} onClick={() => set("ingredients", s.ingredients.filter((x) => x.key !== ing.key))}><Trash2 /></Button>
                <div className="flex flex-wrap gap-x-5 sm:col-span-3">
                  <Checkbox label="Optional" checked={ing.isOptional} onChange={(e) => set("ingredients", s.ingredients.map((x) => x.key === ing.key ? { ...x, isOptional: e.target.checked } : x))} />
                  <Checkbox label="Can be removed on request" checked={ing.isRemovable} onChange={(e) => set("ingredients", s.ingredients.map((x) => x.key === ing.key ? { ...x, isRemovable: e.target.checked } : x))} />
                </div>
                <Input className="sm:col-span-3" placeholder="Possible substitutions (optional)" aria-label={`Ingredient ${idx + 1} substitutions`} value={ing.substitutionNotes} maxLength={300}
                  onChange={(e) => set("ingredients", s.ingredients.map((x) => x.key === ing.key ? { ...x, substitutionNotes: e.target.value } : x))} />
              </div>
            ))}
            {err("ingredients") && <p role="alert" className="text-xs font-medium text-destructive">{err("ingredients")}</p>}
            <div><Button type="button" variant="secondary" onClick={() => set("ingredients", [...s.ingredients, { key: newKey(), name: "", quantity: "", isOptional: false, isRemovable: false, substitutionNotes: "" }])}><Plus />Add ingredient</Button></div>
          </CardContent>
        </Card>

        {/* ───── Allergens ───── */}
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-warning" />Allergens &amp; dietary information</CardTitle>
            <CardDescription>Safety-critical. Nothing here is generated or assumed by the app. You enter it and you verify it.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div>
              <p className="mb-2 text-sm font-medium">Allergens <span className="font-normal text-muted-foreground">· tap to cycle: none → contains → may contain</span></p>
              <div className="flex flex-wrap gap-2">
                {allergens.map((a) => {
                  const st = s.allergens[a.id];
                  return (
                    <button key={a.id} type="button" onClick={() => cycleAllergen(a.id)} aria-pressed={!!st}
                      className={cn("rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                        !st && "border-input bg-card text-muted-foreground hover:bg-muted",
                        st === "CONTAINS" && "border-destructive bg-destructive-soft text-destructive",
                        st === "MAY_CONTAIN" && "border-warning bg-warning-soft text-warning")}>
                      {a.name}{st === "CONTAINS" && " · contains"}{st === "MAY_CONTAIN" && " · may contain"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Dietary information</p>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...DIETARY_PRESETS, ...s.dietaryTags])].map((t) => {
                  const on = s.dietaryTags.some((x) => x.toLowerCase() === t.toLowerCase());
                  return (
                    <button key={t} type="button" aria-pressed={on}
                      onClick={() => set("dietaryTags", on ? s.dietaryTags.filter((x) => x.toLowerCase() !== t.toLowerCase()) : [...s.dietaryTags, t])}
                      className={cn("flex items-center gap-1 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors", on ? "border-primary bg-primary-soft text-primary" : "border-input bg-card text-muted-foreground hover:bg-muted")}>
                      {t}{on && !DIETARY_PRESETS.includes(t) && <X className="size-3.5" />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex max-w-xs gap-2">
                <Input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="Custom tag" aria-label="Custom dietary tag" maxLength={40}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagDraft); } }} />
                <Button type="button" variant="secondary" onClick={() => addTag(tagDraft)}>Add</Button>
              </div>
            </div>
            <Field label="Cross-contact warnings" htmlFor="xc" error={err("crossContactWarnings")} hint="e.g. “Prepared on a surface that also handles nuts.”">
              <Textarea id="xc" value={s.crossContactWarnings} onChange={(e) => set("crossContactWarnings", e.target.value)} rows={2} maxLength={1000} />
            </Field>
            <Field label="Manager-approved allergen notes" htmlFor="an" error={err("allergenNotes")}>
              <Textarea id="an" value={s.allergenNotes} onChange={(e) => set("allergenNotes", e.target.value)} rows={2} maxLength={1000} />
            </Field>
            <div className={cn("rounded-md border p-3", s.allergensVerified ? "border-success/50 bg-success-soft" : "border-warning/50 bg-warning-soft")}>
              <Checkbox
                label={<span className="flex items-center gap-2"><ShieldCheck className="size-4" />I have verified the allergen and dietary information for this dish</span>}
                hint={verifiedAt ? `Last verified ${new Date(verifiedAt).toLocaleString()}. Changing ingredients or allergens requires re-verification.` : "Required before this dish can be published."}
                checked={s.allergensVerified} onChange={(e) => set("allergensVerified", e.target.checked)} />
            </div>
          </CardContent>
        </Card>

        {/* ───── Preparation ───── */}
        <Card>
          <CardHeader><CardTitle>Preparation</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Cooking method" htmlFor="cm" error={err("cookingMethod")}><Input id="cm" value={s.cookingMethod} onChange={(e) => set("cookingMethod", e.target.value)} maxLength={200} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Prep time (min)" htmlFor="pt" error={err("prepTimeMinutes")}><Input id="pt" inputMode="numeric" value={s.prepTimeMinutes} onChange={(e) => set("prepTimeMinutes", e.target.value)} /></Field>
              <Field label="Serving temp." htmlFor="st" error={err("servingTemperature")}><Input id="st" value={s.servingTemperature} onChange={(e) => set("servingTemperature", e.target.value)} placeholder="e.g. Hot" maxLength={100} /></Field>
            </div>
            <Field label="Preparation instructions" htmlFor="pi" className="sm:col-span-2" error={err("preparationInstructions")}><Textarea id="pi" value={s.preparationInstructions} onChange={(e) => set("preparationInstructions", e.target.value)} rows={5} maxLength={5000} /></Field>
            <Field label="Garnishes" htmlFor="g" error={err("garnishes")}><Textarea id="g" value={s.garnishes} onChange={(e) => set("garnishes", e.target.value)} rows={2} maxLength={500} /></Field>
            <Field label="Presentation details" htmlFor="pd" error={err("presentationDetails")}><Textarea id="pd" value={s.presentationDetails} onChange={(e) => set("presentationDetails", e.target.value)} rows={2} maxLength={1000} /></Field>
          </CardContent>
        </Card>

        {/* ───── Customer service ───── */}
        <Card>
          <CardHeader><CardTitle>Customer service</CardTitle><CardDescription>What the waiter should say and know at the table.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <Field label="How to describe this dish to guests" htmlFor="wd" error={err("waiterDescription")}><Textarea id="wd" value={s.waiterDescription} onChange={(e) => set("waiterDescription", e.target.value)} rows={3} maxLength={2000} /></Field>
            <Field label="Recommended accompaniments" htmlFor="rp" error={err("recommendedPairings")}><Textarea id="rp" value={s.recommendedPairings} onChange={(e) => set("recommendedPairings", e.target.value)} rows={2} maxLength={1000} /></Field>
            <Field label="Important to mention to guests" htmlFor="gi" error={err("guestInformation")}><Textarea id="gi" value={s.guestInformation} onChange={(e) => set("guestInformation", e.target.value)} rows={2} maxLength={2000} /></Field>
            <Field label="Additional manager notes" htmlFor="mn" error={err("managerNotes")}><Textarea id="mn" value={s.managerNotes} onChange={(e) => set("managerNotes", e.target.value)} rows={2} maxLength={2000} /></Field>
          </CardContent>
        </Card>

        {/* ───── Revision controls ───── */}
        {isPublished && (
          <Card className="border-primary/30">
            <CardHeader><CardTitle>Publishing this update</CardTitle><CardDescription>This dish is live. Saving content changes creates a new version employees can see.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <Field label="What changed?" htmlFor="cs" hint="Optional. A summary is generated automatically if left blank."><Input id="cs" value={s.changeSummary} onChange={(e) => set("changeSummary", e.target.value)} maxLength={300} /></Field>
              <Checkbox label="Require retraining for this update" hint="Employees who already studied this dish must review the new information and retake the quiz." checked={s.requiresRetraining} onChange={(e) => set("requiresRetraining", e.target.checked)} />
            </CardContent>
          </Card>
        )}
      </fieldset>

      {formError && <FormMessage type="error">{formError}</FormMessage>}
      {Object.keys(errors).length > 0 && !formError && <FormMessage type="error">Please fix the highlighted fields.</FormMessage>}

      {/* Sticky save bar (sits above the mobile safe area) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 sm:px-2 lg:px-4">
          <div className="hidden text-sm text-muted-foreground sm:block">
            {status && <Badge variant={status === "PUBLISHED" ? "success" : status === "ARCHIVED" ? "neutral" : "warning"}>{status.toLowerCase()}</Badge>}
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button asChild variant="secondary" className="flex-1 sm:flex-none"><Link href="/admin/menu">Back</Link></Button>
            {!readOnly && <Button type="submit" className="flex-1 sm:flex-none" loading={pending}>{dishId ? "Save changes" : "Create dish"}</Button>}
          </div>
        </div>
      </div>
    </form>
  );
}
