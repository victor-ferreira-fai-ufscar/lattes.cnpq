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
    <div className={cn("space-y-2", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
          {eyebrow}
        </p>
      ) : null}
      <div className="space-y-1">
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>
    </div>
  );
}