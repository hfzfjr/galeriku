import Image from "next/image";
import { Play } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  LANDING_PHOTOS,
  type LandingPhotoSlot,
} from "./landing-photos";

const SLOT_LAYOUT: Record<string, { frame: string; rotation: string }> = {
  bromo: {
    frame: "left-0 top-0 w-[66%]",
    rotation: "motion-safe:rotate-[-2deg]",
  },
  walakiri: {
    frame: "left-[56%] top-[13%] w-[44%]",
    rotation: "motion-safe:rotate-[2deg]",
  },
  jatiluwih: {
    frame: "left-[6%] top-[44%] w-[48%]",
    rotation: "motion-safe:rotate-[-1deg]",
  },
  "pasar-malam": {
    frame: "left-[48%] top-[64%] w-[52%]",
    rotation: "motion-safe:rotate-[1.5deg]",
  },
};

/**
 * Kartu foto gaya cetak: bingkai surface, shadow-float, sudut foto
 * terakota, keterangan Fraunces italic. Bila slot.src diisi, foto asli
 * (next/image) menggantikan ilustrasi. Rotasi kecil mati saat
 * prefers-reduced-motion (lewat motion-safe:).
 */
export function PhotoCard({ slot }: { slot: LandingPhotoSlot }) {
  const layout = SLOT_LAYOUT[slot.id] ?? { frame: "", rotation: "" };
  return (
    <figure
      className={cn(
        "absolute m-0 bg-surface p-1.5 pb-6 shadow-float md:p-2 md:pb-8",
        layout.frame,
        layout.rotation,
      )}
    >
      {slot.src ? (
        <div className={cn("relative w-full overflow-hidden", slot.frameAspect)}>
          <Image
            src={slot.src}
            alt={slot.alt}
            fill
            sizes="(max-width: 768px) 60vw, 360px"
            className="object-cover"
          />
        </div>
      ) : (
        slot.illustration
      )}
      <span
        aria-hidden="true"
        className="absolute left-1.5 top-1.5 h-4 w-4 bg-accent [clip-path:polygon(0_0,100%_0,0_100%)] md:left-2 md:top-2 md:h-5 md:w-5"
      />
      {slot.kind === "video" ? (
        <>
          <span className="absolute bottom-8 left-3 rounded-sm bg-scrim px-1.5 py-0.5 text-caption text-on-accent md:bottom-[38px] md:left-4">
            {slot.duration}
          </span>
          <span
            aria-hidden="true"
            className="absolute right-3 top-3 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-scrim md:right-4 md:top-4 md:h-7 md:w-7"
          >
            <Play
              size={12}
              strokeWidth={1.5}
              fill="currentColor"
              className="text-on-accent"
              aria-hidden="true"
            />
          </span>
        </>
      ) : null}
      <figcaption className="absolute inset-x-2 bottom-1 font-serif text-[13px] font-medium italic leading-4 text-ink-muted md:inset-x-2.5 md:bottom-1.5 md:text-[15px] md:leading-5">
        {slot.caption}
      </figcaption>
    </figure>
  );
}

/** Tumpukan 4 kartu foto hero (posisi persen dari acuan visual). */
export function PhotoStack({ className }: { className?: string }) {
  return (
    <div className={cn("relative aspect-[358/430] w-full", className)}>
      {LANDING_PHOTOS.map((slot) => (
        <PhotoCard key={slot.id} slot={slot} />
      ))}
    </div>
  );
}
