import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
function expandHome(p) {
    if (p.startsWith('~/') || p === '~') {
        return join(process.env.HOME ?? '.', p.slice(1));
    }
    return p;
}
const GLOBAL_DIR = join(process.env.HOME ?? '.', '.code-graph');
const REPOS_DIR = join(GLOBAL_DIR, 'repos');
const REGISTRY_FILE = join(GLOBAL_DIR, 'registry.json');
function ensureDir() {
    if (!existsSync(GLOBAL_DIR)) {
        mkdirSync(GLOBAL_DIR, { recursive: true });
    }
    if (!existsSync(REPOS_DIR)) {
        mkdirSync(REPOS_DIR, { recursive: true });
    }
}
export class Storage {
    repoId;
    graphFile;
    constructor(repoId, graphFile) {
        const expandedPath = expandHome(graphFile);
        ensureDir();
        this.repoId = repoId;
        this.graphFile = expandedPath;
    }
    clearRepo() {
        // No-op for JSON storage (full graph rewrite)
    }
    insertNode(node) {
        // No-op (insertGraph does full rewrite)
    }
    insertRelationship(rel) {
        // No-op (insertGraph does full rewrite)
    }
    insertGraph(graph) {
        const dir = join(REPOS_DIR, this.repoId);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        writeFileSync(this.graphFile, JSON.stringify(graph, null, 2), 'utf-8');
    }
    getGraph() {
        if (!existsSync(this.graphFile)) {
            return { nodes: [], relationships: [] };
        }
        try {
            const data = readFileSync(this.graphFile, 'utf-8');
            const parsed = JSON.parse(data);
            return {
                nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
                relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
            };
        }
        catch {
            return { nodes: [], relationships: [] };
        }
    }
    close() {
        // No-op for JSON storage
    }
    // Registry operations
    static getRegistry() {
        ensureDir();
        try {
            if (!existsSync(REGISTRY_FILE))
                return [];
            const data = readFileSync(REGISTRY_FILE, 'utf-8');
            return JSON.parse(data);
        }
        catch {
            return [];
        }
    }
    static saveRegistry(entries) {
        ensureDir();
        writeFileSync(REGISTRY_FILE, JSON.stringify(entries, null, 2), 'utf-8');
    }
    static registerRepo(repo, graphFile) {
        const entries = Storage.getRegistry();
        const existing = entries.findIndex(e => e.path === repo.path);
        const entry = {
            id: repo.id,
            name: repo.name,
            path: repo.path,
            indexedAt: repo.indexedAt,
            graphFile,
        };
        if (existing >= 0) {
            entries[existing] = entry;
        }
        else {
            entries.push(entry);
        }
        Storage.saveRegistry(entries);
    }
    static unregisterRepo(repoPath) {
        const entries = Storage.getRegistry().filter(e => e.path !== repoPath);
        Storage.saveRegistry(entries);
    }
}
