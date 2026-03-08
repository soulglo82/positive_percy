import React, { useState } from 'react';
import { useAuth } from "@/lib/AuthContext";
import { getToken } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Save, Copy, Check, Share2, Lightbulb, Plus, Pencil, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import OnboardingTips from "../components/OnboardingTips";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EMOJI_OPTIONS = ['⭐', '📚', '🧹', '🤝', '💪', '🎨', '🏃', '🎵', '🧠', '💤', '🦷', '🍎'];

export default function ParentProfile() {
  const { user, familyCode, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [familyName, setFamilyName] = useState(user?.full_name || '');
  const [showTips, setShowTips] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [editingAction, setEditingAction] = useState(null);

  // Quick Actions CRUD
  const { data: quickActions = [], refetch: refetchActions } = useQuery({
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateUser({ full_name: familyName });
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error(error.message || "Failed to update profile");
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
        <div className="flex items-center gap-3 mb-8">
          <User className="w-8 h-8 text-purple-500" />
          <h1 className="text-3xl font-bold text-slate-800">Family Profile</h1>
        </div>

        {/* Family Name */}
        <Card>
          <CardHeader>
            <CardTitle>Family Name</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="family_name">Name</Label>
                <Input
                  id="family_name"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="e.g., The Smiths"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Actions Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-500 mb-4">
              Customise the quick reward buttons shown on child cards.
            </p>
            {quickActions.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-4 text-center">
                No custom quick actions yet. Default actions will be used.
              </p>
            ) : (
              <div className="space-y-2">
                {quickActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{action.icon}</span>
                      <span className="font-medium text-slate-700">{action.label}</span>
                      <span className="text-sm text-green-600 font-bold">+{action.points} pts</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditAction(action)}
                      >
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAction(action.id)}
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={handleNewAction}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Action
            </Button>
          </CardContent>
        </Card>

        {/* Family Code */}
        {familyCode && (
          <Card className="border-2 border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle>Family Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Share this code with the other parent so they can join your family:
              </p>
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
                Share with Family
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tips Card */}
        <Card>
          <CardContent className="py-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowTips(true)}
            >
              <Lightbulb className="w-4 h-4 mr-2 text-amber-500" />
              View Parenting Tips
            </Button>
          </CardContent>
        </Card>
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
              <span className="font-bold">+{points} pts</span>
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
