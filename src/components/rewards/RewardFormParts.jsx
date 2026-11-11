import { Checkbox } from "@/components/ui/checkbox";

// Shared by Create and Edit Reward.

export function EmojiPicker({ options, value, onChange }) {
  return (
    <div className="grid grid-cols-6 gap-2" role="group" aria-label="Choose icon">
      {options.map((e) => (
        <button
          key={e}
          type="button"
          aria-pressed={value === e}
          onClick={() => onChange(e)}
          className={`flex items-center justify-center text-lg min-h-11 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            value === e
              ? 'border-2 border-selected-border bg-selected'
              : 'border-border bg-card hover:bg-accent'
          }`}
        >
          <span aria-hidden="true">{e}</span>
          <span className="sr-only">{e}</span>
        </button>
      ))}
    </div>
  );
}

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
            checked={selectedIds.includes(child.id)}
            onCheckedChange={() => onToggle(child.id)}
          />
          <span className="text-sm font-medium text-foreground">{child.name}</span>
        </label>
      ))}
    </div>
  );
}
