import { useState, useEffect, useCallback } from 'react';
import GraphCanvas from './components/GraphCanvas';
import FolderPicker from './components/FolderPicker';
import NodeDetails from './components/NodeDetails';
import type { RepoMetadata, GraphNode, GraphRelationship } from './types';

interface AppState {
  repos: RepoMetadata[];
  selectedRepoId: string | null;
  graph: { nodes: GraphNode[]; relationships: GraphRelationship[] } | null;
  selectedNode: GraphNode | null;
  loading: boolean;
  error: string | null;
}

const API_BASE = '';

export default function App() {
  const [state, setState] = useState<AppState>({
    repos: [],
    selectedRepoId: null,
    graph: null,
    selectedNode: null,
    loading: false,
    error: null,
  });

  const fetchRepos = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/repos`);
      if (!res.ok) throw new Error('Failed to fetch repos');
      const data = await res.json();
      setState(s => ({ ...s, repos: data.repos }));
    } catch (err) {
      setState(s => ({ ...s, error: String(err) }));
    }
  }, []);

  const fetchGraph = useCallback(async (repoId: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/api/graph/${repoId}`);
      if (!res.ok) throw new Error('Failed to fetch graph');
      const data = await res.json();
      setState(s => ({ ...s, graph: data, loading: false }));
    } catch (err) {
      setState(s => ({ ...s, error: String(err), loading: false }));
    }
  }, []);

  const analyzePath = useCallback(async (path: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error('Failed to analyze repo');
      const data = await res.json();
      await fetchRepos();
      setState(s => ({
        ...s,
        selectedRepoId: data.repo.id,
        loading: false,
      }));
      fetchGraph(data.repo.id);
    } catch (err) {
      setState(s => ({ ...s, error: String(err), loading: false }));
    }
  }, [fetchRepos, fetchGraph]);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  useEffect(() => {
    if (state.selectedRepoId) {
      fetchGraph(state.selectedRepoId);
    }
  }, [state.selectedRepoId, fetchGraph]);

  const selectNode = useCallback((node: GraphNode | null) => {
    setState(s => ({ ...s, selectedNode: node }));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '8px 16px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--accent)' }}>
          CodeGraph
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          Visual Code Explorer
        </span>

        {state.repos.length > 0 && (
          <select
            value={state.selectedRepoId ?? ''}
            onChange={e => setState(s => ({ ...s, selectedRepoId: e.target.value || null }))}
            style={{
              marginLeft: '16px', background: 'var(--surface-2)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px',
              fontSize: '13px', maxWidth: '240px',
            }}
          >
            <option value="">Select a repo...</option>
            {state.repos.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}

        <FolderPicker onAnalyze={analyzePath} loading={state.loading} />

        {state.loading && (
          <span style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: 'auto' }}>
            {state.graph ? 'Updating...' : 'Loading...'}
          </span>
        )}
      </header>

      {/* Error banner */}
      {state.error && (
        <div style={{
          padding: '8px 16px', background: 'rgba(248,81,73,0.15)',
          borderBottom: '1px solid var(--red)', color: 'var(--red)', fontSize: '13px',
        }}>
          {state.error}
        </div>
      )}

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {state.graph && state.graph.nodes.length > 0 ? (
          <>
            <div style={{ flex: 1, position: 'relative' }}>
              <GraphCanvas
                nodes={state.graph.nodes}
                relationships={state.graph.relationships}
                onSelectNode={selectNode}
              />
            </div>
            {state.selectedNode && (
              <NodeDetails
                node={state.selectedNode}
                allNodes={state.graph.nodes}
                allRelationships={state.graph.relationships}
                onClose={() => selectNode(null)}
              />
            )}
          </>
        ) : (
          <EmptyState hasRepos={state.repos.length > 0} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasRepos }: { hasRepos: boolean }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '12px', color: 'var(--text-muted)',
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
      <p style={{ fontSize: '15px' }}>
        {hasRepos
          ? 'Select a repo above to explore its graph'
          : 'No repositories indexed yet'}
      </p>
      <p style={{ fontSize: '13px', maxWidth: '360px', textAlign: 'center', lineHeight: 1.5 }}>
        Use the folder picker above to select a local repository, then it will be analyzed and displayed as an interactive graph.
      </p>
    </div>
  );
}
