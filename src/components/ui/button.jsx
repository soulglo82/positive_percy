import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Batch D: token colours only; 44px on touch screens for every size.
const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground hover:bg-primary-hover",
      destructive: "bg-destructive text-destructive-foreground",
      outline: "border border-input bg-card text-foreground hover:bg-accent",
      secondary: "border border-border bg-muted text-foreground hover:bg-accent",
      ghost: "text-foreground hover:bg-accent",
      link: "text-primary underline-offset-4 hover:underline",
      // V1-F section 10 (owner, 24 November 2026): two quiet, colour-coded buttons
      // on Home. Neither is solid, so the Quick Points boxes stay the main thing.
      warm: "border border-warm-ink bg-warm-soft text-foreground hover:bg-warning [&_svg]:text-warm-ink",
      soft: "border border-input bg-accent text-foreground hover:bg-selected [&_svg]:text-primary",
    },
    size: {
      default: "h-10 px-4 py-2 touch:h-11 touch:min-w-11",
      sm: "h-9 px-3 touch:h-11 touch:min-w-11",
      lg: "h-11 px-8",
      icon: "h-10 w-10 shrink-0 touch:h-11 touch:w-11",
      // E05: the goal completion control is 44px on every pointer (register
      // control_size_weight), not only on touch screens.
      goal: "min-h-11 min-w-11 px-3 [&_svg]:size-6",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
})

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
})
Button.displayName = "Button"

export { Button, buttonVariants }
