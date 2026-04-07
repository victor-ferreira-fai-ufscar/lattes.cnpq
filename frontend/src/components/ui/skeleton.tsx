import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton-sheen relative overflow-hidden rounded-md bg-[linear-gradient(180deg,rgba(226,232,240,0.92),rgba(241,245,249,0.88))]",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
