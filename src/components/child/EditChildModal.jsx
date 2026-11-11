import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NumberInput from "@/components/ui/NumberInput";
import { Label } from "@/components/ui/label";
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
import { Pencil, X, Trash2 } from "lucide-react";
import { UploadFile } from "@/api/integrations";
import { toast } from "sonner";
import { PERCY } from "@/constants/terminology";
import { childColour } from "@/lib/childColour";
import { cn } from "@/lib/utils";

export default function EditChildModal({ isOpen, onClose, child, onSubmit, onDelete }) {
  const [name, setName] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState(50);
  const [age, setAge] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (child) {
      setName(child.name || "");
      setWeeklyTarget(child.weekly_target || 50);
      // An age stored before the 1 to 17 limit loads as empty, so it can't
      // block saving an unrelated change.
      setAge(child.age >= 1 && child.age <= 17 ? String(child.age) : "");
      setAvatarUrl(child.avatar_url || "");
      setAvatarPreview(child.avatar_url || "");
    }
  }, [child]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await UploadFile({ file });
      setAvatarUrl(file_url);
      setAvatarPreview(URL.createObjectURL(file));
      toast.success('Photo uploaded.');
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const ageInvalid = age !== "" && (Number(age) < 1 || Number(age) > 17);

  const handleSubmit = async () => {
    if (!name.trim() || saving) return;
    if (ageInvalid) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        weekly_target: weeklyTarget,
        age: age === "" ? null : Math.round(Number(age)),
        avatar_url: avatarUrl
      });
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
      toast.error(error.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (<>
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            Edit Child
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* Avatar Upload */}
          <div>
            <Label htmlFor="edit-child-photo" className="mb-2 block">
              Photo
            </Label>
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <div className="relative">
                  <img 
                    src={avatarPreview} 
                    alt="Avatar preview" 
                    className="w-20 h-20 rounded-full object-cover border-2 border-border"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl("");
                      setAvatarPreview("");
                    }}
                    aria-label="Remove photo"
                    className="absolute -top-3 -right-3 w-11 h-11 flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-card border border-input text-foreground shadow">
                      <X className="w-3 h-3" aria-hidden="true" />
                    </span>
                  </button>
                </div>
              ) : (
                <div className={cn("w-20 h-20 rounded-full flex items-center justify-center font-display text-title font-semibold text-foreground ring-2 ring-offset-2 ring-offset-card", childColour(child).soft, childColour(child).ring)} aria-hidden="true">
                  {name.charAt(0) || '?'}
                </div>
              )}
              <div className="flex-1">
                <Input
                  id="edit-child-photo"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {uploading ? 'Uploading...' : 'Upload a new photo'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="edit-child-name" className="mb-2 block">
              Child's Name
            </Label>
            <Input
              id="edit-child-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Emma"
              className="text-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div>
            <Label htmlFor="edit-child-age" className="mb-2 block">
              Age (optional)
            </Label>
            <Input
              id="edit-child-age"
              type="number"
              inputMode="numeric"
              min="1"
              max="17"
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
              placeholder="e.g., 7"
              className="text-lg"
              aria-invalid={ageInvalid}
              aria-describedby={ageInvalid ? "edit-child-age-error" : undefined}
            />
            {ageInvalid && (
              <p id="edit-child-age-error" role="alert" className="text-xs text-destructive mt-1">Age must be between 1 and 17.</p>
            )}
          </div>

          <div>
            <Label htmlFor="edit-child-target" className="mb-2 block">
              Weekly {PERCY.POINTS_COMPACT} Target
            </Label>
            <NumberInput
              id="edit-child-target"
              value={weeklyTarget}
              onChange={setWeeklyTarget}
              min="1"
              max="10000"
              className="text-lg font-semibold"
            />
          </div>

          <p className="text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">
            {child?.name || 'This child'} has <span className="font-semibold text-foreground">{child?.total_points ?? 0}</span> {PERCY.POINTS_COMPACT}.
            To change them, use Add Points so the change shows in the history.
          </p>

          {onDelete && (
            <div className="pt-4 border-t border-border">
              <Button
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4" />
                Delete Child
              </Button>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || uploading || saving || ageInvalid}
            className="flex-1"
          >
            {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {child?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {child?.name} and all their point history. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onDelete(child);
              setShowDeleteConfirm(false);
              onClose();
            }}
            variant="destructive"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>);
}
