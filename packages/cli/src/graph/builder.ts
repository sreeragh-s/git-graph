import type {
  GraphNode,
  GraphRelationship,
  KnowledgeGraph,
  FileInfo,
  ParsedSymbol,
  ParsedImport,
  ParsedCall,
  ParsedHeritage,
  ParsedProperty,
  RelationshipType,
} from '../types.js';

export class GraphBuilder {
  private nodes: Map<string, GraphNode> = new Map();
  private relationships: Map<string, GraphRelationship> = new Map();
  private symbolMap: Map<string, ParsedSymbol> = new Map();
  private filePathMap: Map<string, string> = new Map(); // normalized path -> file node id
  private classSymbolMap: Map<string, ParsedSymbol> = new Map(); // class name -> class symbol

  // Track unique IDs to avoid collisions
  private usedIds: Set<string> = new Set();

  private makeUniqueId(baseId: string): string {
    let id = baseId;
    let counter = 0;
    while (this.usedIds.has(id)) {
      id = `${baseId}_${counter++}`;
    }
    this.usedIds.add(id);
    return id;
  }

  addProject(name: string, path: string): string {
    const id = this.makeUniqueId('project');
    this.nodes.set(id, {
      id,
      label: 'Project',
      properties: { name, filePath: path },
    });
    return id;
  }

  addFolder(filePath: string, name: string, parentId?: string): string {
    const id = this.makeUniqueId(`folder_${filePath.replace(/[\/\\:]/g, '_')}`);
    this.nodes.set(id, {
      id,
      label: 'Folder',
      properties: { name, filePath },
    });
    if (parentId) {
      this.addRelationship(parentId, id, 'CONTAINS', 1.0);
    }
    return id;
  }

  addFile(fileInfo: FileInfo, parentId?: string): string {
    const id = this.makeUniqueId(`file_${fileInfo.path.replace(/[\/\\:]/g, '_')}`);
    this.nodes.set(id, {
      id,
      label: 'File',
      properties: {
        name: fileInfo.relativePath,
        filePath: fileInfo.path,
      },
    });
    this.filePathMap.set(fileInfo.path, id);
    if (parentId) {
      this.addRelationship(parentId, id, 'CONTAINS', 1.0);
    }
    return id;
  }

  addSymbol(symbol: ParsedSymbol, fileId: string): string {
    const id = this.makeUniqueId(symbol.id);
    symbol.id = id; // update with unique id
    this.nodes.set(id, {
      id,
      label: symbol.label,
      properties: {
        name: symbol.name,
        filePath: symbol.filePath,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
        isExported: symbol.isExported,
        returnType: symbol.returnType,
        parameterCount: symbol.parameterCount,
        extendsType: symbol.extendsType,
        implementsTypes: symbol.implementsTypes,
        declaredType: symbol.declaredType,
        isReadonly: symbol.isReadonly,
        isStatic: symbol.isStatic,
        isAsync: symbol.isAsync,
        decoratorName: symbol.decoratorName,
        constraintType: symbol.constraintType,
      },
    });
    this.symbolMap.set(`${symbol.filePath}:${symbol.name}`, symbol);
    if (symbol.label === 'Class') {
      this.classSymbolMap.set(symbol.name, symbol);
    }
    this.addRelationship(fileId, id, 'DEFINES', 1.0);
    return id;
  }

  addRelationship(
    fromId: string,
    toId: string,
    type: RelationshipType,
    confidence: number
  ): string {
    // Avoid self-loops and duplicate relationships
    if (fromId === toId) return '';
    const existing = Array.from(this.relationships.values()).find(
      r => r.fromId === fromId && r.toId === toId && r.type === type
    );
    if (existing) return existing.id;

    const id = this.makeUniqueId(`rel_${fromId}_${type}_${toId}`);
    const rel: GraphRelationship = { id, fromId, toId, type, confidence };
    this.relationships.set(id, rel);
    return id;
  }

  resolveImport(
    importStmt: ParsedImport,
    allSymbols: ParsedSymbol[],
    allImports: ParsedImport[]
  ): void {
    const sourceFileNodeId = this.filePathMap.get(importStmt.sourceFile);
    if (!sourceFileNodeId) return;

    // Resolve the import source path to an actual file node
    // Try to find matching exported symbols from the imported module
    const matchingSymbols = allSymbols.filter(sym => {
      if (!importStmt.isWildcard && importStmt.importedSymbols.length > 0) {
        return importStmt.importedSymbols.includes(sym.name);
      }
      return sym.isExported;
    });

    for (const sym of matchingSymbols) {
      const targetFileNodeId = this.filePathMap.get(sym.filePath);
      if (targetFileNodeId && targetFileNodeId !== sourceFileNodeId) {
        this.addRelationship(sourceFileNodeId, targetFileNodeId, 'IMPORTS', 0.9);
      }
    }
  }

  resolveHeritage(allHeritage: ParsedHeritage[]): void {
    for (const h of allHeritage) {
      const classNode = Array.from(this.nodes.values()).find(
        n => n.label === 'Class' &&
          n.properties.filePath === h.filePath &&
          n.properties.name === h.className
      );
      if (!classNode) continue;

      // EXTENDS relationship
      if (h.extendsType) {
        const parentNode = Array.from(this.nodes.values()).find(
          n => n.label === 'Class' && n.properties.name === h.extendsType
        );
        if (parentNode) {
          this.addRelationship(parentNode.id, classNode.id, 'EXTENDS', 1.0);
        }
      }

      // IMPLEMENTS relationships
      for (const implType of h.implementsTypes) {
        const interfaceNode = Array.from(this.nodes.values()).find(
          n => n.label === 'Interface' && n.properties.name === implType
        );
        if (interfaceNode) {
          this.addRelationship(interfaceNode.id, classNode.id, 'IMPLEMENTS', 1.0);
        } else {
          // Try to find as Type
          const typeNode = Array.from(this.nodes.values()).find(
            n => n.label === 'Type' && n.properties.name === implType
          );
          if (typeNode) {
            this.addRelationship(typeNode.id, classNode.id, 'IMPLEMENTS', 1.0);
          }
        }
      }
    }
  }

  resolveClassMembers(allSymbols: ParsedSymbol[], allProperties: ParsedProperty[]): void {
    // Group symbols by file
    const symbolsByFile = new Map<string, ParsedSymbol[]>();
    for (const sym of allSymbols) {
      if (!symbolsByFile.has(sym.filePath)) {
        symbolsByFile.set(sym.filePath, []);
      }
      symbolsByFile.get(sym.filePath)!.push(sym);
    }

    // For each class, connect its methods and properties
    const classes = allSymbols.filter(s => s.label === 'Class');
    for (const cls of classes) {
      const classNode = Array.from(this.nodes.values()).find(
        n => n.label === 'Class' && n.id === cls.id
      );
      if (!classNode) continue;

      const fileSyms = symbolsByFile.get(cls.filePath) ?? [];
      const methods = fileSyms.filter(s => s.label === 'Method');
      const properties = fileSyms.filter(s => s.label === 'Property');

      for (const method of methods) {
        const methodNode = Array.from(this.nodes.values()).find(
          n => n.label === 'Method' && n.id === method.id
        );
        if (methodNode) {
          this.addRelationship(classNode.id, methodNode.id, 'HAS_METHOD', 1.0);
        }
      }

      for (const prop of properties) {
        const propNode = Array.from(this.nodes.values()).find(
          n => n.label === 'Property' && n.id === prop.id
        );
        if (propNode) {
          this.addRelationship(classNode.id, propNode.id, 'HAS_PROPERTY', 1.0);
        }
      }
    }
  }

  resolveCalls(
    calls: ParsedCall[],
    allSymbols: ParsedSymbol[]
  ): void {
    for (const call of calls) {
      // Find the caller symbol (if any)
      const callerSymbols = allSymbols.filter(
        s => s.filePath === call.callerFile &&
          call.callerLine >= s.startLine &&
          call.callerLine <= s.endLine
      );
      const callerId = callerSymbols.length > 0
        ? `${callerSymbols[0].filePath}:${callerSymbols[0].name}:${callerSymbols[0].startLine}`
        : null;

      // Find the callee symbol
      const calleeSymbols = allSymbols.filter(s => s.name === call.calleeName);
      if (calleeSymbols.length === 0) continue;

      // Use the first matching exported symbol
      const callee = calleeSymbols.find(s => s.isExported) ?? calleeSymbols[0];

      if (callerId) {
        const callerNode = Array.from(this.nodes.values()).find(
          n => n.properties.filePath === call.callerFile &&
            call.callerLine >= (n.properties.startLine ?? 0) &&
            call.callerLine <= (n.properties.endLine ?? Infinity)
        );
        if (callerNode) {
          this.addRelationship(callerNode.id, callee.id, 'CALLS', 0.8);
        }
      } else {
        // If we can't find the caller, connect from the file
        const callerFileId = this.filePathMap.get(call.callerFile);
        if (callerFileId) {
          this.addRelationship(callerFileId, callee.id, 'CALLS', 0.5);
        }
      }
    }
  }

  build(): KnowledgeGraph {
    return {
      nodes: Array.from(this.nodes.values()),
      relationships: Array.from(this.relationships.values()),
    };
  }
}
