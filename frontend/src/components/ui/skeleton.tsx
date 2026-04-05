import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-slate-200/85 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.72),transparent)]",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
