import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Upload, X } from "lucide-react";
import { UploadFile } from "@/api/integrations";
import { toast } from "sonner";

export default function AddChildModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState(50);
  const [startingPoints, setStartingPoints] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState("");

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
      toast.success('Photo uploaded!');
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), weeklyTarget, startingPoints, avatar_url: avatarUrl });
      setName("");
      setWeeklyTarget(50);
      setStartingPoints(0);
      setAvatarUrl("");
      setAvatarPreview("");
      onClose();
    } catch (error) {
      console.error('Add child failed:', error);
      toast.error(error.message || 'Failed to add child');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <UserPlus className="w-6 h-6 text-purple-500" />
            Add Child
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Avatar Upload */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Photo (optional)
            </Label>
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <div className="relative">
                  <img 
                    src={avatarPreview} 
                    alt="Avatar preview" 
                    className="w-20 h-20 rounded-full object-cover border-4 border-purple-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl("");
                      setAvatarPreview("");
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-purple-500" />
                </div>
              )}
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="cursor-pointer"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {uploading ? 'Uploading...' : 'Upload a photo'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Child's Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Emma"
              className="text-lg"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Weekly Points Target
            </Label>
            <Input
              type="number"
              value={weeklyTarget}
              onChange={(e) => setWeeklyTarget(Number(e.target.value))}
              min="1"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-slate-500 mt-2">
              Goal they'll work towards each week
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 block">
              Starting Points (optional)
            </Label>
            <Input
              type="number"
              value={startingPoints}
              onChange={(e) => setStartingPoints(Number(e.target.value))}
              min="0"
              className="text-lg font-semibold"
            />
            <p className="text-xs text-slate-500 mt-2">
              Give them bonus points to start with
            </p>
          </div>
        </div>

        <div className="flex gap-3">
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
            disabled={!name.trim() || uploading || saving}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Add Child'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
