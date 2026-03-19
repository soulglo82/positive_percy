import React, { useState } from 'react';
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, LogIn, Copy, Check, Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PERCY } from "@/constants/terminology";

export default function FamilyLogin() {
  const { createFamily, joinFamily, loginWithGoogle, requestMagicLink, needsFamily } = useAuth();
  const [mode, setMode] = useState(needsFamily ? 'family-setup' : null);
  const [familyMode, setFamilyMode] = useState(null); // 'create' | 'join'
  const [familyName, setFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleLogin = async (response) => {
    setLoading(true);
    try {
      const result = await loginWithGoogle(response.credential);
      if (result.needs_family) {
        setMode('family-setup');
      }
    } catch (error) {
      toast.error(error.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }
    setLoading(true);
    try {
      await requestMagicLink(email.trim());
      setMagicLinkSent(true);
      toast.success('Check your email for a sign-in link');
    } catch (error) {
      toast.error(error.message || 'Failed to send magic link');
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
      toast.error(error.message || 'Failed to create family');
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

  // Family code created — show success screen
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
            <Button onClick={handleCopy} variant="outline" className="w-full">
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

  // Magic link sent — show check email screen
  if (magicLinkSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-4 border-white shadow-2xl">
          <CardContent className="p-8 text-center space-y-6">
            <div className="text-6xl">📧</div>
            <h2 className="text-2xl font-bold text-slate-800">Check Your Email</h2>
            <p className="text-slate-600">
              We sent a sign-in link to <span className="font-semibold">{email}</span>
            </p>
            <p className="text-sm text-slate-500">
              The link expires in 15 minutes. Check your spam folder if you don't see it.
            </p>
            <Button onClick={() => { setMagicLinkSent(false); setEmail(''); }} variant="ghost" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Try a different email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Family setup (after Google/magic link auth, no family linked yet)
  if (mode === 'family-setup' || needsFamily) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-3">
            <img src="/logo.png" alt="Positive Percy" className="h-16 mx-auto" />
            <h1 className="text-2xl font-bold text-slate-800">Set Up Your Family</h1>
            <p className="text-slate-600">Create a new family or join an existing one</p>
          </div>

          {!familyMode && (
            <Card className="border-4 border-white shadow-2xl">
              <CardContent className="p-8 space-y-4">
                <Button
                  onClick={() => setFamilyMode('create')}
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
                  onClick={() => setFamilyMode('join')}
                  variant="outline"
                  className="w-full h-16 text-lg"
                >
                  <LogIn className="w-5 h-5 mr-3" />
                  Join with Code
                </Button>
              </CardContent>
            </Card>
          )}

          {familyMode === 'create' && (
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
                <Button onClick={() => setFamilyMode(null)} variant="ghost" className="w-full">Back</Button>
              </CardContent>
            </Card>
          )}

          {familyMode === 'join' && (
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
                </div>
                <Button
                  onClick={handleJoin}
                  disabled={joinCode.length < 6 || loading}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {loading ? 'Joining...' : 'Join Family'}
                </Button>
                <Button onClick={() => setFamilyMode(null)} variant="ghost" className="w-full">Back</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Main login screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        {/* Logo / Header */}
        <div className="text-center space-y-3">
          <img src="/logo.png" alt="Positive Percy" className="h-20 mx-auto" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Positive Percy
          </h1>
          <p className="text-slate-600">{PERCY.TAGLINE}</p>
        </div>

        <Card className="border-4 border-white shadow-2xl">
          <CardContent className="p-8 space-y-4">
            {/* Google Sign In */}
            {googleClientId && (
              <>
                <GoogleSignInButton clientId={googleClientId} onSuccess={handleGoogleLogin} disabled={loading} />
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-sm text-slate-400">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              </>
            )}

            {/* Magic Link */}
            {mode !== 'email' && mode !== 'legacy' && (
              <>
                <Button
                  onClick={() => setMode('email')}
                  variant="outline"
                  className="w-full h-14 text-base"
                >
                  <Mail className="w-5 h-5 mr-3" />
                  Sign in with Email
                </Button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-sm text-slate-400">existing users</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <Button
                  onClick={() => setMode('legacy')}
                  variant="ghost"
                  className="w-full text-slate-500"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign in with Family Code
                </Button>
              </>
            )}

            {/* Email magic link form */}
            {mode === 'email' && (
              <div className="space-y-4">
                <div>
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="text-lg mt-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()}
                    autoFocus
                  />
                </div>
                <Button
                  onClick={handleMagicLink}
                  disabled={!email.includes('@') || loading}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {loading ? 'Sending...' : 'Send Sign-In Link'}
                </Button>
                <Button onClick={() => setMode(null)} variant="ghost" className="w-full">Back</Button>
              </div>
            )}

            {/* Legacy family code login */}
            {mode === 'legacy' && (
              <div className="space-y-4">
                <Button
                  onClick={() => { setMode(null); setFamilyMode(null); setMode('family-setup'); setFamilyMode('create'); }}
                  className="w-full h-14 text-base bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <Plus className="w-5 h-5 mr-3" />
                  Create a Family
                </Button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-sm text-slate-400">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
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
                </div>
                <Button
                  onClick={handleJoin}
                  disabled={joinCode.length < 6 || loading}
                  className="w-full"
                  variant="outline"
                >
                  {loading ? 'Joining...' : 'Join with Code'}
                </Button>
                <Button onClick={() => setMode(null)} variant="ghost" className="w-full">Back</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

// Google Sign In Button component
function GoogleSignInButton({ clientId, onSuccess, disabled }) {
  const buttonRef = React.useRef(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    // Load Google Identity Services script
    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);

    function initGoogle() {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: onSuccess,
      });
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: buttonRef.current.offsetWidth,
          text: 'signin_with',
          shape: 'rectangular',
        });
      }
      setLoaded(true);
    }

    return () => {
      // Cleanup handled by Google
    };
  }, [clientId]);

  return (
    <div className="w-full">
      <div ref={buttonRef} className="w-full flex justify-center" style={{ minHeight: 44 }} />
      {!loaded && (
        <Button variant="outline" className="w-full h-14 text-base" disabled>
          Loading Google Sign In...
        </Button>
      )}
    </div>
  );
}
