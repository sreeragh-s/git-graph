import type { KnowledgeGraph, FileInfo, ParsedSymbol, ParsedImport, ParsedCall, ParsedHeritage, ParsedProperty, RelationshipType } from '../types.js';
export declare class GraphBuilder {
    private nodes;
    private relationships;
    private symbolMap;
    private filePathMap;
    private classSymbolMap;
    private usedIds;
    private makeUniqueId;
    addProject(name: string, path: string): string;
    addFolder(filePath: string, name: string, parentId?: string): string;
    addFile(fileInfo: FileInfo, parentId?: string): string;
    addSymbol(symbol: ParsedSymbol, fileId: string): string;
    addRelationship(fromId: string, toId: string, type: RelationshipType, confidence: number): string;
    resolveImport(importStmt: ParsedImport, allSymbols: ParsedSymbol[], allImports: ParsedImport[]): void;
    resolveHeritage(allHeritage: ParsedHeritage[]): void;
    resolveClassMembers(allSymbols: ParsedSymbol[], allProperties: ParsedProperty[]): void;
    resolveCalls(calls: ParsedCall[], allSymbols: ParsedSymbol[]): void;
    build(): KnowledgeGraph;
}
