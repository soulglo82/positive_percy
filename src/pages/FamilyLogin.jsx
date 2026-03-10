import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, LogIn, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function FamilyLogin() {
  const { createFamily, joinFamily, googleSignIn } = useAuth();
  const [mode, setMode] = useState(null); // null, 'create', 'join'
  const [familyName, setFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);
  const [copied, setCopied] = useState(false);

  // Google auth state
  const [googleCredential, setGoogleCredential] = useState(null);
  const [googleUser, setGoogleUser] = useState(null); // { name, email } when needs_action
  const googleBtnRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || typeof window.google === 'undefined') return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse,
    });

    if (googleBtnRef.current) {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: 'continue_with',
        shape: 'pill',
      });
    }
  }, [mode]);

  const handleGoogleResponse = async (response) => {
    const credential = response.credential;
    setLoading(true);
    try {
      // Try auto-login first (existing user with a family)
      const result = await googleSignIn(credential);
      if (result.needs_action) {
        // New Google user — save credential and ask them to create or join
        setGoogleCredential(credential);
        setGoogleUser({ name: result.google_name, email: result.google_email });
        setFamilyName(result.google_name ? `${result.google_name}'s Family` : '');
      } else if (result.returning_user) {
        toast.success('Welcome back!');
      }
    } catch (error) {
      toast.error(error.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCreate = async () => {
    if (!familyName.trim() || !googleCredential) return;
    setLoading(true);
    try {
      const result = await googleSignIn(googleCredential, 'create', { family_name: familyName.trim() });
      setCreatedCode(result.family_code);
    } catch (error) {
      toast.error(error.message || 'Failed to create family');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleJoin = async () => {
    if (joinCode.length < 6 || !googleCredential) return;
    setLoading(true);
    try {
      await googleSignIn(googleCredential, 'join', { family_code: joinCode.trim() });
    } catch (error) {
      toast.error(error.message || 'Failed to join family');
    } finally {
      setLoading(false);
    }
  };

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
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (createdCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-4 border-white shadow-2xl">
          <CardContent className="p-8 text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold text-slate-800">Family Created!</h2>
            <p className="text-slate-600">
              Share this code with the other parent so they can join:
            </p>
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-6">
              <div className="text-4xl font-mono font-bold tracking-widest text-purple-700">
                {createdCode}
              </div>
            </div>
            <Button
              onClick={handleCopy}
              variant="outline"
              className="w-full"
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </Button>
            <p className="text-xs text-slate-500">
              You're all set! The dashboard is loading...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Google user needs to create or join a family
  if (googleUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-3">
            <div className="text-6xl">⭐</div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Welcome, {googleUser.name}!
            </h1>
            <p className="text-slate-600">Signed in as {googleUser.email}</p>
          </div>

          {!mode && (
            <Card className="border-4 border-white shadow-2xl">
              <CardContent className="p-8 space-y-4">
                <p className="text-center text-slate-600 text-sm">What would you like to do?</p>
                <Button
                  onClick={() => setMode('create')}
                  className="w-full h-16 text-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <Plus className="w-5 h-5 mr-3" />
                  Create a Family
                </Button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-sm text-slate-400">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <Button
                  onClick={() => setMode('join')}
                  variant="outline"
                  className="w-full h-16 text-lg"
                >
                  <LogIn className="w-5 h-5 mr-3" />
                  Join with Code
                </Button>
                <Button
                  onClick={() => { setGoogleUser(null); setGoogleCredential(null); setMode(null); }}
                  variant="ghost"
                  className="w-full text-slate-400"
                >
                  Use a different account
                </Button>
              </CardContent>
            </Card>
          )}

          {mode === 'create' && (
            <Card className="border-4 border-white shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  Create Your Family
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Family Name</Label>
                  <Input
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="e.g., The Smiths"
                    className="text-lg mt-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleGoogleCreate()}
                  />
                </div>
                <Button
                  onClick={handleGoogleCreate}
                  disabled={!familyName.trim() || loading}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
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
            <Card className="border-4 border-white shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LogIn className="w-5 h-5 text-purple-500" />
                  Join Your Family
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Family Code</Label>
                  <Input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g., ABC123"
                    className="text-lg mt-1 font-mono tracking-widest text-center"
                    maxLength={6}
                    onKeyDown={(e) => e.key === 'Enter' && handleGoogleJoin()}
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Ask the other parent for the 6-character family code
                  </p>
                </div>
                <Button
                  onClick={handleGoogleJoin}
                  disabled={joinCode.length < 6 || loading}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        {/* Logo / Header */}
        <div className="text-center space-y-3">
          <div className="text-6xl">⭐</div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Positive Percy
          </h1>
          <p className="text-slate-600">Building bright futures, one point at a time</p>
        </div>

        {!mode && (
          <Card className="border-4 border-white shadow-2xl">
            <CardContent className="p-8 space-y-4">
              {GOOGLE_CLIENT_ID && (
                <>
                  <div ref={googleBtnRef} className="flex justify-center" />
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-sm text-slate-400">or</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                </>
              )}
              <Button
                onClick={() => setMode('create')}
                className="w-full h-16 text-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Plus className="w-5 h-5 mr-3" />
                Create a Family
              </Button>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-sm text-slate-400">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <Button
                onClick={() => setMode('join')}
                variant="outline"
                className="w-full h-16 text-lg"
              >
                <LogIn className="w-5 h-5 mr-3" />
                Join with Code
              </Button>
            </CardContent>
          </Card>
        )}

        {mode === 'create' && (
          <Card className="border-4 border-white shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                Create Your Family
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Family Name</Label>
                <Input
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
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
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
          <Card className="border-4 border-white shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="w-5 h-5 text-purple-500" />
                Join Your Family
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Family Code</Label>
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g., ABC123"
                  className="text-lg mt-1 font-mono tracking-widest text-center"
                  maxLength={6}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Ask the other parent for the 6-character family code
                </p>
              </div>
              <Button
                onClick={handleJoin}
                disabled={joinCode.length < 6 || loading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
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
