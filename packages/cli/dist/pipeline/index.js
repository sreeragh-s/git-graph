import { posix } from 'node:path';
import { mkdirSync } from 'node:fs';
import { scanDirectory } from '../scanner.js';
import { parseFiles } from '../parser.js';
import { GraphBuilder } from '../graph/builder.js';
import { Storage } from '../graph/storage.js';
import { hashRepoPath } from '../scanner.js';
function getFolderIdMap(builder, projId, files) {
    const folders = new Set();
    for (const file of files) {
        const parts = file.relativePath.split(/[\/\\]/);
        for (let i = 1; i < parts.length; i++) {
            folders.add(parts.slice(0, i).join('/'));
        }
    }
    const sortedFolders = Array.from(folders).sort((a, b) => a.split('/').length - b.split('/').length);
    const folderIdMap = new Map();
    for (const folder of sortedFolders) {
        const parentPath = posix.dirname(folder);
        const parentId = parentPath === '.' ? projId : folderIdMap.get(parentPath);
        const id = builder.addFolder(folder, posix.basename(folder), parentId);
        folderIdMap.set(folder, id);
    }
    return folderIdMap;
}
export async function runPipeline(options) {
    const { path: repoPath, verbose } = options;
    if (verbose)
        console.log(`[pipeline] Starting analysis of: ${repoPath}`);
    // Phase 1: Scan
    if (verbose)
        console.log('[pipeline:scan] Walking directory tree...');
    const files = scanDirectory(repoPath);
    if (verbose)
        console.log(`[pipeline:scan] Found ${files.length} files`);
    if (files.length === 0) {
        throw new Error(`No code files found in ${repoPath}`);
    }
    // Phase 2: Parse
    if (verbose)
        console.log('[pipeline:parse] Parsing code with Babel AST...');
    const { allSymbols, allImports, allCalls, allHeritage, allProperties } = parseFiles(files);
    if (verbose) {
        console.log(`[pipeline:parse] Extracted ${allSymbols.length} symbols, ` +
            `${allImports.length} imports, ${allCalls.length} calls, ` +
            `${allHeritage.length} heritage, ${allProperties.length} properties`);
    }
    // Phase 3: Build graph
    if (verbose)
        console.log('[pipeline:build] Constructing knowledge graph...');
    const builder = new GraphBuilder();
    const projectId = builder.addProject(posix.basename(repoPath), repoPath);
    // Build folder hierarchy
    const folderIdMap = getFolderIdMap(builder, projectId, files);
    // Add files and their symbols
    const fileNodeIds = new Map();
    for (const file of files) {
        const dir = posix.dirname(file.relativePath);
        const parentId = dir === '.' ? projectId : folderIdMap.get(dir);
        const fileId = builder.addFile(file, parentId);
        fileNodeIds.set(file.path, fileId);
    }
    // Add symbol nodes
    const allSymbolsByFile = new Map();
    for (const sym of allSymbols) {
        if (!allSymbolsByFile.has(sym.filePath)) {
            allSymbolsByFile.set(sym.filePath, []);
        }
        allSymbolsByFile.get(sym.filePath).push(sym);
    }
    for (const [filePath, fileId] of fileNodeIds) {
        const symbols = allSymbolsByFile.get(filePath) ?? [];
        for (const sym of symbols) {
            builder.addSymbol(sym, fileId);
        }
    }
    // Phase 4: Resolve cross-file references
    if (verbose)
        console.log('[pipeline:resolve] Resolving cross-file references...');
    for (const imp of allImports) {
        builder.resolveImport(imp, allSymbols, allImports);
    }
    builder.resolveHeritage(allHeritage);
    builder.resolveClassMembers(allSymbols, allProperties);
    builder.resolveCalls(allCalls, allSymbols);
    const graph = builder.build();
    if (verbose) {
        console.log(`[pipeline] Graph built: ${graph.nodes.length} nodes, ` +
            `${graph.relationships.length} relationships`);
    }
    // Phase 5: Persist
    const repoId = hashRepoPath(repoPath);
    const dbDir = `${process.env.HOME ?? '.'}/.code-graph/repos/${repoId}`;
    const dbPath = `${dbDir}/graph.db`;
    if (verbose)
        console.log(`[pipeline:store] Saving to ${dbPath}...`);
    // Ensure directory exists
    mkdirSync(dbDir, { recursive: true });
    const storage = new Storage(repoId, dbPath);
    storage.insertGraph(graph);
    const repoMetadata = {
        id: repoId,
        name: posix.basename(repoPath),
        path: repoPath,
        indexedAt: new Date().toISOString(),
        nodeCount: graph.nodes.length,
        relationshipCount: graph.relationships.length,
    };
    Storage.registerRepo(repoMetadata, dbPath);
    if (verbose)
        console.log('[pipeline] Done!');
    return { graph, repoMetadata };
}
