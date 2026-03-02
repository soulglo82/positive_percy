import React, { useState } from 'react';
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Save, Copy, Check, Share2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import OnboardingTips from "../components/OnboardingTips";

export default function ParentProfile() {
  const { user, familyCode, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [familyName, setFamilyName] = useState(user?.full_name || '');
  const [showTips, setShowTips] = useState(false);

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
    </div>
  );
}
