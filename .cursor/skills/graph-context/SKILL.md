---
name: graph-context
description: Uses code knowledge graph to retrieve files related to a feature or topic. Use when user asks about how something is implemented, asks for files related to a feature, or wants context about code components and their connections.
---

# Graph Context Skill

Use the code knowledge graph CLI to retrieve relevant file context based on a user's question about code structure.

## When to Use

- User asks "how is X implemented", "show me files related to X"
- User wants to understand the structure of a feature or module
- User asks about connections between code components

## Quick Usage

```bash
# Query the graph for a keyword (e.g., "graph", "parser", "auth")
./.cursor/skills/graph-context/scripts/query-graph.sh /path/to/repo "keyword"
```

The script outputs matching symbols, their files, and relationship counts.

## What to Do with Results

1. **Read the top files** — files with multiple matching symbols are likely central to the feature
2. **Follow DEFINES/CALLS relationships** — understand how symbols connect
3. **Build a summary** — tell the user which files handle the feature and how they're connected

## Example

User asks: "how is the graph built?"

1. Run: `query-graph.sh /path/to/codex "graph"`
2. See `GraphBuilder [Class]` in `packages/cli/src/graph/builder.ts`
3. Read that file and related graph files
4. Explain: "The graph is built by `GraphBuilder` which creates nodes for symbols and resolves relationships like CALLS and IMPORTS"

## Required Setup

The repo must be indexed first:
```bash
node packages/cli/dist/index.js analyze /path/to/repo
```

Graph data is stored at: `~/.code-graph/repos/<repo-id>/graph.db`
