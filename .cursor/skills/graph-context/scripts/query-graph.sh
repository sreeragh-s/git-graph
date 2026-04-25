#!/bin/bash
# query-graph.sh - Query the code knowledge graph for files related to a keyword

set -e

if [ -z "$1" ]; then
  echo "Usage: query-graph.sh <repo-path> <keyword> [limit]"
  echo "  repo-path  - Path to the repository"
  echo "  keyword    - Keyword to search for in symbol/file names"
  echo "  limit      - Max number of results (default: 20)"
  exit 1
fi

REPO_PATH="$1"
KEYWORD="$2"
LIMIT="${3:-20}"

# Find repo id from registry
REGISTRY="$HOME/.code-graph/registry.json"
if [ ! -f "$REGISTRY" ]; then
  echo "No repositories indexed. Run: node packages/cli/dist/index.js analyze <path>"
  exit 1
fi

REPO_ID=$(node -e "
const fs = require('fs');
const repos = JSON.parse(fs.readFileSync('$REGISTRY'));
const r = repos.find(e => e.path === '$REPO_PATH');
console.log(r ? r.id : '');
" 2>/dev/null)

if [ -z "$REPO_ID" ]; then
  echo "Repository not found in registry: $REPO_PATH"
  echo "Run: node packages/cli/dist/index.js analyze $REPO_PATH"
  exit 1
fi

GRAPH_FILE="$HOME/.code-graph/repos/$REPO_ID/graph.db"
if [ ! -f "$GRAPH_FILE" ]; then
  echo "Graph data not found. Run: node packages/cli/dist/index.js analyze $REPO_PATH"
  exit 1
fi

# Search for symbol nodes matching keyword
echo "=== Symbols matching '$KEYWORD' ==="
node -e "
const fs = require('fs');
const graph = JSON.parse(fs.readFileSync('$GRAPH_FILE'));
const kw = '$KEYWORD'.toLowerCase();
const matches = graph.nodes.filter(n => 
  n.label !== 'Project' && n.label !== 'Folder' && n.label !== 'File' &&
  n.properties.name && n.properties.name.toLowerCase().includes(kw)
).slice(0, $LIMIT);
matches.forEach(n => {
  console.log(n.properties.name + ' [' + n.label + '] @ ' + n.properties.filePath + ':' + n.properties.startLine);
});
" 2>/dev/null

echo ""
echo "=== Files containing '$KEYWORD' symbols ==="
node -e "
const fs = require('fs');
const graph = JSON.parse(fs.readFileSync('$GRAPH_FILE'));
const kw = '$KEYWORD'.toLowerCase();
const files = {};
graph.nodes.filter(n => 
  n.label !== 'Project' && n.label !== 'Folder' && n.label !== 'File' &&
  n.properties.name && n.properties.name.toLowerCase().includes(kw)
).forEach(n => {
  if (!files[n.properties.filePath]) files[n.properties.filePath] = [];
  files[n.properties.filePath].push(n.properties.name + ' [' + n.label + ']');
});
Object.entries(files).slice(0, 10).forEach(([path, symbols]) => {
  console.log(path);
  symbols.slice(0, 5).forEach(s => console.log('  - ' + s));
});
" 2>/dev/null

echo ""
echo "=== Relationships for '$KEYWORD' symbols ==="
node -e "
const fs = require('fs');
const graph = JSON.parse(fs.readFileSync('$GRAPH_FILE'));
const kw = '$KEYWORD'.toLowerCase();
const symIds = new Set(graph.nodes.filter(n => 
  n.label !== 'Project' && n.label !== 'Folder' && n.label !== 'File' &&
  n.properties.name && n.properties.name.toLowerCase().includes(kw)
).map(n => n.id));

const rels = graph.relationships.filter(r => symIds.has(r.fromId) || symIds.has(r.toId));
const types = {};
rels.forEach(r => {
  if (!types[r.type]) types[r.type] = 0;
  types[r.type]++;
});
Object.entries(types).slice(0, 10).forEach(([type, count]) => {
  console.log(type + ': ' + count);
});
" 2>/dev/null
