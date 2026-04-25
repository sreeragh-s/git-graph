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
  // Inheritance
  extendsType?: string;
  implementsTypes?: string[];
  // For Variable/Property
  declaredType?: string;
  isReadonly?: boolean;
  isStatic?: boolean;
  isAsync?: boolean;
  // For Decorator
  decoratorName?: string;
  // For TypeParameter
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
// File Info (from scanner)
// ============================================================
export interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  language: 'typescript' | 'javascript' | 'json' | 'unknown';
  content?: string;
}

// ============================================================
// Parsed Symbol
// ============================================================
export interface ParsedSymbol {
  id: string;
  name: string;
  label: NodeLabel;
  filePath: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
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
// Parsed Import
// ============================================================
export interface ParsedImport {
  sourceFile: string;
  sourcePath: string;
  importedSymbols: string[];
  isDefault: boolean;
  isWildcard: boolean;
}

// ============================================================
// Parsed Call
// ============================================================
export interface ParsedCall {
  callerFile: string;
  callerLine: number;
  calleeName: string;
}

// ============================================================
// Parsed Heritage (for EXTENDS/IMPLEMENTS)
// ============================================================
export interface ParsedHeritage {
  filePath: string;
  className: string;
  extendsType?: string;
  implementsTypes: string[];
}

// ============================================================
// Parsed Property
// ============================================================
export interface ParsedProperty {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
  declaredType?: string;
  isReadonly?: boolean;
  isStatic?: boolean;
  targetClass?: string; // if belongs to a class
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
