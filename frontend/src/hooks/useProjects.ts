// ============================================================
// NEUROTEK AI — Projects Hook
// ============================================================
import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import type { Project, Track } from '../types';

export function useProjects() {
  const {
    projects,
    activeProject,
    setActiveProject,
    addProject,
    updateProject,
    deleteProject,
    toggleProjectStar,
    updateTrack,
    setLoading,
    addNotification,
  } = useAppStore();

  const createProject = useCallback(
    async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'timeSaved'>) => {
      setLoading(true, 'Creating project...');
      await new Promise((r) => setTimeout(r, 800));

      const project: Project = {
        ...data,
        id: `p-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeSaved: 0,
      };

      addProject(project);
      setActiveProject(project);
      setLoading(false);
      addNotification({ type: 'success', message: `Project "${project.name}" created successfully` });

      return project;
    },
    [addProject, setActiveProject, setLoading, addNotification]
  );

  const renameProject = useCallback(
    (id: string, name: string) => {
      updateProject(id, { name });
      addNotification({ type: 'info', message: `Project renamed to "${name}"` });
    },
    [updateProject, addNotification]
  );

  const duplicateProject = useCallback(
    async (id: string) => {
      const source = projects.find((p) => p.id === id);
      if (!source) return;

      setLoading(true, 'Duplicating project...');
      await new Promise((r) => setTimeout(r, 500));

      const copy: Project = {
        ...source,
        id: `p-${Date.now()}`,
        name: `${source.name} (copy)`,
        isStarred: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tracks: source.tracks.map((t) => ({ ...t, id: `t-${Date.now()}-${t.order}` })),
      };

      addProject(copy);
      setLoading(false);
      addNotification({ type: 'success', message: `Project duplicated` });
      return copy;
    },
    [projects, addProject, setLoading, addNotification]
  );

  const selectProject = useCallback(
    (id: string) => {
      const project = projects.find((p) => p.id === id);
      if (project) setActiveProject(project);
    },
    [projects, setActiveProject]
  );

  const removeProject = useCallback(
    (id: string) => {
      const project = projects.find((p) => p.id === id);
      deleteProject(id);
      addNotification({ type: 'info', message: `Project "${project?.name ?? id}" deleted` });
    },
    [projects, deleteProject, addNotification]
  );

  const updateActiveTrack = useCallback(
    (trackId: string, updates: Partial<Track>) => {
      if (!activeProject) return;
      updateTrack(activeProject.id, trackId, updates);
    },
    [activeProject, updateTrack]
  );

  const starredProjects = projects.filter((p) => p.isStarred);
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return {
    projects,
    activeProject,
    starredProjects,
    recentProjects,
    createProject,
    renameProject,
    duplicateProject,
    selectProject,
    removeProject,
    toggleProjectStar,
    updateActiveTrack,
  };
}
