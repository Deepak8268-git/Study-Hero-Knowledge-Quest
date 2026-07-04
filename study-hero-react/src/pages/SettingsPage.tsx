import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import EmptyState from '../components/EmptyState';
import SkeletonBlock from '../components/LoadingStates';
import { useTheme } from '../context/ThemeContext';
import { apiRequest, getAuthToken, logoutAll } from '../services/api';

interface ProfileForm {
  username: string;
  email: string;
  specialization?: string;
  qualification?: string;
  experience_years?: number | string;
  bio?: string;
  profile_picture?: string;
  enrollment_number?: string;
  department?: string;
  semester?: string;
  batch?: string;
}

const notificationPreferenceKey = 'studyHeroNotificationPreferences';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();
  const [profile, setProfile] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notificationPrefs, setNotificationPrefs] = useState(() => {
    const stored = localStorage.getItem(notificationPreferenceKey);
    return stored ? JSON.parse(stored) as Record<string, boolean> : { inApp: true, email: true, highPriorityOnly: false };
  });

  useEffect(() => {
    if (!getAuthToken()) {
      navigate('/login');
      return;
    }

    const loadProfile = async () => {
      try {
        const data = await apiRequest<ProfileForm>('/api/users/profile');
        setProfile(data);
      } catch (err: any) {
        setError(err.message || 'Unable to load settings.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const updateProfile = (field: keyof ProfileForm, value: string) => {
    setProfile((current) => current ? { ...current, [field]: value } : current);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;

    try {
      setSaving(true);
      await apiRequest('/api/users/profile', { method: 'PUT', body: JSON.stringify(profile) });
      setMessage('Settings saved.');
      setError('');
    } catch (err: any) {
      setError(err.message || 'Unable to save settings.');
    } finally {
      setSaving(false);
      window.setTimeout(() => setMessage(''), 3000);
    }
  };

  const updateNotificationPref = (key: string, value: boolean) => {
    const next = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(next);
    localStorage.setItem(notificationPreferenceKey, JSON.stringify(next));
  };

  const handleLogoutAll = async () => {
    await logoutAll();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 enterprise-page">
      <Header />
      <main className="flex-grow pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
            <p className="text-gray-600 mt-2">Manage your account preferences and security controls.</p>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl shadow-md p-6"><SkeletonBlock rows={8} /></div>
          ) : error && !profile ? (
            <EmptyState icon="ri-error-warning-line" title="Unable to load settings" message={error} />
          ) : profile && (
            <form onSubmit={saveProfile} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <section className="lg:col-span-2 bg-white rounded-xl shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Profile Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="text-sm text-gray-600">
                    Username
                    <input value={profile.username || ''} onChange={(e) => updateProfile('username', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                  </label>
                  <label className="text-sm text-gray-600">
                    Email
                    <input type="email" value={profile.email || ''} onChange={(e) => updateProfile('email', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                  </label>
                  <label className="text-sm text-gray-600 md:col-span-2">
                    Bio
                    <textarea value={profile.bio || ''} onChange={(e) => updateProfile('bio', e.target.value)} rows={4} className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                  </label>
                  {'specialization' in profile && (
                    <label className="text-sm text-gray-600">
                      Specialization
                      <input value={profile.specialization || ''} onChange={(e) => updateProfile('specialization', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                    </label>
                  )}
                  {'department' in profile && (
                    <label className="text-sm text-gray-600">
                      Department
                      <input value={profile.department || ''} onChange={(e) => updateProfile('department', e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
                    </label>
                  )}
                </div>
              </section>

              <aside className="space-y-6">
                <section className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Theme</h2>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label="Theme preference">
                    {(['light', 'dark', 'system'] as const).map((item) => (
                      <button key={item} type="button" onClick={() => setPreference(item)} className={`px-3 py-2 rounded-md text-sm capitalize ${preference === item ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {item}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Notifications</h2>
                  {[
                    ['inApp', 'In-app notifications'],
                    ['email', 'Email notifications'],
                    ['highPriorityOnly', 'High priority only']
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between py-2 text-sm text-gray-700">
                      {label}
                      <input type="checkbox" checked={!!notificationPrefs[key]} onChange={(e) => updateNotificationPref(key, e.target.checked)} className="h-4 w-4" />
                    </label>
                  ))}
                </section>

                <section className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Security</h2>
                  <div className="space-y-3">
                    <Link to="/change-password" className="block w-full text-center px-4 py-2 bg-primary text-white rounded-md">Change Password</Link>
                    <button type="button" onClick={handleLogoutAll} className="w-full px-4 py-2 border border-danger text-danger rounded-md">Log out all devices</button>
                  </div>
                </section>
              </aside>

              <div className="lg:col-span-3 flex items-center justify-between">
                <div className="text-sm">
                  {message && <span className="text-success">{message}</span>}
                  {error && <span className="text-danger">{error}</span>}
                </div>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-primary text-white rounded-md disabled:opacity-70">
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SettingsPage;