import type { GraphNode, GraphRelationship, KnowledgeGraph, RepoMetadata } from '../types.js';
interface RegistryEntry {
    id: string;
    name: string;
    path: string;
    indexedAt: string;
    graphFile: string;
}
export declare class Storage {
    private repoId;
    private graphFile;
    constructor(repoId: string, graphFile: string);
    clearRepo(): void;
    insertNode(node: GraphNode): void;
    insertRelationship(rel: GraphRelationship): void;
    insertGraph(graph: KnowledgeGraph): void;
    getGraph(): KnowledgeGraph;
    close(): void;
    static getRegistry(): RegistryEntry[];
    static saveRegistry(entries: RegistryEntry[]): void;
    static registerRepo(repo: RepoMetadata, graphFile: string): void;
    static unregisterRepo(repoPath: string): void;
}
export {};
