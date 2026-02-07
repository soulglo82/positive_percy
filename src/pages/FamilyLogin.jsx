import React, { useState } from 'react';
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, LogIn, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function FamilyLogin() {
  const { createFamily, joinFamily } = useAuth();
  const [mode, setMode] = useState(null); // null, 'create', 'join'
  const [familyName, setFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);
  const [copied, setCopied] = useState(false);

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
