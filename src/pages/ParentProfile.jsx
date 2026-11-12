import { useState } from 'react';
import { Child } from "@/api/entities";
import { buildChildCreatePayload } from "@/lib/childPayload";
import { useAuth, getToken } from "@/lib/AuthContext";
import { downloadFamilyReport } from "@/lib/familyReport";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Save, Copy, Check, Share2, Lightbulb, UserPlus, Users, Home, KeyRound, Download } from "lucide-react";
import { toast } from "sonner";
import { Points } from "@/components/brand/PointsStar";
import ChildAvatar from "../components/child/ChildAvatar";
import { childColour } from "@/lib/childColour";
import SectionHeader from "../components/SectionHeader";
import OnboardingTips from "../components/OnboardingTips";
import AddChildModal from "../components/child/AddChildModal";
import EditChildModal from "../components/child/EditChildModal";
import BehaviorCategoryManager from "../components/settings/BehaviorCategoryManager";
import FamilyTimezone from "../components/settings/FamilyTimezone";
import DeleteFamilyCard from "../components/settings/DeleteFamilyCard";
import { Pencil } from "lucide-react";

export default function ParentProfile() {
  const { user, familyCode, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [familyName, setFamilyName] = useState(user?.full_name || '');
  const [showTips, setShowTips] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [showEditChild, setShowEditChild] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);

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
      toast.success("Family name updated.");
    } catch (error) {
      toast.error(error.message || "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    if (reporting) return;
    setReporting(true);
    try {
      const res = await fetch('/api/family/export?photos=exclude', {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        const response = await res.json().catch(() => ({}));
        throw new Error(response.error || 'Could not prepare the report.');
      }
      const data = await res.json();
      const pageCount = await downloadFamilyReport(data);
      toast.success(`Family Report ready (${pageCount} ${pageCount === 1 ? 'page' : 'pages'}).`);
    } catch (err) {
      toast.error(err.message || 'Could not create Family Report.');
    } finally {
      setReporting(false);
    }
  };

  const handleDownloadData = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      let res = await fetch('/api/family/export', { headers, cache: 'no-store' });
      let excludedPhotos = false;
      // An exceptionally large export is still available without photo bytes.
      if (res.status === 413) {
        res = await fetch('/api/family/export?photos=exclude', { headers, cache: 'no-store' });
        excludedPhotos = true;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not download family data');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'positive-percy-family-data.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      // The browser may need a moment to finish processing the download.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      if (excludedPhotos) {
        toast.warning('Data downloaded without embedded photos because the export was too large.');
      } else {
        toast.success('Family data download started.');
      }
    } catch (err) {
      toast.error(err.message || 'Could not download family data');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <h1 className="font-display text-title font-semibold text-foreground">Family settings</h1>
        </div>

        {/* Behavior Categories (includes Quick Action toggle + per-child assignment) */}
        <BehaviorCategoryManager />

        {/* When the week starts and which day counts for the streak */}
        <FamilyTimezone />

        {/* Children */}
        <SectionHeader icon={Users}>Children</SectionHeader>
        <Card>
          <CardContent className="space-y-2 pt-4">
            {children.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 text-center">No children added yet.</p>
            ) : (
              <div className="space-y-1.5">
                {children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between gap-2 pl-3 pr-1 py-1 rounded-md bg-muted border border-border"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ChildAvatar name={child.name} url={child.avatar_url} size="sm" colour={childColour(child, children)} />
                      <span className="font-medium text-foreground truncate">{child.name}</span>
                      <Points value={child.total_points} className="text-sm text-muted-foreground font-semibold" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${child.name}`}
                      onClick={() => {
                        setSelectedChild(child);
                        setShowEditChild(true);
                      }}
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => setShowAddChild(true)}>
              <UserPlus className="w-4 h-4" />
              Add child
            </Button>
          </CardContent>
        </Card>

        {/* Family Name */}
        <SectionHeader icon={Home}>Family name</SectionHeader>
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                aria-label="Family name"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="e.g., The Smiths"
                className="flex-1"
              />
              <Button type="submit" disabled={loading}>
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Family report is the default; technical export remains available. */}
        <SectionHeader icon={Download}>Family report &amp; data</SectionHeader>
        <Card>
          <CardContent className="space-y-4 pt-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Our family's achievements</p>
              <p className="text-sm text-muted-foreground mt-1">
                A printable PDF with each child's points, achievements, claimed rewards and
                the past 30 days of activity. Made for sharing within your family.
              </p>
            </div>
            <Button onClick={handleDownloadReport} disabled={reporting || downloading}
              className="w-full sm:w-auto">
              <Download className="w-4 h-4" aria-hidden="true" />
              {reporting ? 'Creating your report…' : 'Download Family Report (PDF)'}
            </Button>
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Need every record, including historical points and available stored photos?
                Download the technical JSON export. It isn't a printable report or an app backup.
              </p>
              <Button variant="outline" onClick={handleDownloadData} disabled={downloading || reporting}
                className="w-full sm:w-auto">
                <Download className="w-4 h-4" aria-hidden="true" />
                {downloading ? 'Preparing data…' : 'Download technical data (JSON)'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invite Parent */}
        {familyCode && (
          <>
          <SectionHeader icon={KeyRound}>Invite parent</SectionHeader>
          <Card>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-center gap-3">
                <div className="text-title font-mono font-semibold text-foreground bg-muted rounded-md px-4 py-2 border border-border">
                  {familyCode}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={copied ? 'Family code copied' : 'Copy family code'}
                  onClick={() => {
                    navigator.clipboard.writeText(familyCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Both parents can add points and manage rewards.</p>
              <Button
                className="w-full"
                onClick={async () => {
                  // The code goes after '#', which browsers never send to the server.
                  const link = `${window.location.origin}/#${familyCode}`;
                  const shareText = `Join our family on Positive Percy: ${link}`;
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
                <Share2 className="w-4 h-4" />
                Share invite link
              </Button>
            </CardContent>
          </Card>
          </>
        )}

        <DeleteFamilyCard />

        {/* Parenting Tips - bottom link */}
        <button
          onClick={() => setShowTips(true)}
          className="w-full flex items-center justify-center gap-1 text-center text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors min-h-11 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Lightbulb className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
          Need help rewarding behaviour? View parenting tips
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
          await Child.create(buildChildCreatePayload(data));
          queryClient.invalidateQueries({ queryKey: ['children'] });
          setShowAddChild(false);
          toast.success("Child added.");
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
            queryClient.invalidateQueries({ queryKey: ['children'] });
            toast.success(`${data.name}'s profile updated.`);
          }}
          onDelete={async (child) => {
            await Child.delete(child.id);
            queryClient.invalidateQueries({ queryKey: ['children'] });
            setShowEditChild(false);
            setSelectedChild(null);
            toast.success(`${child.name} has been removed`);
          }}
        />
      )}
    </div>
  );
}
