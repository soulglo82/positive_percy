
// Sentence-case section title. Icons, if any, are lucide components.
export default function SectionHeader({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground mt-5 mb-2 first:mt-0">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />}
      {children}
    </h2>
  );
}
