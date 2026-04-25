import { useEffect, useRef, useCallback } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import type { GraphNode, GraphRelationship } from '../types';
import { knowledgeGraphToGraphology, NODE_COLORS, EDGE_COLORS } from '../lib/graph-adapter';

interface GraphCanvasProps {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  onSelectNode: (node: GraphNode | null) => void;
}

export default function GraphCanvas({ nodes, relationships, onSelectNode }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);

  const buildGraph = useCallback(() => {
    if (sigmaRef.current) {
      sigmaRef.current.kill();
      sigmaRef.current = null;
    }

    const graph = knowledgeGraphToGraphology(nodes, relationships);
    graphRef.current = graph;

    if (!containerRef.current) return;

    // Sigma v3 settings
    const sigma = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      hideEdgesOnMove: false,
      hideLabelsOnMove: false,
      defaultNodeColor: '#8b949e',
      defaultEdgeColor: '#30363d',
      defaultNodeType: 'circle',
      defaultEdgeType: 'arrow',
      labelColor: { color: '#e6edf3' },
      labelFont: 'system, -apple-system, sans-serif',
      labelSize: 11,
      labelWeight: '500',
      labelRenderedSizeThreshold: 4,
      labelDensity: 0.07,
      labelGridCellSize: 60,
      minCameraRatio: 0.01,
      maxCameraRatio: 50,
    });

    // ---- Node click ----
    sigma.on('clickNode', ({ node }) => {
      // Deselect previous
      graph.forEachNode((n) => {
        const label = graph.getNodeAttribute(n, 'nodeLabel') as string;
        const origSize = graph.getNodeAttribute(n, 'originalSize') as number;
        graph.setNodeAttribute(n, 'isSelected', false);
        graph.setNodeAttribute(n, 'highlighted', false);
        graph.setNodeAttribute(n, 'size', origSize ?? 5);
        graph.setNodeAttribute(n, 'color', NODE_COLORS[label as keyof typeof NODE_COLORS] ?? '#8b949e');
      });

      // Select new node
      graph.setNodeAttribute(node, 'isSelected', true);
      graph.setNodeAttribute(node, 'highlighted', true);
      graph.setNodeAttribute(node, 'size', (graph.getNodeAttribute(node, 'originalSize') as number) * 2);

      // Highlight neighbors
      graph.forEachNeighbor(node, (neighbor) => {
        graph.setNodeAttribute(neighbor, 'highlighted', true);
      });

      // Emit selection
      const graphNode = nodes.find(n => n.id === node);
      onSelectNode(graphNode ?? null);

      sigma.refresh();
    });

    // ---- Click background ----
    sigma.on('clickStage', () => {
      // Reset all nodes
      graph.forEachNode((n) => {
        const label = graph.getNodeAttribute(n, 'nodeLabel') as string;
        const origSize = graph.getNodeAttribute(n, 'originalSize') as number;
        graph.setNodeAttribute(n, 'isSelected', false);
        graph.setNodeAttribute(n, 'highlighted', false);
        graph.setNodeAttribute(n, 'size', origSize ?? 5);
        graph.setNodeAttribute(n, 'color', NODE_COLORS[label as keyof typeof NODE_COLORS] ?? '#8b949e');
      });
      onSelectNode(null);
      sigma.refresh();
    });

    // ---- Hover ----
    sigma.on('enterNode', ({ node }) => {
      if (graph.getNodeAttribute(node, 'isSelected')) return;
      graph.setNodeAttribute(node, 'highlighted', true);
      graph.forEachNeighbor(node, (neighbor) => {
        if (!graph.getNodeAttribute(neighbor, 'isSelected')) {
          graph.setNodeAttribute(neighbor, 'highlighted', true);
        }
      });
      if (containerRef.current) {
        containerRef.current.style.cursor = 'pointer';
      }
      sigma.refresh();
    });

    sigma.on('leaveNode', ({ node }) => {
      if (graph.getNodeAttribute(node, 'isSelected')) return;
      graph.setNodeAttribute(node, 'highlighted', false);
      graph.forEachNeighbor(node, (neighbor) => {
        if (!graph.getNodeAttribute(neighbor, 'isSelected')) {
          graph.setNodeAttribute(neighbor, 'highlighted', false);
        }
      });
      if (containerRef.current) {
        containerRef.current.style.cursor = 'default';
      }
      sigma.refresh();
    });

    sigmaRef.current = sigma;

    // ---- ForceAtlas2 layout ----
    if (graph.order > 0 && graph.order < 2000) {
      forceAtlas2.assign(graph, Math.min(150, graph.order * 3));
      sigma.refresh();
    }
  }, [nodes, relationships, onSelectNode]);

  useEffect(() => {
    buildGraph();
    return () => {
      sigmaRef.current?.kill();
      sigmaRef.current = null;
    };
  }, [buildGraph]);

  function handleZoomIn() {
    sigmaRef.current?.getCamera().animatedZoom({ duration: 200, factor: 1.3 });
  }
  function handleZoomOut() {
    sigmaRef.current?.getCamera().animatedUnzoom({ duration: 200, factor: 1.3 });
  }
  function handleReset() {
    sigmaRef.current?.getCamera().animatedReset({ duration: 350 });
  }
  function handleRerunLayout() {
    if (!graphRef.current) return;
    forceAtlas2.assign(graphRef.current, 80);
    sigmaRef.current?.refresh();
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0d1117' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Controls */}
      <div style={{
        position: 'absolute', bottom: '16px', right: '16px',
        display: 'flex', flexDirection: 'column', gap: '4px',
      }}>
        <ControlButton onClick={handleZoomIn} title="Zoom In (+)" children={
          <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
        } />
        <ControlButton onClick={handleZoomOut} title="Zoom Out (-)" children={
          <svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12h14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
        } />
        <ControlButton onClick={handleReset} title="Reset View" children={
          <svg width="16" height="16" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        } />
        <ControlButton onClick={handleRerunLayout} title="Rerun ForceAtlas2 Layout" children={
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M23 20v-6h-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        } />
      </div>

      {/* Stats bar */}
      <div style={{
        position: 'absolute', top: '12px', left: '12px',
        background: 'rgba(13,17,23,0.92)', border: '1px solid #30363d',
        borderRadius: '8px', padding: '8px 14px', fontSize: '12px',
        color: '#8b949e', display: 'flex', gap: '16px',
        backdropFilter: 'blur(8px)',
      }}>
        <span><strong style={{ color: '#e6edf3' }}>{nodes.length.toLocaleString()}</strong> nodes</span>
        <span><strong style={{ color: '#e6edf3' }}>{relationships.length.toLocaleString()}</strong> edges</span>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '16px', left: '12px',
        background: 'rgba(13,17,23,0.92)', border: '1px solid #30363d',
        borderRadius: '8px', padding: '10px 14px', fontSize: '11px',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ marginBottom: '8px', color: '#8b949e', fontWeight: 600, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Node Types
        </div>
        <LegendItem color={NODE_COLORS.Project} label="Project" />
        <LegendItem color={NODE_COLORS.Folder} label="Folder" />
        <LegendItem color={NODE_COLORS.File} label="File" />
        <LegendItem color={NODE_COLORS.Class} label="Class" />
        <LegendItem color={NODE_COLORS.Function} label="Function" />
        <LegendItem color={NODE_COLORS.Method} label="Method" />
        <div style={{ marginTop: '8px', marginBottom: '8px', color: '#8b949e', fontWeight: 600, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Edge Types
        </div>
        <LegendItem color={EDGE_COLORS.CONTAINS} label="CONTAINS" dot />
        <LegendItem color={EDGE_COLORS.DEFINES} label="DEFINES" dot />
        <LegendItem color={EDGE_COLORS.IMPORTS} label="IMPORTS" dot />
        <LegendItem color={EDGE_COLORS.CALLS} label="CALLS" dot />
      </div>
    </div>
  );
}

function ControlButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: '34px', height: '34px',
        background: 'rgba(22,27,34,0.92)', border: '1px solid #30363d',
        borderRadius: '8px', color: '#e6edf3',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#21262d'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#58a6ff'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(22,27,34,0.92)'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#30363d'; }}
    >
      {children}
    </button>
  );
}

function LegendItem({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
      <div style={{
        width: '8px', height: '8px', borderRadius: dot ? '2px' : '50%',
        background: color, flexShrink: 0,
        border: dot ? `1px solid ${color}44` : 'none',
      }} />
      <span style={{ color: '#8b949e', fontSize: '11px' }}>{label}</span>
    </div>
  );
}
