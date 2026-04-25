import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  GraphNode,
  GraphRelationship,
  KnowledgeGraph,
  RepoMetadata,
} from '../types.js';

function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return join(process.env.HOME ?? '.', p.slice(1));
  }
  return p;
}

const GLOBAL_DIR = join(process.env.HOME ?? '.', '.code-graph');
const REPOS_DIR = join(GLOBAL_DIR, 'repos');
const REGISTRY_FILE = join(GLOBAL_DIR, 'registry.json');

interface RegistryEntry {
  id: string;
  name: string;
  path: string;
  indexedAt: string;
  graphFile: string;
}

function ensureDir(): void {
  if (!existsSync(GLOBAL_DIR)) {
    mkdirSync(GLOBAL_DIR, { recursive: true });
  }
  if (!existsSync(REPOS_DIR)) {
    mkdirSync(REPOS_DIR, { recursive: true });
  }
}

export class Storage {
  private repoId: string;
  private graphFile: string;

  constructor(repoId: string, graphFile: string) {
    const expandedPath = expandHome(graphFile);
    ensureDir();
    this.repoId = repoId;
    this.graphFile = expandedPath;
  }

  clearRepo(): void {
    // No-op for JSON storage (full graph rewrite)
  }

  insertNode(node: GraphNode): void {
    // No-op (insertGraph does full rewrite)
  }

  insertRelationship(rel: GraphRelationship): void {
    // No-op (insertGraph does full rewrite)
  }

  insertGraph(graph: KnowledgeGraph): void {
    const dir = join(REPOS_DIR, this.repoId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.graphFile, JSON.stringify(graph, null, 2), 'utf-8');
  }

  getGraph(): KnowledgeGraph {
    if (!existsSync(this.graphFile)) {
      return { nodes: [], relationships: [] };
    }
    try {
      const data = readFileSync(this.graphFile, 'utf-8');
      const parsed = JSON.parse(data) as KnowledgeGraph;
      return {
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
        relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
      };
    } catch {
      return { nodes: [], relationships: [] };
    }
  }

  close(): void {
    // No-op for JSON storage
  }

  // Registry operations
  static getRegistry(): RegistryEntry[] {
    ensureDir();
    try {
      if (!existsSync(REGISTRY_FILE)) return [];
      const data = readFileSync(REGISTRY_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveRegistry(entries: RegistryEntry[]): void {
    ensureDir();
    writeFileSync(REGISTRY_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  }

  static registerRepo(repo: RepoMetadata, graphFile: string): void {
    const entries = Storage.getRegistry();
    const existing = entries.findIndex(e => e.path === repo.path);
    const entry: RegistryEntry = {
      id: repo.id,
      name: repo.name,
      path: repo.path,
      indexedAt: repo.indexedAt,
      graphFile,
    };
    if (existing >= 0) {
      entries[existing] = entry;
    } else {
      entries.push(entry);
    }
    Storage.saveRegistry(entries);
  }

  static unregisterRepo(repoPath: string): void {
    const entries = Storage.getRegistry().filter(e => e.path !== repoPath);
    Storage.saveRegistry(entries);
  }
}
