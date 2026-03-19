import React, { useState } from 'react';
import { Child } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Save, Copy, Check, Share2, Lightbulb, UserPlus, Download, Trash2, Pencil } from "lucide-react";
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
import { toast } from "sonner";
import { formatPoints } from "@/constants/terminology";
import SectionHeader from "../components/SectionHeader";
import OnboardingTips from "../components/OnboardingTips";
import AddChildModal from "../components/child/AddChildModal";
import EditChildModal from "../components/child/EditChildModal";
import BehaviorCategoryManager from "../components/settings/BehaviorCategoryManager";

export default function ParentProfile() {
  const { user, account, familyCode, updateUser, deleteAccount, exportData } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [familyName, setFamilyName] = useState(user?.full_name || '');
  const [showTips, setShowTips] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showEditChild, setShowEditChild] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
  });

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8 text-purple-500" />
          <h1 className="text-3xl font-bold text-slate-800">Family Settings</h1>
        </div>

        {/* Behavior Categories (includes Quick Action toggle + per-child assignment) */}
        <BehaviorCategoryManager />

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

        {/* Account & Data Management */}
        <SectionHeader icon="🔒">Account & Data</SectionHeader>
        <Card>
          <CardContent className="space-y-3 pt-4">
            {account && (
              <p className="text-sm text-slate-500">
                Signed in as <span className="font-medium text-slate-700">{account.email}</span>
              </p>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                try {
                  await exportData();
                  toast.success('Data exported successfully');
                } catch {
                  toast.error('Export failed');
                }
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Download My Data
            </Button>
            <Button
              variant="outline"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </CardContent>
        </Card>

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

      {/* Delete Account Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and ALL family data including children, points, rewards, and activity history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await deleteAccount();
                  toast.success('Account deleted');
                } catch (err) {
                  toast.error(err.message || 'Failed to delete account');
                }
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              Yes, delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
