import Graph from 'graphology';
import type { GraphNode, GraphRelationship, NodeLabel } from '../types';

export const NODE_COLORS: Record<NodeLabel, string> = {
  Project: '#f0883e',
  Folder: '#8b949e',
  File: '#58a6ff',
  Class: '#d29922',
  Interface: '#39d353',
  Type: '#79c0ff',
  Enum: '#e36209',
  Function: '#3fb950',
  Method: '#a371f7',
  Property: '#56d4dd',
  Variable: '#ff7b72',
  Decorator: '#fbbf24',
  TypeParameter: '#a8daff',
  Import: '#8b949e',
};

export const EDGE_COLORS: Record<string, string> = {
  CONTAINS: '#2d5a3d',
  DEFINES: '#0e7490',
  IMPORTS: '#1d4ed8',
  CALLS: '#7c3aed',
  EXTENDS: '#c2410c',
  IMPLEMENTS: '#be185d',
  HAS_METHOD: '#6b21a8',
  HAS_PROPERTY: '#0e7490',
  ACCESSES: '#b45309',
  DECORATES: '#fbbf24',
  ANNOTATES: '#065f46',
  PARAM_OF: '#475569',
};

export const NODE_SIZES: Record<NodeLabel, number> = {
  Project: 14,
  Folder: 8,
  File: 7,
  Class: 10,
  Interface: 8,
  Type: 6,
  Enum: 7,
  Function: 7,
  Method: 5,
  Property: 5,
  Variable: 4,
  Decorator: 5,
  TypeParameter: 4,
  Import: 3,
};

export function knowledgeGraphToGraphology(
  nodes: GraphNode[],
  relationships: GraphRelationship[]
): Graph {
  const graph = new Graph({ multi: false, type: 'directed' });

  // Add nodes
  for (const node of nodes) {
    const size = NODE_SIZES[node.label] ?? 5;
    const color = NODE_COLORS[node.label] ?? '#8b949e';
    graph.addNode(node.id, {
      label: node.properties.name,
      nodeLabel: node.label,
      color,
      size,
      originalSize: size,
      highlighted: false,
      isSelected: false,
      filePath: node.properties.filePath,
      startLine: node.properties.startLine,
      endLine: node.properties.endLine,
      x: Math.random() * 800 - 400,
      y: Math.random() * 800 - 400,
    });
  }

  // Add edges
  for (const rel of relationships) {
    if (!graph.hasNode(rel.fromId) || !graph.hasNode(rel.toId)) continue;
    if (graph.hasEdge(rel.fromId, rel.toId)) continue;

    graph.addEdge(rel.fromId, rel.toId, {
      relType: rel.type,
      color: EDGE_COLORS[rel.type] ?? '#8b949e',
      size: 1,
      label: rel.type,
    });
  }

  return graph;
}

export function getCommunityColor(index: number): string {
  const colors = [
    '#f0883e', '#58a6ff', '#3fb950', '#d29922', '#a371f7',
    '#39d353', '#79c0ff', '#ff7b72', '#56d4dd', '#db61a2',
  ];
  return colors[index % colors.length];
}
