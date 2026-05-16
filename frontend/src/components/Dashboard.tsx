// ============================================================
// NEUROTEK AI — Dashboard
// ============================================================
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen,
  Clock,
  Zap,
  Star,
  TrendingUp,
  Music2,
  Plus,
  ArrowRight,
  Activity,
  BarChart3,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useProjects } from '../hooks/useProjects';
import { Card, StatCard } from './ui/Card';
import { Badge, GenreBadge, BpmBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { MiniWaveform } from './ui/Waveform';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Late night session';
  if (h < 12) return 'Morning, producer';
  if (h < 18) return 'Afternoon, producer';
  return 'Evening session';
}

export function Dashboard() {
  const { setView } = useAppStore();
  const { projects, activeProject, selectProject, toggleProjectStar, recentProjects } = useProjects();

  const stats = useMemo(() => {
    const totalTracks = projects.reduce((s, p) => s + p.tracks.length, 0);
    const totalTimeSaved = projects.reduce((s, p) => s + p.timeSaved, 0);
    const starredCount = projects.filter((p) => p.isStarred).length;
    return { totalTracks, totalTimeSaved, starredCount };
  }, [projects]);

  const activityItems = [
    { text: 'AI generated Mentalcore template', time: '2m ago', color: '#7c3aed' },
    { text: 'Mix analysis completed on NEUROSHOCK 200', time: '14m ago', color: '#10b981' },
    { text: 'Frequency conflict detected: Kick vs Bass', time: '18m ago', color: '#ef4444' },
    { text: '303 acid pattern suggested', time: '32m ago', color: '#06b6d4' },
    { text: 'Project TRIBAL VISION updated', time: '1h ago', color: '#f59e0b' },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-6 h-full overflow-y-auto scroll-area space-y-6"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{getGreeting()}</h1>
          <p className="text-text-muted text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            {activeProject && ` · Working on ${activeProject.name}`}
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={15} />}
          onClick={() => setView('templates')}
        >
          New Project
        </Button>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Projects"
          value={projects.length}
          change="2 this week"
          positive
          icon={<FolderOpen size={18} />}
          accent="#7c3aed"
        />
        <StatCard
          label="Total Tracks"
          value={stats.totalTracks}
          icon={<Music2 size={18} />}
          accent="#06b6d4"
        />
        <StatCard
          label="Time Saved"
          value={`${stats.totalTimeSaved}m`}
          change="by AI assistance"
          positive
          icon={<Clock size={18} />}
          accent="#f59e0b"
        />
        <StatCard
          label="Starred"
          value={stats.starredCount}
          icon={<Star size={18} />}
          accent="#ec4899"
        />
      </motion.div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent projects */}
        <motion.div variants={item} className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-text-primary">Recent Projects</h2>
            <Button variant="ghost" size="xs" iconRight={<ArrowRight size={12} />}>
              View all
            </Button>
          </div>
          <div className="space-y-3">
            {recentProjects.map((project) => (
              <motion.div
                key={project.id}
                whileHover={{ x: 3 }}
                transition={{ duration: 0.15 }}
                onClick={() => { selectProject(project.id); setView('tracks'); }}
                className="flex items-center gap-4 p-3 rounded-xl cursor-pointer group transition-all duration-150"
                style={{
                  background: activeProject?.id === project.id
                    ? 'rgba(124,58,237,0.08)'
                    : 'rgba(26,26,46,0.6)',
                  border: `1px solid ${activeProject?.id === project.id ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)'}`,
                }}
              >
                {/* Cover */}
                <div
                  className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white/60 text-xs font-bold"
                  style={{ background: project.coverColor }}
                >
                  {project.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary truncate group-hover:text-white transition-colors">
                      {project.name}
                    </h3>
                    {project.isStarred && <Star size={11} className="text-amber-400 flex-shrink-0 fill-amber-400" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <GenreBadge genre={project.genre} size="xs" />
                    <BpmBadge bpm={project.bpm} />
                    <span className="text-[10px] text-text-muted">{project.tracks.length} tracks</span>
                  </div>
                </div>

                {/* Waveform preview */}
                <div className="hidden md:block w-24 h-6 flex-shrink-0">
                  <MiniWaveform
                    data={project.tracks[0]?.waveformData}
                    color="#7c3aed"
                    height={24}
                  />
                </div>

                {/* Time */}
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-text-muted">
                    {new Date(project.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-[10px] text-emerald-400 mt-0.5">+{project.timeSaved}m saved</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Quick actions */}
          <motion.div variants={item}>
            <h2 className="text-base font-semibold text-text-primary mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: 'Generate Template', desc: 'AI-powered for your genre', icon: <Zap size={16}/>, view: 'templates' as const, color: '#7c3aed' },
                { label: 'Analyse Mix', desc: 'Frequency & loudness check', icon: <Activity size={16}/>, view: 'mix' as const, color: '#10b981' },
                { label: 'Live Mode', desc: 'Performance interface', icon: <BarChart3 size={16}/>, view: 'live' as const, color: '#ef4444' },
                { label: 'Ask AI', desc: 'Production help & advice', icon: <TrendingUp size={16}/>, view: 'chat' as const, color: '#ec4899' },
              ].map((action) => (
                <motion.button
                  key={action.label}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setView(action.view)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-150"
                  style={{
                    background: 'rgba(26,26,46,0.6)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${action.color}18`, color: action.color }}
                  >
                    {action.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{action.label}</p>
                    <p className="text-[10px] text-text-muted">{action.desc}</p>
                  </div>
                  <ArrowRight size={14} className="text-text-muted flex-shrink-0 ml-auto" />
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Activity feed */}
          <motion.div variants={item}>
            <h2 className="text-base font-semibold text-text-primary mb-3">Activity</h2>
            <Card padding="sm">
              <div className="space-y-3">
                {activityItems.map((act, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: act.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-text-secondary leading-relaxed">{act.text}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{act.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
