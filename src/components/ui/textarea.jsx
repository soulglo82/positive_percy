import * as React from "react"
import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea className={cn("flex min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-subtle-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50", className)} ref={ref} {...props} />
))
Textarea.displayName = "Textarea"

export { Textarea }
