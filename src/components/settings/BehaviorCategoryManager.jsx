import { useState } from 'react';
import { getToken } from "@/lib/AuthContext";
import { Child } from "@/api/entities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import SectionHeader from "../SectionHeader";
import { formatPointsBadge } from "@/constants/terminology";

const EMOJI_OPTIONS = ['⭐', '📚', '🧹', '🤝', '💪', '🎨', '🏃', '🎵', '🧠', '💤', '💛', '✅', '🦁', '🫶', '📖', '🌟'];
const MAX_QUICK_ACTIONS = 4;

export default function BehaviorCategoryManager() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('⭐');
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
        body: JSON.stringify({ name, icon, points }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to create category');
        return;
      }
      queryClient.invalidateQueries(['behaviorCategories']);
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
      queryClient.invalidateQueries(['behaviorCategories']);
      if (data.name !== undefined) {
        setEditingId(null);
        toast.success('Category updated');
      }
    } catch {
      toast.error('Failed to update category');
    }
  };

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
      queryClient.invalidateQueries(['behaviorCategories']);
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
      queryClient.invalidateQueries(['behaviorCategories']);
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
    setEditIcon(cat.icon);
    setEditPoints(cat.points || 5);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditIcon('⭐');
    setEditPoints(5);
  };

  if (isLoading) return null;

  return (
    <div>
      <SectionHeader icon="📋">Behavior Categories</SectionHeader>
      <Card>
        <CardContent className="pt-4 pb-3 px-3 sm:px-6">
          {/* Quick action counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500">Tap a row to edit details</span>
            <span className="text-xs font-medium text-slate-500">
              Quick actions: <span className={quickActionCount >= MAX_QUICK_ACTIONS ? 'text-amber-600 font-bold' : 'text-green-600 font-bold'}>{quickActionCount}/{MAX_QUICK_ACTIONS}</span>
            </span>
          </div>

          {categories.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-4 text-center">
              No categories yet. Add your first one below.
            </p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {categories.map((cat, idx) => {
                const isExpanded = expandedId === cat.id;
                const isEditing = editingId === cat.id;

                return (
                  <div key={cat.id} className={`${idx > 0 ? 'border-t border-slate-200' : ''}`}>
                    {/* Main row — always visible */}
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}
                      onClick={() => {
                        if (!isEditing) setExpandedId(isExpanded ? null : cat.id);
                      }}
                    >
                      <span className="text-lg shrink-0 w-7 text-center">{cat.icon}</span>
                      <span className="font-medium text-slate-700 flex-1 min-w-0 truncate text-sm">{cat.name}</span>
                      <span className="text-xs text-green-600 font-bold shrink-0 w-14 text-right">{formatPointsBadge(cat.points || 5)}</span>
                      <div
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleQuickAction(cat);
                        }}
                      >
                        <Checkbox
                          checked={cat.is_quick_action}
                          disabled={!cat.is_quick_action && quickActionCount >= MAX_QUICK_ACTIONS}
                          aria-label={`${cat.name} quick action`}
                          className="pointer-events-none"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 w-8">Quick</span>
                      <span className="shrink-0 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </div>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 bg-slate-50 border-t border-slate-100">
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const nextIdx = EMOJI_OPTIONS.indexOf(editIcon);
                                  setEditIcon(EMOJI_OPTIONS[(nextIdx + 1) % EMOJI_OPTIONS.length]);
                                }}
                                className="text-lg p-1.5 rounded border border-slate-200 hover:border-purple-300 min-w-[40px] min-h-[40px] flex items-center justify-center"
                                aria-label="Change icon"
                              >
                                {editIcon}
                              </button>
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="flex-1 h-9 text-sm"
                                maxLength={100}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdate(cat.id, { name: editName, icon: editIcon, points: editPoints });
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                              <Input
                                type="number"
                                value={editPoints}
                                onChange={(e) => setEditPoints(Math.max(1, Number(e.target.value)))}
                                className="w-20 h-9 text-sm"
                                min="1"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleUpdate(cat.id, { name: editName, icon: editIcon, points: editPoints })}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <Check className="w-4 h-4 mr-1" /> Save
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
                                <Label className="text-xs text-slate-500 shrink-0">Assigned to:</Label>
                                <Select
                                  value={getAssignmentValue(cat)}
                                  onValueChange={(v) => handleChildAssignment(cat, v)}
                                >
                                  <SelectTrigger className="h-8 text-xs flex-1 max-w-[200px] border-slate-200">
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
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReorder(cat.id, 'up')}
                                disabled={idx === 0}
                                className="h-8 px-2 text-xs"
                              >
                                Move Up
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReorder(cat.id, 'down')}
                                disabled={idx === categories.length - 1}
                                className="h-8 px-2 text-xs"
                              >
                                Move Down
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(cat)}
                                className="h-8 px-2 text-xs"
                              >
                                <Pencil className="w-3 h-3 mr-1" /> Edit
                              </Button>
                              {!cat.is_default && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDelete(cat.id)}
                                  className="h-8 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-3 h-3 mr-1" /> Delete
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
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        </CardContent>
      </Card>

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
  const [icon, setIcon] = useState('⭐');
  const [points, setPoints] = useState(5);

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Category name is required');
      return;
    }
    onSubmit(name.trim(), icon, points);
    setName('');
    setIcon('⭐');
    setPoints(5);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Behavior Category</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Icon</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg transition-all ${
                    icon === emoji
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="cat_name" className="text-sm font-medium mb-2 block">Name</Label>
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
            <Label htmlFor="cat_points" className="text-sm font-medium mb-2 block">Percy Points</Label>
            <Input
              id="cat_points"
              type="number"
              value={points}
              onChange={(e) => setPoints(Math.max(1, Number(e.target.value)))}
              min="1"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
