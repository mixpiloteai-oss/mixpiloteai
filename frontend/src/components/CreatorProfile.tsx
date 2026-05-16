// ============================================================
// NEUROTEK AI — Creator Profile Component
// Marketplace profile: avatar, stats, bio, packs, social links
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  Download,
  Package,
  Edit3,
  Check,
  X,
  UserPlus,
  UserCheck,
  ExternalLink,
  Calendar,
  Music,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { apiClient } from '../services/api';

interface CreatorPack {
  id: string;
  name: string;
  genre: string;
  downloadCount: number;
  coverColor: string;
  bpm?: number;
  tags?: string[];
  createdAt: string;
}

interface SocialLinks {
  soundcloud?: string;
  mixcloud?: string;
  bandcamp?: string;
}

interface CreatorData {
  id: string;
  displayName: string;
  plan: string;
  joinDate: string;
  bio: string;
  packsUploaded: number;
  totalDownloads: number;
  rating: number;
  ratingCount: number;
  packs: CreatorPack[];
  social: SocialLinks;
  isFollowing: boolean;
  isOwnProfile: boolean;
}

function PlanBadge({ plan }: { plan: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    free:     { label: 'Free',     cls: 'bg-gray-600/30 text-gray-400 border-gray-600' },
    creator:  { label: 'Creator',  cls: 'bg-purple-600/20 text-purple-400 border-purple-500' },
    studio:   { label: 'Studio',   cls: 'bg-cyan-600/20 text-cyan-400 border-cyan-500' },
    learning: { label: 'Learning', cls: 'bg-amber-600/20 text-amber-400 border-amber-500' },
  };
  const { label, cls } = config[plan] ?? config.free;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {Array.from({ length: 5 }, (_, i) => i + 1).map((s) => (
          <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />
        ))}
      </div>
      <span className="text-xs text-gray-400">{rating.toFixed(1)} <span className="text-gray-600">({count})</span></span>
    </div>
  );
}

function GradientAvatar({ name, size = 80 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="rounded-2xl flex items-center justify-center font-bold text-white select-none flex-shrink-0"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, hsl(${hue},70%,30%), hsl(${(hue + 60) % 360},80%,50%))`,
        fontSize: size / 2.8,
        boxShadow: `0 0 30px hsla(${hue},70%,40%,0.3)`,
      }}
    >
      {initials}
    </div>
  );
}

function PackCard({ pack }: { pack: CreatorPack }) {
  const genreColors: Record<string, string> = {
    mentalcore: '#ef4444', hardtek: '#f97316', tribe: '#22c55e',
    acidcore: '#eab308', 'hard-techno': '#a855f7', general: '#6b7280',
  };
  const color = genreColors[pack.genre.toLowerCase()] ?? '#7c3aed';
  return (
    <motion.div whileHover={{ scale: 1.02, y: -2 }} transition={{ duration: 0.15 }}
      className="group bg-gray-800/60 border border-gray-700/60 hover:border-gray-600 rounded-xl overflow-hidden cursor-pointer transition-colors"
    >
      <div className="h-24 flex items-center justify-center relative"
        style={{ background: `linear-gradient(135deg, ${color}30, ${color}10)` }}
      >
        <div className="w-12 h-12 rounded-xl flex items-center justify-center border"
          style={{ background: `${color}20`, borderColor: `${color}40` }}
        >
          <Music className="w-5 h-5" style={{ color }} />
        </div>
        {pack.bpm && (
          <span className="absolute top-2 right-2 text-xs font-mono px-1.5 py-0.5 rounded-md text-white"
            style={{ background: `${color}40` }}>{pack.bpm} BPM</span>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-white truncate mb-1">{pack.name}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>{pack.genre}</span>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Download className="w-3 h-3" />
            <span>{pack.downloadCount.toLocaleString()}</span>
          </div>
        </div>
        {pack.tags && pack.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {pack.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs bg-gray-700/60 text-gray-400 px-1.5 py-0.5 rounded-md">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="flex items-start gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gray-700/50 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-6 bg-gray-700/50 rounded w-40" />
          <div className="h-4 bg-gray-700/50 rounded w-28" />
          <div className="h-4 bg-gray-700/50 rounded w-36" />
        </div>
      </div>
      <div className="h-20 bg-gray-700/50 rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[0,1,2,3].map((i) => <div key={i} className="h-28 bg-gray-700/50 rounded-xl" />)}
      </div>
    </div>
  );
}

interface CreatorProfileProps { creatorId?: string; }

export default function CreatorProfile({ creatorId }: CreatorProfileProps) {
  const { auth } = useAppStore();
  const currentUserId = (auth.user as { id?: string } | null)?.id;
  const [profile, setProfile] = useState<CreatorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const targetId = creatorId ?? currentUserId ?? 'me';

  const fetchProfile = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const { data } = await apiClient.get(`/api/creators/${targetId}`);
      const p: CreatorData = data?.data ?? data;
      setProfile(p); setEditBio(p.bio);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Failed to load creator profile.');
    } finally { setIsLoading(false); }
  }, [targetId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSaveBio = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      await apiClient.patch('/api/creators/me', { bio: editBio });
      setProfile((prev) => prev ? { ...prev, bio: editBio } : prev);
      setIsEditing(false);
    } catch { /* silently fail */ } finally { setIsSaving(false); }
  };

  const handleFollowToggle = async () => {
    if (!profile) return;
    setIsFollowLoading(true);
    try {
      if (profile.isFollowing) await apiClient.delete(`/api/creators/${profile.id}/follow`);
      else await apiClient.post(`/api/creators/${profile.id}/follow`);
      setProfile((prev) => prev ? { ...prev, isFollowing: !prev.isFollowing } : prev);
    } catch { /* silently fail */ } finally { setIsFollowLoading(false); }
  };

  if (isLoading) return <div className="bg-[#0a0a0f] min-h-full"><ProfileSkeleton /></div>;
  if (error || !profile) return (
    <div className="bg-[#0a0a0f] min-h-full p-6 flex flex-col items-center justify-center gap-3">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-red-400 text-sm">{error ?? 'Profile not found.'}</p>
      <button onClick={fetchProfile} className="text-sm text-purple-400 hover:text-purple-300 transition-colors">Retry</button>
    </div>
  );

  const isOwn = profile.isOwnProfile;

  return (
    <div className="bg-[#0a0a0f] min-h-full text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6"
        >
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <GradientAvatar name={profile.displayName} size={88} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                  <h1 className="text-2xl font-extrabold text-white leading-tight">{profile.displayName}</h1>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <PlanBadge plan={profile.plan} />
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Joined {new Date(profile.joinDate).toLocaleDateString('en', { month: 'long', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isOwn ? (
                    <AnimatePresence mode="wait">
                      {isEditing ? (
                        <motion.div key="editing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
                          <button onClick={handleSaveBio} disabled={isSaving}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                          >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Save
                          </button>
                          <button onClick={() => { setEditBio(profile.bio); setIsEditing(false); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
                          ><X className="w-3.5 h-3.5" /></button>
                        </motion.div>
                      ) : (
                        <motion.button key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          onClick={() => setIsEditing(true)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-600"
                        ><Edit3 className="w-3.5 h-3.5" /> Edit Profile</motion.button>
                      )}
                    </AnimatePresence>
                  ) : (
                    <button onClick={handleFollowToggle} disabled={isFollowLoading}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-60 ${
                        profile.isFollowing ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600' : 'bg-purple-600 hover:bg-purple-500 text-white'
                      }`}
                    >
                      {isFollowLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : profile.isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                      {profile.isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              </div>
              <StarRating rating={profile.rating} count={profile.ratingCount} />
            </div>
          </div>
          <div className="mt-5 pt-5 border-t border-gray-800">
            {isEditing && isOwn ? (
              <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} maxLength={500} rows={4}
                placeholder="Tell the community about your sound, influences, and gear…"
                className="w-full bg-gray-800/60 border border-purple-500/40 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500 transition-colors"
              />
            ) : (
              <p className="text-sm text-gray-400 leading-relaxed">
                {profile.bio || <span className="text-gray-600 italic">No bio yet.</span>}
              </p>
            )}
            {isEditing && <p className="text-xs text-gray-600 mt-1.5 text-right">{editBio.length}/500</p>}
          </div>
        </motion.div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Packs Uploaded', value: profile.packsUploaded, icon: Package, color: 'text-purple-400' },
            { label: 'Total Downloads', value: profile.totalDownloads.toLocaleString(), icon: Download, color: 'text-cyan-400' },
            { label: 'Avg Rating', value: profile.rating.toFixed(1), icon: Star, color: 'text-amber-400', suffix: '/ 5' },
          ].map(({ label, value, icon: Icon, color, suffix }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 text-center"
            >
              <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
              <p className="text-2xl font-extrabold text-white">{value}{suffix && <span className="text-sm text-gray-500 ml-1">{suffix}</span>}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>

        {(profile.social.soundcloud || profile.social.mixcloud || profile.social.bandcamp) && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Links</h3>
            <div className="flex flex-wrap gap-3">
              {profile.social.soundcloud && (
                <a href={profile.social.soundcloud} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-purple-300 transition-colors bg-gray-800/60 border border-gray-700 hover:border-purple-500/40 rounded-lg px-3 py-2"
                >☁ SoundCloud <ExternalLink className="w-3 h-3" /></a>
              )}
              {profile.social.mixcloud && (
                <a href={profile.social.mixcloud} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-purple-300 transition-colors bg-gray-800/60 border border-gray-700 hover:border-purple-500/40 rounded-lg px-3 py-2"
                >〰 Mixcloud <ExternalLink className="w-3 h-3" /></a>
              )}
              {profile.social.bandcamp && (
                <a href={profile.social.bandcamp} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-purple-300 transition-colors bg-gray-800/60 border border-gray-700 hover:border-purple-500/40 rounded-lg px-3 py-2"
                >△ Bandcamp <ExternalLink className="w-3 h-3" /></a>
              )}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Package className="w-4 h-4" /> Packs ({profile.packs.length})
          </h3>
          {profile.packs.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{isOwn ? 'You have not uploaded any packs yet.' : 'This creator has not uploaded any packs yet.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {profile.packs.map((pack, i) => (
                <motion.div key={pack.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <PackCard pack={pack} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
