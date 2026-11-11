import { Toaster as Sonner } from "sonner"
const Toaster = ({ ...props }) => (<Sonner className="toaster group" toastOptions={{ classNames: { toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg", description: "group-[.toast]:text-muted-foreground", actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground !min-h-11 !px-4 !text-sm !font-semibold", cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground" } }} {...props} />)
export { Toaster }
