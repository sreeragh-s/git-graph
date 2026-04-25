#!/usr/bin/env node
import { Command } from 'commander';
import { runPipeline } from './pipeline/index.js';
import { startServer } from './server/api.js';
import { Storage } from './graph/storage.js';
const program = new Command();
program
    .name('codegraph')
    .description('Code knowledge graph tool — index local repos and explore them visually')
    .version('0.1.0');
program
    .command('analyze')
    .description('Index a local repository')
    .argument('<path>', 'Path to the repository')
    .option('-v, --verbose', 'Verbose output')
    .action(async (path, opts) => {
    try {
        const { repoMetadata } = await runPipeline({ path, verbose: opts.verbose });
        console.log(`\nIndexed: ${repoMetadata.name}`);
        console.log(`  Path: ${repoMetadata.path}`);
        console.log(`  Nodes: ${repoMetadata.nodeCount}`);
        console.log(`  Relationships: ${repoMetadata.relationshipCount}`);
    }
    catch (err) {
        console.error('Error:', err instanceof Error ? err.message : err);
        process.exit(1);
    }
});
program
    .command('serve')
    .description('Start the API server and web UI')
    .option('-p, --port <port>', 'Port to listen on', '4747')
    .action(async (opts) => {
    const port = parseInt(opts.port ?? '4747', 10);
    await startServer(port);
});
program
    .command('list')
    .description('List all indexed repositories')
    .action(() => {
    const entries = Storage.getRegistry();
    if (entries.length === 0) {
        console.log('No indexed repositories. Run: codegraph analyze <path>');
        return;
    }
    console.log('Indexed repositories:\n');
    for (const entry of entries) {
        console.log(`  ${entry.name}`);
        console.log(`    Path: ${entry.path}`);
        console.log(`    Indexed: ${entry.indexedAt}`);
        console.log();
    }
});
program
    .command('clean')
    .description('Remove indexed data for a repository')
    .argument('<path>', 'Path to the repository')
    .action((path) => {
    Storage.unregisterRepo(path);
    console.log(`Removed index for: ${path}`);
});
program.parse();
