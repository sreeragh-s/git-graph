import type { FileInfo, ParsedSymbol, ParsedImport, ParsedCall, ParsedHeritage, ParsedProperty } from './types.js';
export declare function parseFiles(files: FileInfo[]): {
    allSymbols: ParsedSymbol[];
    allImports: ParsedImport[];
    allCalls: ParsedCall[];
    allHeritage: ParsedHeritage[];
    allProperties: ParsedProperty[];
};
