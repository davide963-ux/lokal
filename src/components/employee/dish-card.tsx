import Link from "next/link";
import { ChefHat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { dishLabel } from "@/lib/training/labels";
import type { DishStatus } from "@/lib/training/status";

export function DishCard({ dish }: {
  dish: { id: string; name: string; imageUrl: string | null; shortDescription: string | null; isAvailable: boolean; category: { name: string }; status: DishStatus };
}) {
  const label = dishLabel(dish.status);
  return (
    <Link href={`/employee/menu/${dish.id}`} className="group flex gap-3 rounded-lg border border-border bg-card p-3 shadow-card transition-all active:scale-[0.99]">
      {dish.imageUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={dish.imageUrl} alt="" loading="lazy" className="size-24 shrink-0 rounded-md object-cover" />
        : <div className="flex size-24 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><ChefHat className="size-8" /></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-xs text-muted-foreground">{dish.category.name}</p>
        <p className="font-display text-lg font-semibold leading-snug group-hover:text-primary">{dish.name}</p>
        {dish.shortDescription && <p className="line-clamp-2 text-sm text-muted-foreground">{dish.shortDescription}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          <Badge variant={label.tone}>{label.text}</Badge>
          {!dish.isAvailable && <Badge>sold out</Badge>}
        </div>
      </div>
    </Link>
  );
}

export function DishList({ dishes }: { dishes: Parameters<typeof DishCard>[0]["dish"][] }) {
  return <ul className="grid gap-3">{dishes.map((d) => <li key={d.id}><DishCard dish={d} /></li>)}</ul>;
}
