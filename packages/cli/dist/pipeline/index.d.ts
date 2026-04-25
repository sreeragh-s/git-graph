import type { KnowledgeGraph, RepoMetadata } from '../types.js';
export interface AnalyzeOptions {
    path: string;
    verbose?: boolean;
}
export declare function runPipeline(options: AnalyzeOptions): Promise<{
    graph: KnowledgeGraph;
    repoMetadata: RepoMetadata;
}>;
