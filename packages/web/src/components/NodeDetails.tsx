import type { GraphNode, GraphRelationship } from '../types';

interface NodeDetailsProps {
  node: GraphNode;
  allNodes: GraphNode[];
  allRelationships: GraphRelationship[];
  onClose: () => void;
}

export default function NodeDetails({ node, allNodes, allRelationships, onClose }: NodeDetailsProps) {
  const incoming = allRelationships.filter(r => r.toId === node.id);
  const outgoing = allRelationships.filter(r => r.fromId === node.id);

  const incomingNodes = incoming
    .map(r => allNodes.find(n => n.id === r.fromId))
    .filter(Boolean) as GraphNode[];

  const outgoingNodes = outgoing
    .map(r => allNodes.find(n => n.id === r.toId))
    .filter(Boolean) as GraphNode[];

  return (
    <div style={{
      width: '300px', flexShrink: 0, background: 'var(--surface)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LabelBadge label={node.label} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>{node.properties.name}</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', padding: '4px', borderRadius: '4px',
            display: 'flex', alignItems: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {/* Location */}
        <Section title="Location">
          <PropRow label="File" value={shortenPath(node.properties.filePath)} />
          {node.properties.startLine && (
            <PropRow label="Lines" value={`${node.properties.startLine}–${node.properties.endLine ?? '?'}`} />
          )}
          {node.properties.language && (
            <PropRow label="Language" value={node.properties.language} />
          )}
        </Section>

        {/* Signatures */}
        {(node.properties.isExported !== undefined || node.properties.returnType || node.properties.parameterCount !== undefined) && (
          <Section title="Signature">
            {node.properties.isExported !== undefined && (
              <PropRow label="Exported" value={node.properties.isExported ? 'Yes' : 'No'} />
            )}
            {node.properties.returnType && (
              <PropRow label="Returns" value={node.properties.returnType} />
            )}
            {node.properties.parameterCount !== undefined && (
              <PropRow label="Parameters" value={String(node.properties.parameterCount)} />
            )}
          </Section>
        )}

        {/* Incoming edges */}
        {incomingNodes.length > 0 && (
          <Section title={`Incoming (${incomingNodes.length})`}>
            {incomingNodes.slice(0, 20).map(n => (
              <EdgeItem key={n.id} node={n} type={incoming.find(r => r.fromId === n.id)?.type ?? 'CALLS'} />
            ))}
            {incomingNodes.length > 20 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                +{incomingNodes.length - 20} more
              </div>
            )}
          </Section>
        )}

        {/* Outgoing edges */}
        {outgoingNodes.length > 0 && (
          <Section title={`Outgoing (${outgoingNodes.length})`}>
            {outgoingNodes.slice(0, 20).map(n => (
              <EdgeItem key={n.id} node={n} type={outgoing.find(r => r.toId === n.id)?.type ?? 'CALLS'} />
            ))}
            {outgoingNodes.length > 20 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                +{outgoingNodes.length - 20} more
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.05em',
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {children}
      </div>
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '13px' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: '60px' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', wordBreak: 'break-all' }}>
        {value}
      </span>
    </div>
  );
}

function EdgeItem({ node, type }: { node: GraphNode; type: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '3px 6px', borderRadius: '4px',
      background: 'var(--surface-2)', fontSize: '12px',
    }}>
      <LabelBadge label={node.label} small />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.properties.name}
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
        {type}
      </span>
    </div>
  );
}

const LABEL_COLORS: Record<string, string> = {
  Project: '#f0883e', Folder: '#8b949e', File: '#58a6ff',
  Class: '#d29922', Interface: '#39d353', Type: '#79c0ff',
  Enum: '#e36209', Function: '#3fb950', Method: '#a371f7',
  Property: '#56d4dd', Variable: '#ff7b72', Decorator: '#fbbf24',
  TypeParameter: '#a8daff', Import: '#8b949e',
};

function LabelBadge({ label, small }: { label: string; small?: boolean }) {
  const color = LABEL_COLORS[label] ?? '#8b949e';
  return (
    <span style={{
      background: `${color}22`, color,
      padding: small ? '1px 4px' : '2px 6px',
      borderRadius: '4px', fontSize: small ? '9px' : '10px',
      fontWeight: 600, fontFamily: 'var(--font-mono)',
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function shortenPath(path: string): string {
  const parts = path.split(/[\/\\]/);
  if (parts.length <= 3) return path;
  return `.../${parts.slice(-2).join('/')}`;
}
