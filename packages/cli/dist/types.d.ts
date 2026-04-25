export type NodeLabel = 'Project' | 'Folder' | 'File' | 'Class' | 'Interface' | 'Type' | 'Enum' | 'Function' | 'Method' | 'Property' | 'Variable' | 'Decorator' | 'TypeParameter' | 'Import';
export declare const NODE_LABELS: NodeLabel[];
export type RelationshipType = 'CONTAINS' | 'DEFINES' | 'IMPORTS' | 'CALLS' | 'EXTENDS' | 'IMPLEMENTS' | 'HAS_METHOD' | 'HAS_PROPERTY' | 'ACCESSES' | 'DECORATES' | 'ANNOTATES' | 'PARAM_OF';
export declare const RELATIONSHIP_TYPES: RelationshipType[];
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
export interface GraphNode {
    id: string;
    label: NodeLabel;
    properties: NodeProperties;
}
export interface GraphRelationship {
    id: string;
    fromId: string;
    toId: string;
    type: RelationshipType;
    confidence: number;
}
export interface KnowledgeGraph {
    nodes: GraphNode[];
    relationships: GraphRelationship[];
}
export interface FileInfo {
    path: string;
    relativePath: string;
    size: number;
    language: 'typescript' | 'javascript' | 'json' | 'unknown';
    content?: string;
}
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
export interface ParsedImport {
    sourceFile: string;
    sourcePath: string;
    importedSymbols: string[];
    isDefault: boolean;
    isWildcard: boolean;
}
export interface ParsedCall {
    callerFile: string;
    callerLine: number;
    calleeName: string;
}
export interface ParsedHeritage {
    filePath: string;
    className: string;
    extendsType?: string;
    implementsTypes: string[];
}
export interface ParsedProperty {
    name: string;
    filePath: string;
    startLine: number;
    endLine: number;
    isExported: boolean;
    declaredType?: string;
    isReadonly?: boolean;
    isStatic?: boolean;
    targetClass?: string;
}
export interface RepoMetadata {
    id: string;
    name: string;
    path: string;
    indexedAt: string;
    nodeCount: number;
    relationshipCount: number;
}
export interface GraphResponse {
    nodes: GraphNode[];
    relationships: GraphRelationship[];
}
export interface RepoListResponse {
    repos: RepoMetadata[];
}
