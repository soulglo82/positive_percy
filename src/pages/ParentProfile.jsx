import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Save } from "lucide-react";
import { toast } from "sonner";

export default function ParentProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    mum_name: '',
    dad_name: '',
    mum_phone: '',
    dad_phone: '',
  });

  useEffect(() => {
    base44.auth.me().then(userData => {
      setUser(userData);
      setFormData({
        mum_name: userData.mum_name || '',
        dad_name: userData.dad_name || '',
        mum_phone: userData.mum_phone || '',
        dad_phone: userData.dad_phone || '',
      });
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await base44.auth.updateMe(formData);
      toast.success("Profile updated successfully!");
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <User className="w-8 h-8 text-purple-500" />
          <h1 className="text-3xl font-bold text-slate-800">Parent Profile</h1>
        </div>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-600">Email</Label>
              <p className="text-lg font-medium text-slate-800">{user?.email}</p>
            </div>
            <div>
              <Label className="text-slate-600">Full Name</Label>
              <p className="text-lg font-medium text-slate-800">{user?.full_name}</p>
            </div>
          </CardContent>
        </Card>

        {/* Parent Details */}
        <Card>
          <CardHeader>
            <CardTitle>Parent Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Mum Details */}
              <div className="space-y-4 p-4 bg-pink-50 rounded-lg">
                <h3 className="font-semibold text-slate-800">Mum's Information</h3>
                <div>
                  <Label htmlFor="mum_name">Name</Label>
                  <Input
                    id="mum_name"
                    value={formData.mum_name}
                    onChange={(e) => handleChange('mum_name', e.target.value)}
                    placeholder="e.g., Sarah"
                  />
                </div>
                <div>
                  <Label htmlFor="mum_phone">Phone Number</Label>
                  <Input
                    id="mum_phone"
                    value={formData.mum_phone}
                    onChange={(e) => handleChange('mum_phone', e.target.value)}
                    placeholder="e.g., 07700 900000"
                  />
                </div>
              </div>

              {/* Dad Details */}
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-slate-800">Dad's Information</h3>
                <div>
                  <Label htmlFor="dad_name">Name</Label>
                  <Input
                    id="dad_name"
                    value={formData.dad_name}
                    onChange={(e) => handleChange('dad_name', e.target.value)}
                    placeholder="e.g., John"
                  />
                </div>
                <div>
                  <Label htmlFor="dad_phone">Phone Number</Label>
                  <Input
                    id="dad_phone"
                    value={formData.dad_phone}
                    onChange={(e) => handleChange('dad_phone', e.target.value)}
                    placeholder="e.g., 07700 900000"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save Profile'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
