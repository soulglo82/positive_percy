import React, { useState } from 'react';
import { getToken } from "@/lib/AuthContext";
import { Child } from "@/api/entities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, Lock, ArrowUp, ArrowDown, Check, X, Zap } from "lucide-react";
import { toast } from "sonner";
import SectionHeader from "../SectionHeader";
import { formatPointsBadge } from "@/constants/terminology";

const EMOJI_OPTIONS = ['⭐', '📚', '🧹', '🤝', '💪', '🎨', '🏃', '🎵', '🧠', '💤', '💛', '✅'];
const MAX_QUICK_ACTIONS = 4;

export default function BehaviorCategoryManager() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
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
    let assigned_children;
    if (value === 'all') {
      assigned_children = [];
    } else {
      assigned_children = [value];
    }
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
        <CardContent className="space-y-2 pt-4">
          {categories.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-2 text-center">
              No categories yet. Add your first one below.
            </p>
          ) : (
            <div className="space-y-1.5">
              {categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 gap-2"
                >
                  {editingId === cat.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        onClick={() => {
                          const nextIdx = EMOJI_OPTIONS.indexOf(editIcon);
                          setEditIcon(EMOJI_OPTIONS[(nextIdx + 1) % EMOJI_OPTIONS.length]);
                        }}
                        className="text-lg p-1 rounded border border-slate-200 hover:border-purple-300 min-w-[36px] min-h-[36px] flex items-center justify-center"
                        aria-label="Change icon"
                      >
                        {editIcon}
                      </button>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 h-8 text-sm"
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
                        className="w-16 h-8 text-sm"
                        min="1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUpdate(cat.id, { name: editName, icon: editIcon, points: editPoints })}
                        aria-label="Save"
                        className="min-h-[36px] min-w-[36px]"
                      >
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        aria-label="Cancel"
                        className="min-h-[36px] min-w-[36px]"
                      >
                        <X className="w-4 h-4 text-slate-400" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-lg shrink-0">{cat.icon}</span>
                        <span className="font-medium text-slate-700 truncate">{cat.name}</span>
                        <span className="text-xs text-green-600 font-bold shrink-0">{formatPointsBadge(cat.points || 5)}</span>
                        {cat.is_default && (
                          <Lock className="w-3 h-3 text-slate-400 shrink-0" aria-label="Default category" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Quick Action Toggle */}
                        <button
                          onClick={() => toggleQuickAction(cat)}
                          disabled={!cat.is_quick_action && quickActionCount >= MAX_QUICK_ACTIONS}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                            cat.is_quick_action
                              ? 'bg-amber-100 text-amber-700 border border-amber-300'
                              : quickActionCount >= MAX_QUICK_ACTIONS
                                ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed'
                                : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-amber-50 hover:text-amber-600'
                          }`}
                          title={!cat.is_quick_action && quickActionCount >= MAX_QUICK_ACTIONS
                            ? `Maximum ${MAX_QUICK_ACTIONS} quick actions`
                            : cat.is_quick_action ? 'Quick action enabled' : 'Enable as quick action'}
                        >
                          <Zap className="w-3 h-3" />
                          {cat.is_quick_action && <Check className="w-3 h-3" />}
                        </button>

                        {/* Children Assignment */}
                        {children.length > 0 && (
                          <Select
                            value={getAssignmentValue(cat)}
                            onValueChange={(v) => handleChildAssignment(cat, v)}
                          >
                            <SelectTrigger className="h-7 text-xs w-auto min-w-[100px] max-w-[130px] border-slate-200">
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
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReorder(cat.id, 'up')}
                          disabled={idx === 0}
                          aria-label={`Move ${cat.name} up`}
                          className="min-h-[28px] min-w-[28px] h-7 w-7 p-0"
                        >
                          <ArrowUp className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReorder(cat.id, 'down')}
                          disabled={idx === categories.length - 1}
                          aria-label={`Move ${cat.name} down`}
                          className="min-h-[28px] min-w-[28px] h-7 w-7 p-0"
                        >
                          <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(cat)}
                          aria-label={`Edit ${cat.name}`}
                          className="min-h-[28px] min-w-[28px] h-7 w-7 p-0"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                        {!cat.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cat.id)}
                            aria-label={`Delete ${cat.name}`}
                            className="min-h-[28px] min-w-[28px] h-7 w-7 p-0"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
            <span className="text-xs text-slate-400 ml-3 shrink-0">
              Quick actions: {quickActionCount}/{MAX_QUICK_ACTIONS}
            </span>
          </div>
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
