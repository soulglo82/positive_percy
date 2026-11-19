import { Checkbox } from "@/components/ui/checkbox";

// Used by the V1 reward form (RewardForm.jsx).

export function ChildAssignList({ children, selectedIds, onToggle }) {
  return (
    <div className="space-y-1">
      {children.map((child) => (
        <label
          key={child.id}
          htmlFor={`child-${child.id}`}
          className="flex items-center gap-3 min-h-11 px-1 rounded-md cursor-pointer hover:bg-accent"
        >
          <Checkbox
            id={`child-${child.id}`}
            checked={selectedIds.some((id) => String(id).toLowerCase() === String(child.id).toLowerCase())}
            onCheckedChange={() => onToggle(child.id)}
          />
          <span className="text-sm font-medium text-foreground">{child.name}</span>
        </label>
      ))}
    </div>
  );
}
