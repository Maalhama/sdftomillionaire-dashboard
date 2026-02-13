'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Save,
  Loader2,
  Braces,
  ChevronUp,
  Download,
  Shield,
  Clock,
  Terminal,
  LogOut,
} from 'lucide-react';

interface UserPrompt {
  id: string;
  content: string;
  status: string;
  votes_count: number;
  created_at: string;
}

export default function ProfilePage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [myPrompts, setMyPrompts] = useState<UserPrompt[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    async function fetchMyPrompts() {
      const { data } = await supabase
        .from('user_prompts')
        .select('id, content, status, votes_count, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setMyPrompts(data);
    }
    fetchMyPrompts();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError(null);

    const { error } = await supabase
      .from('profiles')
      .update({
        username: username.trim() || null,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      if (error.code === '23505') {
        setSaveError('Ce username est déjà pris.');
      } else {
        setSaveError('Erreur lors de la sauvegarde.');
      }
    } else {
      await refreshProfile();
      setEditing(false);
    }
    setSaving(false);
  };

  if (loading || !user) {
    return (
      <div className="bg-grid min-h-screen flex items-center justify-center">
        <div className="text-hacker-muted font-mono">
          <span className="animate-blink">_</span> Chargement...
        </div>
      </div>
    );
  }

  const statusBadge: Record<string, { label: string; class: string }> = {
    pending: { label: 'En attente', class: 'badge badge-muted' },
    evaluating: { label: 'Analyse...', class: 'badge badge-amber' },
    evaluated: { label: 'Vote ouvert', class: 'badge badge-live' },
    winner: { label: 'Gagnant', class: 'badge badge-live' },
    building: { label: 'En construction', class: 'badge badge-amber' },
    closed: { label: 'Clos', class: 'badge badge-muted' },
  };

  return (
    <div className="bg-grid min-h-screen">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <p className="text-hacker-green text-sm mb-2 font-mono">// profil × stats × historique</p>
        <h1 className="text-3xl font-bold text-white mb-8">Mon Profil</h1>

        {/* Profile Card */}
        <div className="card p-6 mb-8">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full border-2 border-hacker-green/30" />
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-hacker-green/30 bg-hacker-green/10 flex items-center justify-center">
                <span className="text-2xl text-hacker-green font-bold">
                  {(profile?.display_name || user.email || '?')[0].toUpperCase()}
                </span>
              </div>
            )}

            <div className="flex-1">
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-hacker-muted font-mono block mb-1">username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      placeholder="ton_username"
                      maxLength={30}
                      className="w-full px-3 py-2 bg-hacker-terminal border border-hacker-border rounded text-sm text-white placeholder-hacker-muted font-mono focus:border-hacker-green/50 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-hacker-muted font-mono block mb-1">nom affiché</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ton nom"
                      maxLength={50}
                      className="w-full px-3 py-2 bg-hacker-terminal border border-hacker-border rounded text-sm text-white placeholder-hacker-muted font-mono focus:border-hacker-green/50 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-hacker-muted font-mono block mb-1">bio <span className="text-hacker-muted">({bio.length}/280)</span></label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="En quelques mots..."
                      maxLength={280}
                      rows={2}
                      className="w-full px-3 py-2 bg-hacker-terminal border border-hacker-border rounded text-sm text-white placeholder-hacker-muted font-mono focus:border-hacker-green/50 focus:outline-none transition-all resize-none"
                    />
                  </div>
                  {saveError && <p className="text-xs text-hacker-red font-mono">{saveError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Sauvegarder
                    </button>
                    <button onClick={() => setEditing(false)} className="btn-secondary text-sm">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-white">{profile?.display_name || 'Anonyme'}</h2>
                    {profile?.username && (
                      <span className="text-xs text-hacker-muted font-mono">@{profile.username}</span>
                    )}
                    <button
                      onClick={() => setEditing(true)}
                      className="text-hacker-muted hover:text-hacker-green transition-colors ml-auto"
                    >
                      <Terminal className="w-4 h-4" />
                    </button>
                  </div>
                  {profile?.bio && <p className="text-sm text-hacker-muted-light mb-2">{profile.bio}</p>}
                  <div className="flex items-center gap-3 text-xs text-hacker-muted font-mono">
                    <span>{user.email}</span>
                    {profile?.provider && <span className="badge badge-muted">{profile.provider}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(profile?.created_at || user.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card p-4 text-center">
            <Braces className="w-5 h-5 text-hacker-green mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{profile?.prompts_count || myPrompts.length}</div>
            <div className="text-xs text-hacker-muted font-mono">idées soumises</div>
          </div>
          <div className="card p-4 text-center">
            <ChevronUp className="w-5 h-5 text-hacker-cyan mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{profile?.votes_count || 0}</div>
            <div className="text-xs text-hacker-muted font-mono">votes donnés</div>
          </div>
          <div className="card p-4 text-center">
            <Download className="w-5 h-5 text-hacker-amber mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{profile?.downloads_count || 0}</div>
            <div className="text-xs text-hacker-muted font-mono">téléchargements</div>
          </div>
        </div>

        {/* My Prompts */}
        <div className="mb-8">
          <h3 className="text-sm uppercase tracking-wider text-hacker-green mb-4 font-mono">
            // mes idées soumises
          </h3>
          {myPrompts.length === 0 ? (
            <div className="card p-6 text-center">
              <Braces className="w-6 h-6 text-hacker-muted mx-auto mb-2" />
              <p className="text-sm text-hacker-muted font-mono">Aucune idée soumise pour le moment.</p>
              <Link href="/" className="text-xs text-hacker-green hover:underline font-mono mt-2 inline-block">
                Soumettre ta première idée →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myPrompts.map(prompt => {
                const badge = statusBadge[prompt.status] || statusBadge.pending;
                return (
                  <Link key={prompt.id} href="/gallery" className="card p-4 block hover:border-hacker-green/30 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={badge.class}>{badge.label}</span>
                          {prompt.status === 'winner' && <Shield className="w-3.5 h-3.5 text-hacker-amber" />}
                        </div>
                        <p className="text-sm text-hacker-text truncate">&ldquo;{prompt.content}&rdquo;</p>
                        <span className="text-[11px] text-hacker-muted font-mono">
                          {new Date(prompt.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-hacker-muted shrink-0">
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span className="text-xs font-mono">{prompt.votes_count}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Déconnexion */}
        <div className="mb-8">
          <div className="card p-6 border border-hacker-red/20">
            <h3 className="text-sm uppercase tracking-wider text-hacker-red mb-3 font-mono">
              // session
            </h3>
            <p className="text-sm text-hacker-muted-light mb-4">
              Connecté en tant que <span className="text-white font-mono">{user.email}</span>
              {profile?.provider && (
                <span className="ml-2 badge badge-muted text-[10px]">{profile.provider}</span>
              )}
            </p>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2.5 rounded border border-hacker-red/30 text-hacker-red hover:bg-hacker-red/10 hover:border-hacker-red/50 transition-all text-sm font-mono"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </div>

        {/* Back */}
        <Link href="/gallery" className="btn-secondary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour à la galerie
        </Link>
      </section>
    </div>
  );
}
