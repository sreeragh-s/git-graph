// ============================================================
// Node Labels
// ============================================================
export type NodeLabel =
  | 'Project'
  | 'Folder'
  | 'File'
  | 'Class'
  | 'Interface'
  | 'Type'
  | 'Enum'
  | 'Function'
  | 'Method'
  | 'Property'
  | 'Variable'
  | 'Decorator'
  | 'TypeParameter'
  | 'Import';

export const NODE_LABELS: NodeLabel[] = [
  'Project',
  'Folder',
  'File',
  'Class',
  'Interface',
  'Type',
  'Enum',
  'Function',
  'Method',
  'Property',
  'Variable',
  'Decorator',
  'TypeParameter',
  'Import',
];

// ============================================================
// Relationship Types
// ============================================================
export type RelationshipType =
  | 'CONTAINS'
  | 'DEFINES'
  | 'IMPORTS'
  | 'CALLS'
  | 'EXTENDS'
  | 'IMPLEMENTS'
  | 'HAS_METHOD'
  | 'HAS_PROPERTY'
  | 'ACCESSES'
  | 'DECORATES'
  | 'ANNOTATES'
  | 'PARAM_OF';

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  'CONTAINS',
  'DEFINES',
  'IMPORTS',
  'CALLS',
  'EXTENDS',
  'IMPLEMENTS',
  'HAS_METHOD',
  'HAS_PROPERTY',
  'ACCESSES',
  'DECORATES',
  'ANNOTATES',
  'PARAM_OF',
];

// ============================================================
// Node Properties
// ============================================================
export interface NodeProperties {
  name: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  language?: string;
  isExported?: boolean;
  returnType?: string;
  parameterCount?: number;
  annotations?: string[];
  extendsType?: string;
  implementsTypes?: string[];
  declaredType?: string;
  isReadonly?: boolean;
  isStatic?: boolean;
  isAsync?: boolean;
  decoratorName?: string;
  constraintType?: string;
}

// ============================================================
// Graph Node
// ============================================================
export interface GraphNode {
  id: string;
  label: NodeLabel;
  properties: NodeProperties;
}

// ============================================================
// Graph Relationship
// ============================================================
export interface GraphRelationship {
  id: string;
  fromId: string;
  toId: string;
  type: RelationshipType;
  confidence: number;
}

// ============================================================
// Knowledge Graph
// ============================================================
export interface KnowledgeGraph {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

// ============================================================
// Repo Metadata
// ============================================================
export interface RepoMetadata {
  id: string;
  name: string;
  path: string;
  indexedAt: string;
  nodeCount: number;
  relationshipCount: number;
}

// ============================================================
// API Response Types
// ============================================================
export interface GraphResponse {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export interface RepoListResponse {
  repos: RepoMetadata[];
}
