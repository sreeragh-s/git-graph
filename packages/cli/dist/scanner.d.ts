import type { FileInfo } from './types.js';
export declare function hashRepoPath(repoPath: string): string;
export declare function scanDirectory(dirPath: string, basePath?: string): FileInfo[];
