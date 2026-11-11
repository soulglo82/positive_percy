import { useEffect, useState } from 'react';
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, LogIn, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/brand/Logo";
import { PERCY } from "@/constants/terminology";
import { takeInviteCode } from "@/lib/invite";

export default function FamilyLogin() {
  const { createFamily, joinFamily } = useAuth();
  const [mode, setMode] = useState(null); // null, 'create', 'join'
  const [familyName, setFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);
  const [copied, setCopied] = useState(false);

  // Opened from an invite link: go straight to join with the code filled in.
  useEffect(() => {
    const code = takeInviteCode();
    if (code) {
      setJoinCode(code);
      setMode('join');
    }
  }, []);

  const handleCreate = async () => {
    if (!familyName.trim()) return;
    setLoading(true);
    try {
      const family = await createFamily(familyName.trim());
      setCreatedCode(family.family_code);
    } catch (error) {
      toast.error('Failed to create family');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    try {
      await joinFamily(joinCode.trim());
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdCode);
    setCopied(true);
    toast.success('Code copied.');
    setTimeout(() => setCopied(false), 2000);
  };

  if (createdCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            <Logo size={64} decorative className="justify-center" />
            <h2 className="text-title font-semibold text-foreground">Family Created!</h2>
            <p className="text-muted-foreground">
              Share this code with the other parent so they can join:
            </p>
            <div className="rounded-md bg-muted border border-border p-6">
              <div className="text-total font-mono font-semibold text-foreground">
                {createdCode}
              </div>
            </div>
            <Button
              onClick={handleCopy}
              variant="outline"
              className="w-full"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </Button>
            <p className="text-xs text-muted-foreground">
              You're all set! The dashboard is loading...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        {/* Logo / Header */}
        <div className="text-center space-y-3">
          <Logo size={96} decorative className="justify-center" />
          <h1 className="font-display text-total font-semibold text-brand-ink">
            Positive Percy
          </h1>
          <p className="text-muted-foreground">{PERCY.TAGLINE}</p>
        </div>

        {!mode && (
          <Card>
            <CardContent className="p-8 space-y-4">
              <Button
                onClick={() => setMode('create')}
                size="lg"
                className="w-full text-base"
              >
                <Plus className="w-5 h-5" />
                Create a Family
              </Button>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-sm text-subtle-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <Button
                onClick={() => setMode('join')}
                variant="outline"
                size="lg"
                className="w-full text-base"
              >
                <LogIn className="w-5 h-5" />
                Enter Family Code
              </Button>
              <p className="text-sm text-muted-foreground text-center -mt-2">Got a code from the other parent? Enter it here.</p>
            </CardContent>
          </Card>
        )}

        {mode === 'create' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                Create Your Family
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="family-name">Family Name</Label>
                <Input
                  id="family-name"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="e.g., The Smiths"
                  className="text-lg mt-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={!familyName.trim() || loading}
                className="w-full"
              >
                {loading ? 'Creating...' : 'Create Family'}
              </Button>
              <Button
                onClick={() => setMode(null)}
                variant="ghost"
                className="w-full"
              >
                Back
              </Button>
            </CardContent>
          </Card>
        )}

        {mode === 'join' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                Join Your Family
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="family-code">Family Code</Label>
                <Input
                  id="family-code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g., ABC123"
                  className="text-lg mt-1 font-mono text-center"
                  maxLength={6}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Enter the 6-character code the other parent shared with you.
                </p>
              </div>
              <Button
                onClick={handleJoin}
                disabled={joinCode.length < 6 || loading}
                className="w-full"
              >
                {loading ? 'Joining...' : 'Join Family'}
              </Button>
              <Button
                onClick={() => setMode(null)}
                variant="ghost"
                className="w-full"
              >
                Back
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
