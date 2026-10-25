import Image from "next/image";
import { UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ name, logoUrl, className, size = 36 }: { name: string; logoUrl?: string | null; className?: string; size?: number }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {logoUrl ? (
        <Image src={logoUrl} alt="" width={size} height={size} className="rounded-md object-cover" style={{ width: size, height: size }} />
      ) : (
        <div className="flex items-center justify-center rounded-md bg-primary text-primary-foreground" style={{ width: size, height: size }}>
          <UtensilsCrossed className="size-1/2" />
        </div>
      )}
      <span className="font-display text-lg font-semibold leading-tight tracking-tight">{name}</span>
    </div>
  );
}
