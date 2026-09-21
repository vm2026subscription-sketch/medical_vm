import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BrandLogo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-grid shrink-0 leading-none" aria-label={BRAND.fullName}>
      <span
        className={cn(
          "font-display text-[22px] font-extrabold tracking-tight",
          light ? "text-white" : "text-[#25355b]",
        )}
      >
        {BRAND.name}
      </span>
      <span
        className={cn(
          "flex items-center gap-1 whitespace-nowrap text-[10px] font-medium",
          light ? "text-white/80" : "text-[#58627b]",
        )}
      >
        by
        <img
          src="/brand/vidyarthi-mitra.png"
          alt={BRAND.company}
          width="111"
          height="28"
          className="h-7 w-[111px] rounded-sm bg-white object-contain"
        />
      </span>
    </span>
  );
}
