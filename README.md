# CodeGraph — Visual Code Explorer

A CLI-first code knowledge graph tool that indexes local GitHub repositories and renders an interactive graph visualization in the browser.

## Features

- **Code Indexing**: Parses TypeScript/JavaScript files using tree-sitter to extract functions, classes, methods, imports, and call relationships
- **Knowledge Graph**: Builds a graph of your codebase — Files, Folders, Classes, Functions, Methods, and how they connect via IMPORTS and CALLS edges
- **Interactive Visualization**: Sigma.js powered graph explorer with zoom, pan, hover, click-to-inspect, and ForceAtlas2 layout
- **CLI-first**: Analyze repos from the command line, serve the web UI locally
- **Local-first**: All data stays on your machine — no cloud, no uploads

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Index a repository

```bash
npm run dev:cli -- analyze /path/to/your/repo
```

### Start the web UI

```bash
npm run dev:cli -- serve
```

Then open http://localhost:4747 in your browser.

### Or run both in dev mode

```bash
# Terminal 1: Start the API server
npm run dev:cli -- serve

# Terminal 2: Analyze a repo
npm run dev:cli -- analyze /path/to/repo
```

### CLI Commands

```bash
# Index a repository
codegraph analyze /path/to/repo

# Start the web UI server
codegraph serve

# List all indexed repositories
codegraph list

# Remove a repository from the index
codegraph clean /path/to/repo
```

## How It Works

```
analyze <path>  →  scan files  →  parse (tree-sitter)  →  build graph  →  store (SQLite)
                                                                        ↓
                                                                      serve
                                                                        ↓
                                              ┌──────────────────────────────┐
                                              │  Web UI (Sigma.js)           │
                                              │  Interactive graph explorer  │
                                              └──────────────────────────────┘
```

### Pipeline Phases

| Phase | What it does |
|-------|-------------|
| **Scan** | Walk the directory, skip `node_modules` and other build artifacts |
| **Parse** | Use tree-sitter to extract symbols (functions, classes, methods) and imports |
| **Build** | Construct in-memory knowledge graph with File/Folder/Symbol nodes |
| **Resolve** | Cross-file import resolution and call graph resolution |
| **Store** | Persist graph to SQLite in `~/.code-graph/repos/` |

### Node Types

- **Project** — the root
- **Folder** — directory structure
- **File** — source files (`.ts`, `.tsx`, `.js`, `.jsx`)
- **Class** — class declarations
- **Function** — function declarations and arrow functions
- **Method** — methods inside classes

### Relationship Types

- **CONTAINS** — folder hierarchy
- **DEFINES** — file contains symbol
- **IMPORTS** — file imports from another file
- **CALLS** — function/method calls another

## Tech Stack

| Layer | Technology |
|-------|-----------|
| CLI | Node.js, TypeScript, tree-sitter |
| Storage | SQLite (better-sqlite3) |
| API | Express.js |
| Web UI | React 18, TypeScript, Vite |
| Visualization | Sigma.js v3, Graphology |
| Layout | ForceAtlas2 |

## Adding a New Language

The parser in `packages/cli/src/parser.ts` uses tree-sitter. To add a language:

1. Add the tree-sitter language package: `npm install tree-sitter-<lang>`
2. Import it and set it on the parser
3. Add language detection in `scanner.ts`
4. Add symbol extraction cases in the tree walker

## Project Structure

```
code-graph/
├── package.json              # Workspace root
├── packages/
│   ├── cli/                  # CLI + indexing engine
│   │   └── src/
│   │       ├── index.ts      # Commander CLI entry
│   │       ├── scanner.ts    # File tree walk
│   │       ├── parser.ts     # tree-sitter parsing
│   │       ├── pipeline/     # Pipeline orchestrator
│   │       ├── graph/        # Graph builder + SQLite storage
│   │       └── server/       # Express API server
│   └── web/                  # React web UI
│       └── src/
│           ├── App.tsx        # Main app
│           ├── components/
│           │   ├── GraphCanvas.tsx   # Sigma.js visualization
│           │   ├── FolderPicker.tsx # Repo selector
│           │   └── NodeDetails.tsx   # Node inspector panel
│           └── lib/
│               └── graph-adapter.ts  # Graph → Sigma converter
└── README.md
```
