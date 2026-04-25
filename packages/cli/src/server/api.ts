import express, { Request, Response } from 'express';
import cors from 'cors';
import { Storage } from '../graph/storage.js';
import { runPipeline } from '../pipeline/index.js';
import type { GraphResponse, RepoListResponse, RepoMetadata, GraphNode, GraphRelationship } from '../types.js';

const app = express();
app.use(cors());
app.use(express.json());

// GET /api/repos - list indexed repos
app.get('/api/repos', (_req: Request, res: Response) => {
  try {
    const entries = Storage.getRegistry();
    const repos: RepoMetadata[] = entries.map(e => ({
      id: e.id,
      name: e.name,
      path: e.path,
      indexedAt: e.indexedAt,
      nodeCount: 0,
      relationshipCount: 0,
    }));
    res.json({ repos } as RepoListResponse);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/graph/:repoId - get full graph
app.get('/api/graph/:repoId', (req: Request, res: Response) => {
  try {
    const repoId = String(req.params.repoId);
    const entries = Storage.getRegistry();
    const entry = entries.find(e => e.id === repoId);

    if (!entry) {
      res.status(404).json({ error: 'Repo not found' });
      return;
    }

    const storage = new Storage(repoId, String(entry.graphFile));
    const graph = storage.getGraph();
    storage.close();

    res.json({
      nodes: graph.nodes,
      relationships: graph.relationships,
    } as GraphResponse);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/graph/:repoId/file/* - get file with symbols
app.get('/api/graph/:repoId/file/*', (req: Request, res: Response) => {
  try {
    const repoId = String(req.params.repoId);
    const filePath = String(req.params[0] ?? '');
    const entries = Storage.getRegistry();
    const entry = entries.find(e => e.id === repoId);

    if (!entry) {
      res.status(404).json({ error: 'Repo not found' });
      return;
    }

    const storage = new Storage(repoId, String(entry.graphFile));
    const graph = storage.getGraph();
    storage.close();

    const fileNode = graph.nodes.find(
      (n: GraphNode) => n.label === 'File' && n.properties.filePath?.endsWith(filePath)
    );

    if (!fileNode) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const fileSymbols = graph.nodes.filter(
      (n: GraphNode) => n.properties.filePath === fileNode.properties.filePath && n.id !== fileNode.id
    );

    const incomingRels = graph.relationships.filter((r: GraphRelationship) => r.toId === fileNode.id);
    const outgoingRels = graph.relationships.filter((r: GraphRelationship) => r.fromId === fileNode.id);

    res.json({
      file: fileNode,
      symbols: fileSymbols,
      incomingEdges: incomingRels,
      outgoingEdges: outgoingRels,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/analyze - trigger re-index
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { path: repoPath } = req.body;
    if (!repoPath) {
      res.status(400).json({ error: 'Missing path' });
      return;
    }

    const { repoMetadata } = await runPipeline({ path: repoPath, verbose: false });
    res.json({ success: true, repo: repoMetadata });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export function startServer(port = 4747): Promise<void> {
  return new Promise(resolve => {
    app.listen(port, () => {
      console.log(`CodeGraph API server running at http://localhost:${port}`);
      resolve();
    });
  });
}
