import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ChefHat, Clock, Flame, MessageSquareQuote, ShieldAlert, Thermometer, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireEmployeePage } from "@/lib/authz";
import { getDishForEmployee } from "@/lib/services/training";
import { StudyPanel } from "./study-panel";

export const metadata = { title: "Dish" };

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Utensils; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-xl"><Icon className="size-5 text-primary" />{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-[15px] leading-relaxed">{children}</CardContent>
    </Card>
  );
}
const Text = ({ children }: { children: string }) => <p className="whitespace-pre-line">{children}</p>;
const Fact = ({ label, value }: { label: string; value: string | null }) => value ? <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div> : null;

export default async function DishTrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireEmployeePage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getDishForEmployee(user.id, id);
  if (!data) notFound();
  const { snapshot: s, status, dish, quiz } = data;

  const contains = s.allergens.filter((a) => a.presence === "CONTAINS");
  const may = s.allergens.filter((a) => a.presence === "MAY_CONTAIN");
  const mains = s.ingredients.filter((i) => !i.isOptional);
  const optional = s.ingredients.filter((i) => i.isOptional);
  const hasPrep = s.cookingMethod || s.preparationInstructions || s.prepTimeMinutes != null || s.servingTemperature || s.garnishes || s.presentationDetails;
  const hasService = s.waiterDescription || s.recommendedPairings || s.guestInformation;

  return (
    <div className="space-y-4 pb-4">
      <Link href="/employee/menu" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Menu</Link>

      {status.studyState === "NEEDS_REVIEW" && (
        <div role="status" className="rounded-lg border border-warning/40 bg-warning-soft p-4 text-warning">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-5" />This dish has been updated. Please review the new information.</p>
          {data.changeSummary && <p className="mt-1 text-sm">What changed: {data.changeSummary}</p>}
          <p className="mt-1 text-sm">You&apos;ll need to confirm you&apos;ve studied it and pass the quiz again.</p>
        </div>
      )}
      {status.studyState === "STUDIED" && status.updatedSinceStudied && (
        <div role="status" className="rounded-lg bg-primary-soft p-3 text-sm text-primary">This dish was updated after you studied it{data.changeSummary ? `: ${data.changeSummary}` : "."} Take a look at what&apos;s new.</div>
      )}

      {/* Hero */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        {s.imageUrl
          ? <Image src={s.imageUrl} alt={s.name} width={900} height={675} priority sizes="(min-width: 768px) 768px, 100vw" className="aspect-[4/3] w-full object-cover" />
          : <div className="flex aspect-[16/9] w-full items-center justify-center bg-muted text-muted-foreground"><ChefHat className="size-14" /></div>}
        <div className="p-5">
          <p className="text-sm text-muted-foreground">{s.category}</p>
          <h1 className="text-3xl font-semibold leading-tight">{s.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.dietaryTags.map((t) => <Badge key={t} variant="primary">{t}</Badge>)}
            {!dish.isAvailable && <Badge>sold out today</Badge>}
            {s.price && <Badge>{s.price}</Badge>}
          </div>
          {s.shortDescription && <p className="mt-3 text-lg text-foreground/80">{s.shortDescription}</p>}
          {s.description && <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground/80">{s.description}</p>}
        </div>
      </div>

      {/* Allergens: always prominent, always shown */}
      <section aria-labelledby="allergens-h" className="rounded-lg border-2 border-destructive/40 bg-destructive-soft/50 p-5">
        <h2 id="allergens-h" className="flex items-center gap-2 text-xl font-semibold text-destructive"><ShieldAlert className="size-6" />Allergens</h2>
        {contains.length === 0 && may.length === 0 ? (
          <p className="mt-2">No allergens have been listed for this dish. If a guest asks and you&apos;re unsure, check with your manager.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {contains.length > 0 && <div><p className="mb-1.5 text-sm font-semibold">Contains</p><div className="flex flex-wrap gap-2">{contains.map((a) => <span key={a.name} className="rounded-full bg-destructive px-3.5 py-1.5 text-sm font-semibold text-white">{a.name}</span>)}</div></div>}
            {may.length > 0 && <div><p className="mb-1.5 text-sm font-semibold">May contain (cross-contact)</p><div className="flex flex-wrap gap-2">{may.map((a) => <span key={a.name} className="rounded-full border border-warning bg-warning-soft px-3.5 py-1.5 text-sm font-semibold text-warning">{a.name}</span>)}</div></div>}
          </div>
        )}
        {s.crossContactWarnings && <p className="mt-3 text-sm"><strong>Cross-contact:</strong> {s.crossContactWarnings}</p>}
        {s.allergenNotes && <p className="mt-2 text-sm"><strong>Manager note:</strong> {s.allergenNotes}</p>}
      </section>

      <Section title="Ingredients" icon={Utensils}>
        {s.ingredients.length === 0 ? <p className="text-muted-foreground">No ingredients listed.</p> : (
          <>
            <ul className="space-y-2">
              {mains.map((i) => (
                <li key={i.name} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{i.name}</span>{i.quantity && <span className="text-muted-foreground">· {i.quantity}</span>}
                  {i.isRemovable && <Badge variant="warning">can be removed</Badge>}
                  {i.substitutionNotes && <span className="w-full text-sm text-muted-foreground">Substitute: {i.substitutionNotes}</span>}
                </li>
              ))}
            </ul>
            {optional.length > 0 && (
              <div><p className="mb-1.5 mt-2 text-sm font-semibold text-muted-foreground">Optional</p>
                <ul className="space-y-2">{optional.map((i) => (
                  <li key={i.name} className="flex flex-wrap items-baseline gap-x-2"><span className="font-medium">{i.name}</span>{i.quantity && <span className="text-muted-foreground">· {i.quantity}</span>}{i.isRemovable && <Badge variant="warning">can be removed</Badge>}{i.substitutionNotes && <span className="w-full text-sm text-muted-foreground">Substitute: {i.substitutionNotes}</span>}</li>
                ))}</ul></div>
            )}
          </>
        )}
      </Section>

      {hasPrep && (
        <Section title="Preparation & serving" icon={Flame}>
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Cooking method" value={s.cookingMethod} />
            <Fact label="Prep time" value={s.prepTimeMinutes != null ? `${s.prepTimeMinutes} min` : null} />
            <Fact label="Serving temperature" value={s.servingTemperature} />
          </dl>
          {s.preparationInstructions && <Text>{s.preparationInstructions}</Text>}
          {s.garnishes && <p><strong>Garnish:</strong> {s.garnishes}</p>}
          {s.presentationDetails && <p><strong>Presentation:</strong> {s.presentationDetails}</p>}
        </Section>
      )}

      {hasService && (
        <Section title="At the table" icon={MessageSquareQuote}>
          {s.waiterDescription && <div><p className="text-sm font-semibold text-muted-foreground">How to describe it</p><p className="whitespace-pre-line rounded-md bg-primary-soft/60 p-3 italic">&ldquo;{s.waiterDescription}&rdquo;</p></div>}
          {s.recommendedPairings && <div><p className="text-sm font-semibold text-muted-foreground">Goes well with</p><Text>{s.recommendedPairings}</Text></div>}
          {s.guestInformation && <div><p className="text-sm font-semibold text-muted-foreground">Tell guests</p><Text>{s.guestInformation}</Text></div>}
        </Section>
      )}

      {s.managerNotes && <Section title="Manager notes" icon={Thermometer}><Text>{s.managerNotes}</Text></Section>}

      <StudyPanel
        dishId={dish.id} studyState={status.studyState} quizState={status.quizState} canStartQuiz={status.canStartQuiz}
        studiedAt={data.lastStudiedAt?.toISOString() ?? null} lastScore={status.lastScore} attempts={status.attemptsCount}
        quiz={quiz ? { passingScore: quiz.passingScore, allowRetries: quiz.allowRetries } : null}
      />
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" />Version {data.version}</p>
    </div>
  );
}
