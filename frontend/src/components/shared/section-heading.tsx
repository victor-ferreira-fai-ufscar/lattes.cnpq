import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description: string;
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
          {eyebrow}
        </p>
      ) : null}
      <div className="space-y-2">
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-[3.4rem] lg:leading-[1.02]">
          {title}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
          {description}
        </p>
      </div>
    </div>
  );
}