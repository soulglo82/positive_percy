import React, { useState } from 'react';
import { Child } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { getToken } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save, Copy, Check, Share2, Lightbulb, Plus, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PERCY, formatPointsBadge, formatPoints } from "@/constants/terminology";
import SectionHeader from "../components/SectionHeader";
import OnboardingTips from "../components/OnboardingTips";
import AddChildModal from "../components/child/AddChildModal";
import EditChildModal from "../components/child/EditChildModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EMOJI_OPTIONS = ['⭐', '📚', '🧹', '🤝', '💪', '🎨', '🏃', '🎵', '🧠', '💤', '🦷', '🍎'];

const DEFAULT_QUICK_ACTIONS = [
  { id: 'default-1', label: "Kindness", points: 5, icon: "⭐" },
  { id: 'default-2', label: "Homework", points: 10, icon: "📚" },
  { id: 'default-3', label: "Chores", points: 5, icon: "🧹" },
  { id: 'default-4', label: "Manners", points: 5, icon: "🤝" },
];

export default function ParentProfile() {
  const { user, familyCode, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [familyName, setFamilyName] = useState(user?.full_name || '');
  const [showTips, setShowTips] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showEditChild, setShowEditChild] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
  });

  const { data: quickActions = [] } = useQuery({
    queryKey: ['quickActions'],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch('/api/quick-actions', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const displayActions = quickActions.length > 0 ? quickActions : DEFAULT_QUICK_ACTIONS;
  const isUsingDefaults = quickActions.length === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateUser({ full_name: familyName });
      toast.success("Family name updated!");
    } catch (error) {
      toast.error(error.message || "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAction = async (actionId) => {
    try {
      const token = getToken();
      await fetch(`/api/quick-actions/${actionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      queryClient.invalidateQueries(['quickActions']);
      toast.success("Quick action deleted");
    } catch {
      toast.error("Failed to delete quick action");
    }
  };

  const handleEditAction = (action) => {
    setEditingAction(action);
    setShowActionModal(true);
  };

  const handleNewAction = () => {
    setEditingAction(null);
    setShowActionModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-purple-500" />
          <h1 className="text-3xl font-bold text-slate-800">Family Settings</h1>
        </div>

        {/* Quick Actions */}
        <SectionHeader icon="⚡">Quick Actions</SectionHeader>
        <Card>
          <CardContent className="space-y-3 pt-4">
            {isUsingDefaults && (
              <p className="text-xs text-slate-400 italic">{PERCY.HELPER_TEXT_QUICK_ACTIONS}</p>
            )}
            <div className="space-y-1.5">
              {displayActions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{action.icon}</span>
                    <span className="font-medium text-slate-700">{action.label}</span>
                    <span className="text-sm text-green-600 font-bold">{formatPointsBadge(action.points)}</span>
                  </div>
                  {!isUsingDefaults && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEditAction(action)}>
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteAction(action.id)}>
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={handleNewAction}>
              <Plus className="w-4 h-4 mr-2" />
              Add Action
            </Button>
          </CardContent>
        </Card>

        {/* Children */}
        <SectionHeader icon="👨‍👩‍👧‍👦">Children</SectionHeader>
        <Card>
          <CardContent className="space-y-2 pt-4">
            {children.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-2 text-center">No children added yet.</p>
            ) : (
              <div className="space-y-1.5">
                {children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      {child.avatar_url ? (
                        <img src={child.avatar_url} alt={child.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-bold">
                          {child.name.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-slate-700">{child.name}</span>
                      <span className="text-sm text-purple-600 font-bold">{formatPoints(child.total_points, { compact: true })}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedChild(child);
                        setShowEditChild(true);
                      }}
                    >
                      <Pencil className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => setShowAddChild(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Child
            </Button>
          </CardContent>
        </Card>

        {/* Family Name */}
        <SectionHeader icon="👪">Family Name</SectionHeader>
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="e.g., The Smiths"
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Save className="w-4 h-4 mr-1" />
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Invite Parent */}
        {familyCode && (
          <>
          <SectionHeader icon="🔑">Invite Parent</SectionHeader>
          <Card className="border-2 border-purple-200 bg-purple-50/50">
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center gap-3">
                <div className="text-3xl font-mono font-bold tracking-widest text-purple-700 bg-white rounded-lg px-4 py-2 border">
                  {familyCode}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(familyCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-slate-500">Both parents can add points and manage rewards.</p>
              <Button
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                onClick={async () => {
                  const shareText = `Join our family on Positive Percy! Use code: ${familyCode}\n\nhttps://positivepercy.up.railway.app`;
                  if (navigator.share) {
                    try {
                      await navigator.share({ title: 'Join our family on Positive Percy', text: shareText });
                    } catch (err) {
                      if (err.name !== 'AbortError') {
                        navigator.clipboard.writeText(shareText);
                        toast.success('Share text copied to clipboard');
                      }
                    }
                  } else {
                    navigator.clipboard.writeText(shareText);
                    toast.success('Share text copied to clipboard');
                  }
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share Invite Link
              </Button>
            </CardContent>
          </Card>
          </>
        )}

        {/* Parenting Tips - bottom link */}
        <button
          onClick={() => setShowTips(true)}
          className="w-full text-center text-sm text-slate-400 hover:text-purple-500 transition-colors py-2"
        >
          <Lightbulb className="w-4 h-4 inline mr-1" />
          Need help rewarding behaviour? View Parenting Tips
        </button>
      </div>

      <OnboardingTips
        isOpen={showTips}
        onClose={() => setShowTips(false)}
        forceShow
      />

      <QuickActionModal
        isOpen={showActionModal}
        onClose={() => {
          setShowActionModal(false);
          setEditingAction(null);
        }}
        action={editingAction}
        onSaved={() => {
          queryClient.invalidateQueries(['quickActions']);
          setShowActionModal(false);
          setEditingAction(null);
        }}
      />

      <AddChildModal
        isOpen={showAddChild}
        onClose={() => setShowAddChild(false)}
        onSubmit={async (data) => {
          await Child.create(data);
          queryClient.invalidateQueries(['children']);
          setShowAddChild(false);
          toast.success("Child added!");
        }}
      />

      {selectedChild && (
        <EditChildModal
          isOpen={showEditChild}
          onClose={() => {
            setShowEditChild(false);
            setSelectedChild(null);
          }}
          child={selectedChild}
          onSubmit={async (data) => {
            await Child.update(selectedChild.id, data);
            queryClient.invalidateQueries(['children']);
            toast.success(`${data.name}'s profile updated!`);
          }}
          onDelete={async (child) => {
            await Child.delete(child.id);
            queryClient.invalidateQueries(['children']);
            setShowEditChild(false);
            setSelectedChild(null);
            toast.success(`${child.name} has been removed`);
          }}
        />
      )}
    </div>
  );
}

function QuickActionModal({ isOpen, onClose, action, onSaved }) {
  const [label, setLabel] = useState('');
  const [points, setPoints] = useState(5);
  const [icon, setIcon] = useState('⭐');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (action) {
      setLabel(action.label);
      setPoints(action.points);
      setIcon(action.icon || '⭐');
    } else {
      setLabel('');
      setPoints(5);
      setIcon('⭐');
    }
  }, [action, isOpen]);

  const handleSave = async () => {
    if (!label.trim()) {
      toast.error("Label is required");
      return;
    }
    setSaving(true);
    try {
      const token = getToken();
      const url = action
        ? `/api/quick-actions/${action.id}`
        : '/api/quick-actions';
      const method = action ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ label: label.trim(), points, icon }),
      });

      if (!res.ok) throw new Error('Failed to save');
      toast.success(action ? 'Quick action updated' : 'Quick action created');
      onSaved();
    } catch {
      toast.error("Failed to save quick action");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action ? 'Edit Quick Action' : 'New Quick Action'}
          </DialogTitle>
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
            <Label htmlFor="action_label" className="text-sm font-medium mb-2 block">Label</Label>
            <Input
              id="action_label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Kindness"
              maxLength={50}
            />
          </div>

          <div>
            <Label htmlFor="action_points" className="text-sm font-medium mb-2 block">Points</Label>
            <Input
              id="action_points"
              type="number"
              value={points}
              onChange={(e) => setPoints(Math.max(1, Number(e.target.value)))}
              min="1"
            />
          </div>

          {/* Preview */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Preview</Label>
            <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 w-fit">
              <span>{icon}</span>
              <span>{label || 'Label'}</span>
              <span className="font-bold">{formatPointsBadge(points)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !label.trim()}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
