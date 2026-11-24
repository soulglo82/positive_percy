// V1-E Settings (approved design 9de1df2, screen "settings";
// docs/engineering/V1-E-DESIGN.md). Four groups of rows; each Edit or View
// opens a dialog holding the shipped controls. The technical JSON export tile
// is gone (the endpoint stays: the Family Report uses it).
import { useRef, useState } from 'react';
import { Child } from "@/api/entities";
import { buildChildCreatePayload } from "@/lib/childPayload";
import { useAuth, getToken } from "@/lib/AuthContext";
import { downloadFamilyReport } from "@/lib/familyReport";
import { childOrder, childColour } from "@/lib/childColour";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody,
} from "@/components/ui/dialog";
import { Save, Copy, Check, Share2, UserPlus } from "lucide-react";
import PercyIcon from "@/components/icons/PercyIcon";
import { toast } from "sonner";
import { Points } from "@/components/brand/PointsStar";
import ChildAvatar from "../components/child/ChildAvatar";
import ParentingTips from "../components/ParentingTips";
import AddChildModal from "../components/child/AddChildModal";
import EditChildModal from "../components/child/EditChildModal";
import BehaviorCategoryManager from "../components/settings/BehaviorCategoryManager";
import FamilyTimezone from "../components/settings/FamilyTimezone";
import ManageGoalsDialog from "../components/dashboard/ManageGoalsDialog";

// One approved row: title, subtitle, and an action (a button named for the
// row, or a status label).
export function SettingsRow({ title, subtitle, action, actionLabel, onAction, status, disabled }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-border last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground break-words">{title}</p>
        {subtitle && <p className="text-sm text-muted-foreground break-words">{subtitle}</p>}
      </div>
      {status ? (
        <span className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{status}</span>
      ) : action ? (
        <Button variant="outline" className="shrink-0" onClick={onAction} disabled={disabled}
          aria-label={actionLabel || `${action} ${title}`}>
          {action}
        </Button>
      ) : null}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <h2 className="font-display font-bold text-lg text-primary mb-1">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function RowDialog({ open, onClose, title, description, children }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-title font-extrabold text-primary">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export default function ParentProfile() {
  const { user, familyCode, refreshUser, setFamilyName: showFamilyName } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(null); // which row dialog is open
  const [reporting, setReporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showAddChild, setShowAddChild] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const addChildRef = useRef(null);

  const { data: children = [] } = useQuery({
    queryKey: ['children'],
    queryFn: () => Child.list(),
    enabled: !!user,
  });
  const { data: behaviorCategories = [] } = useQuery({
    queryKey: ['behaviorCategories'],
    queryFn: async () => {
      const res = await fetch('/api/behavior-categories', { headers: { Authorization: `Bearer ${getToken()}` } });
      return res.ok ? res.json() : [];
    },
    enabled: !!user,
  });

  const ordered = [...children].sort(childOrder);
  // The family's own name only (owner: one source for Settings and the report).
  const currentName = user?.family?.family_name || '';
  const close = () => setOpen(null);

  const openFamilyName = () => { setFamilyName(currentName); setOpen('name'); };
  const saveFamilyName = async (e) => {
    e.preventDefault();
    if (savingName) return;
    setSavingName(true);
    try {
      const res = await fetch('/api/family/name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ family_name: familyName }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to update');
      showFamilyName(body.family_name);
      refreshUser(); // best effort; never signs out
      toast.success("Family name updated.");
      close();
    } catch (error) {
      toast.error(error.message || "Failed to update");
    } finally {
      setSavingName(false);
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

  const shareInvite = async () => {
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
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="font-display font-extrabold text-title text-primary">Family settings</h1>
          <p className="text-muted-foreground">Make Percy work for your family.</p>
        </div>

        <Group title="Behaviours & Quick Points">
          <SettingsRow title="Positive behaviour categories" subtitle="Names, point values and approved icons" action="Edit" onAction={() => setOpen('behaviours')} />
          <SettingsRow title="Quick Points" subtitle="Choose your quick award buttons for Home" action="Edit" onAction={() => setOpen('quick')} />
          {/* D6: read-only; the server's default is 1 point. */}
          <SettingsRow title="Point defaults" subtitle="New behaviours and Quick Points start at 1 point" />
        </Group>

        <Group title="Children, Daily Wins & Big Goals">
          <SettingsRow title="Children" subtitle="Profiles, avatars and weekly targets" action="Edit" onAction={() => setOpen('children')} />
          <SettingsRow title="Daily Wins & Big Goals" subtitle="Things to do and things to save for" action="Edit" onAction={() => setOpen('goals')} disabled={ordered.length === 0} />
          <SettingsRow title="Family timezone" subtitle="Determines today’s date and weekly schedule" action="Edit" onAction={() => setOpen('timezone')} />
        </Group>

        <Group title="Family & access">
          <SettingsRow title="Family name" subtitle="How your family appears in Percy" action="Edit" onAction={openFamilyName} />
          <SettingsRow title="Invite parent" subtitle="Available with existing family invitation flow" action="View" onAction={() => setOpen('invite')} disabled={!familyCode} />
          <SettingsRow title="Shared carers" subtitle="Permission-enforced access is still a launch gate" status="Planned" />
        </Group>

        <Group title="Reports & privacy">
          <SettingsRow title="Family Report (PDF)" subtitle="Printable achievements and recent history"
            action={reporting ? 'Creating your report…' : 'Download'} actionLabel={reporting ? undefined : 'Download Family Report (PDF)'}
            onAction={handleDownloadReport} disabled={reporting} />
          <SettingsRow title="Privacy & account controls" subtitle="Release only after legal and restore gates" status="Review" />
        </Group>

        {/* Parenting Tips - bottom link */}
        <button
          onClick={() => setShowTips(true)}
          className="w-full flex items-center justify-center gap-1 text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors min-h-11 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PercyIcon id="phosphor:info:duotone" className="w-4 h-4" />
          Need help rewarding behaviour? View parenting tips
        </button>

        {/* E03: CC BY 4.0 / MIT attribution. DRAFT wording, pending owner approval
            (E03 design, decision 3). The file is public, so it needs no login. */}
        <a
          href="/licenses/CREDITS.txt"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 min-h-11 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Credits and licences
        </a>
      </div>

      <RowDialog open={open === 'behaviours'} onClose={close} title="Positive behaviour categories" description="Names, point values and approved icons">
        <BehaviorCategoryManager embedded />
      </RowDialog>
      <RowDialog open={open === 'quick'} onClose={close} title="Quick Points" description="Choose your quick award buttons for Home">
        <BehaviorCategoryManager embedded mode="quick" />
      </RowDialog>
      <RowDialog open={open === 'timezone'} onClose={close} title="Family timezone" description="Determines today’s date and weekly schedule">
        <FamilyTimezone embedded />
      </RowDialog>

      <RowDialog open={open === 'children'} onClose={close} title="Children" description="Profiles, avatars and weekly targets">
        <div className="space-y-2">
          {ordered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">No children added yet.</p>
          ) : (
            <div className="space-y-1.5">
              {ordered.map((child) => (
                <div key={child.id} className="flex items-center justify-between gap-2 pl-3 pr-1 py-1 rounded-md bg-muted border border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <ChildAvatar name={child.name} url={child.avatar_url} size="sm" colour={childColour(child, ordered)} />
                    <span className="font-medium text-foreground min-w-0 break-words">{child.name}</span>
                    <Points value={child.total_points} className="text-sm text-muted-foreground font-semibold" />
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${child.name}`} onClick={() => setSelectedChild(child)}>
                    <PercyIcon id="phosphor:pencil:duotone" className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button ref={addChildRef} variant="outline" className="w-full" onClick={() => setShowAddChild(true)}>
            <UserPlus className="w-4 h-4" />
            Add child
          </Button>
        </div>
      </RowDialog>

      <RowDialog open={open === 'name'} onClose={close} title="Family name" description="How your family appears in Percy">
        <form onSubmit={saveFamilyName} className="flex gap-2">
          <Input
            aria-label="Family name"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="e.g., The Smiths"
            maxLength={100}
            className="flex-1"
          />
          <Button type="submit" disabled={savingName}>
            <Save className="w-4 h-4" />
            {savingName ? 'Saving...' : 'Save'}
          </Button>
        </form>
      </RowDialog>

      <RowDialog open={open === 'invite'} onClose={close} title="Invite parent" description="Available with existing family invitation flow">
        <div className="space-y-3">
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
          <Button className="w-full" onClick={shareInvite}>
            <Share2 className="w-4 h-4" />
            Share invite link
          </Button>
        </div>
      </RowDialog>

      {ordered.length > 0 && (
        <ManageGoalsDialog open={open === 'goals'} onClose={close} child={ordered[0]} children={children}
          categories={behaviorCategories} />
      )}

      <ParentingTips isOpen={showTips} onClose={() => setShowTips(false)} />

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
          isOpen
          onClose={() => setSelectedChild(null)}
          child={selectedChild}
          onSubmit={async (data) => {
            await Child.update(selectedChild.id, data);
            queryClient.invalidateQueries({ queryKey: ['children'] });
            toast.success(`${data.name}'s profile updated.`);
          }}
          onDelete={async (child) => {
            await Child.delete(child.id);
            queryClient.invalidateQueries({ queryKey: ['children'] });
            setSelectedChild(null);
            toast.success(`${child.name} has been removed`);
            // The child's Edit button is gone: focus the next sensible control.
            setTimeout(() => addChildRef.current?.focus(), 0);
          }}
        />
      )}
    </div>
  );
}
