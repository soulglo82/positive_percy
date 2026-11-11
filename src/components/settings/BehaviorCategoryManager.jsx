import { useState } from 'react';
import CategoryIcon from '@/components/CategoryIcon';
import { ICON_KEYS, ICON_LABELS } from '@/lib/categoryIcons';
import { getToken } from "@/lib/AuthContext";
import { Child } from "@/api/entities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NumberInput from "@/components/ui/NumberInput";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Check, ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import { toast } from "sonner";
import SectionHeader from "../SectionHeader";
import { formatPointsBadge } from "@/constants/terminology";

const MAX_QUICK_ACTIONS = 4;

export default function BehaviorCategoryManager() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('star');
  const [editPoints, setEditPoints] = useState(5);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['behaviorCategories'],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch('/api/behavior-categories', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
  });

  const quickActionCount = categories.filter(c => c.is_quick_action).length;

  const handleCreate = async (name, icon, points) => {
    try {
      const token = getToken();
      const res = await fetch('/api/behavior-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, icon_key: icon, points }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to create category');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['behaviorCategories'] });
      toast.success('Category created');
    } catch {
      toast.error('Failed to create category');
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/behavior-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to update category');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['behaviorCategories'] });
      if (data.name !== undefined) {
        setEditingId(null);
        toast.success('Category updated');
      }
    } catch {
      toast.error('Failed to update category');
    }
  };

  const [pendingDelete, setPendingDelete] = useState(null); // category awaiting confirm

  const handleDelete = async (id) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/behavior-categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to delete category');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['behaviorCategories'] });
      setExpandedId(null);
      toast.success('Category deleted');
    } catch {
      toast.error('Failed to delete category');
    }
  };

  const handleReorder = async (id, direction) => {
    const idx = categories.findIndex(c => c.id === id);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= categories.length) return;

    const newOrder = categories.map((c, i) => ({
      id: c.id,
      sort_order: i === idx ? categories[targetIdx].sort_order
        : i === targetIdx ? categories[idx].sort_order
        : c.sort_order,
    }));

    try {
      const token = getToken();
      await fetch('/api/behavior-categories/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ order: newOrder }),
      });
      queryClient.invalidateQueries({ queryKey: ['behaviorCategories'] });
    } catch {
      toast.error('Failed to reorder');
    }
  };

  const toggleQuickAction = (cat) => {
    if (cat.is_quick_action) {
      handleUpdate(cat.id, { is_quick_action: false });
    } else if (quickActionCount >= MAX_QUICK_ACTIONS) {
      toast.error(`Maximum ${MAX_QUICK_ACTIONS} quick actions allowed`);
    } else {
      handleUpdate(cat.id, { is_quick_action: true });
    }
  };

  const handleChildAssignment = (cat, value) => {
    const assigned_children = value === 'all' ? [] : [value];
    handleUpdate(cat.id, { assigned_children });
  };

  const getAssignmentLabel = (cat) => {
    const assigned = cat.assigned_children || [];
    if (assigned.length === 0) return 'All children';
    if (assigned.length === 1) {
      const child = children.find(c => c.id === assigned[0]);
      return child ? `${child.name} only` : 'All children';
    }
    return `${assigned.length} children`;
  };

  const getAssignmentValue = (cat) => {
    const assigned = cat.assigned_children || [];
    if (assigned.length === 0) return 'all';
    if (assigned.length === 1) return assigned[0];
    return 'all';
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon_key || 'circle');
    setEditPoints(cat.points || 5);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditIcon('star');
    setEditPoints(5);
  };

  if (isLoading) return null;

  return (
    <div>
      <SectionHeader icon={ListChecks}>Behaviours</SectionHeader>
      <Card>
        <CardContent className="pt-4 pb-3 px-3 sm:px-6">
          {/* Quick action counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">Tap a row to edit details</span>
            <span className="text-xs font-medium text-muted-foreground">
              Quick actions: <span className={`font-semibold tabular-nums ${quickActionCount >= MAX_QUICK_ACTIONS ? 'px-1.5 rounded-sm bg-warning border border-warning-border text-warning-foreground' : 'text-foreground'}`}>{quickActionCount}/{MAX_QUICK_ACTIONS}</span>
            </span>
          </div>

          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No categories yet. Add your first one below.
            </p>
          ) : (
            <div className="border border-border rounded-md overflow-hidden">
              {categories.map((cat, idx) => {
                const isExpanded = expandedId === cat.id;
                const isEditing = editingId === cat.id;

                return (
                  <div key={cat.id} className={`${idx > 0 ? 'border-t border-border' : ''}`}>
                    {/* Main row — always visible */}
                    {/* Two sibling controls, nothing nested (A2 E2): the row
                        opens with a real button, the quick-action box is its
                        own labelled checkbox. Both work by keyboard. */}
                    <div className={`flex items-center gap-1 pr-2 transition-colors ${isExpanded ? 'bg-muted' : ''}`}>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={`category-panel-${cat.id}`}
                        disabled={isEditing}
                        onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                        className="flex flex-1 min-w-0 min-h-11 items-center gap-3 px-3 py-2.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <span className="shrink-0 w-7 flex justify-center text-muted-foreground"><CategoryIcon iconKey={cat.icon_key} className="w-5 h-5" /></span>
                        <span className="font-medium text-foreground flex-1 min-w-0 truncate text-sm">{cat.name}</span>
                        <span className="text-sm text-earn font-semibold tabular-nums shrink-0 w-14 text-right">{formatPointsBadge(cat.points || 5)}</span>
                        <span className="shrink-0 text-muted-foreground" aria-hidden="true">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </button>
                      <label className="shrink-0 flex min-h-11 items-center gap-1.5 px-1 cursor-pointer">
                        <Checkbox
                          checked={cat.is_quick_action}
                          disabled={!cat.is_quick_action && quickActionCount >= MAX_QUICK_ACTIONS}
                          aria-label={`${cat.name} quick action`}
                          onCheckedChange={() => toggleQuickAction(cat)}
                        />
                        <span className="text-xs text-muted-foreground w-10" aria-hidden="true">Quick</span>
                      </label>
                    </div>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <div id={`category-panel-${cat.id}`} className="px-3 pb-3 pt-1 bg-muted border-t border-border">
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const nextIdx = ICON_KEYS.indexOf(editIcon);
                                  setEditIcon(ICON_KEYS[(nextIdx + 1) % ICON_KEYS.length]);
                                }}
                                className="text-lg rounded-md border border-input bg-card hover:bg-accent min-w-11 min-h-11 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                aria-label={`Change icon, now ${ICON_LABELS[editIcon] || 'Circle'}`}
                              >
                                <CategoryIcon iconKey={editIcon} className="w-5 h-5" />
                              </button>
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                aria-label="Behaviour name"
                                className="flex-1 text-sm"
                                maxLength={100}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdate(cat.id, { name: editName, icon_key: editIcon, points: Math.min(1000, Math.max(1, Math.round(Number(editPoints) || 5))) });
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                              <NumberInput
                                value={editPoints}
                                min={1}
                                max={1000}
                                onChange={setEditPoints}
                                aria-label="Points"
                                className="w-20 text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleUpdate(cat.id, { name: editName, icon_key: editIcon, points: Math.min(1000, Math.max(1, Math.round(Number(editPoints) || 5))) })}
                              >
                                <Check className="w-4 h-4" /> Save
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEdit}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Assigned children */}
                            {children.length > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground shrink-0" id={`assign-${cat.id}`}>Assigned to:</span>
                                <Select
                                  value={getAssignmentValue(cat)}
                                  onValueChange={(v) => handleChildAssignment(cat, v)}
                                >
                                  <SelectTrigger aria-labelledby={`assign-${cat.id}`} className="flex-1 max-w-52">
                                    <SelectValue>{getAssignmentLabel(cat)}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All children</SelectItem>
                                    {children.map(child => (
                                      <SelectItem key={child.id} value={child.id}>
                                        {child.name} only
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReorder(cat.id, 'up')}
                                disabled={idx === 0}
                              >
                                Move Up
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReorder(cat.id, 'down')}
                                disabled={idx === categories.length - 1}
                              >
                                Move Down
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(cat)}
                              >
                                <Pencil className="w-4 h-4" /> Edit
                              </Button>
                              {!cat.is_default && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPendingDelete(cat)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" /> Delete
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Button variant="outline" className="w-full mt-3" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Add behaviour
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Points already given stay in history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = pendingDelete?.id;
                setPendingDelete(null);
                if (id) handleDelete(id);
              }}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddCategoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={(name, icon, points) => {
          handleCreate(name, icon, points);
          setShowAddModal(false);
        }}
      />
    </div>
  );
}

function AddCategoryModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('star');
  const [points, setPoints] = useState(5);

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Category name is required');
      return;
    }
    onSubmit(name.trim(), icon, Math.min(1000, Math.max(1, Math.round(Number(points) || 5))));
    setName('');
    setIcon('star');
    setPoints(5);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New behaviour</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground mb-2" id="cat_icon">Icon</p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="cat_icon">
              {ICON_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={ICON_LABELS[key]}
                  aria-pressed={icon === key}
                  onClick={() => setIcon(key)}
                  className={`w-11 h-11 rounded-md border flex items-center justify-center text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    icon === key
                      ? 'border-2 border-selected-border bg-selected'
                      : 'border-border bg-card hover:bg-accent'
                  }`}
                >
                  <CategoryIcon iconKey={key} className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="cat_name" className="mb-2 block">Name</Label>
            <Input
              id="cat_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Teamwork"
              maxLength={100}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div>
            <Label htmlFor="cat_points" className="mb-2 block">Percy Points</Label>
            <NumberInput
              id="cat_points"
              value={points}
              onChange={setPoints}
              min={1}
              max={1000}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1"
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
