import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Home, Gift, History, User, UserCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function Layout({ children, currentPageName }) {
  const { logout } = useAuth();
  const navItems = [
    { name: 'ParentDashboard', label: 'Dashboard', icon: Home },
    { name: 'Summary', label: 'Summary', icon: History },
    { name: 'Rewards', label: 'Rewards', icon: Gift },
    { name: 'ChildView', label: 'Child View', icon: User },
    { name: 'ParentProfile', label: 'Profile', icon: UserCircle },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <Link 
              to={createPageUrl('ParentDashboard')}
              className="flex items-center"
            >
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6922d1673349deb31c162ae5/46a4a0d5e_82981AEC-56DC-4F47-88A7-BE6A182A15D7.png"
                alt="Positive Percy Logo"
                className="h-12"
              />
            </Link>

            <div className="flex gap-1 items-center">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.name;

                return (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.name)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all ml-2"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
