import * as fs from 'node:fs';
import { parse } from '@babel/parser';
import type {
  FileInfo,
  ParsedSymbol,
  ParsedImport,
  ParsedCall,
  ParsedHeritage,
  ParsedProperty,
} from './types.js';

type Node = {
  type: string;
  loc?: { start: { line: number }; end: { line: number } } | null;
  [key: string]: unknown;
};

interface ParseResult {
  symbols: ParsedSymbol[];
  imports: ParsedImport[];
  calls: ParsedCall[];
  heritage: ParsedHeritage[];
  properties: ParsedProperty[];
}

function generateId(filePath: string, name: string, line: number): string {
  const str = `${filePath}:${name}:${line}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function getLine(node: Node): number {
  return (node.loc?.start.line ?? 1) as number;
}

function getEndLine(node: Node): number {
  return (node.loc?.end.line ?? getLine(node)) as number;
}

function nodeType(node: Node): string {
  return node.type as string;
}

function isType(node: Node, type: string): boolean {
  return nodeType(node) === type;
}

function getName(node: Node): string | null {
  if (isType(node, 'Identifier') || isType(node, 'PrivateName')) {
    return String((node as Node & { name: unknown }).name);
  }
  return null;
}

function getStrValue(node: Node): string | null {
  if (isType(node, 'StringLiteral')) {
    return String((node as Node & { value: unknown }).value);
  }
  if (isType(node, 'Literal') && typeof (node as Node & { value: unknown }).value === 'string') {
    return String((node as Node & { value: unknown }).value);
  }
  return null;
}

function getMemberExprName(node: Node): string | null {
  if (!isType(node, 'MemberExpression')) return null;
  const obj = (node as Node & { object: Node }).object;
  const prop = (node as Node & { property: Node }).property;
  const objName = getName(obj) ?? '';
  let propName: string | null = null;

  if (isType(prop, 'Identifier')) propName = getName(prop);
  else if (isType(prop, 'StringLiteral') || isType(prop, 'Literal')) propName = getStrValue(prop);

  if (!propName) return objName;
  return `${objName}.${propName}`;
}

function getCalleeName(callNode: Node): string | null {
  const callee = (callNode as Node & { callee: Node }).callee;
  if (!callee) return null;
  if (isType(callee, 'Identifier')) return getName(callee);
  if (isType(callee, 'MemberExpression')) return getMemberExprName(callee);
  return null;
}

function getMethodName(node: Node): string {
  const key = (node as Node & { key: Node }).key;
  const kind = (node as Node & { kind: string }).kind;
  if (!key) return 'unknown';
  if (isType(key, 'Identifier')) {
    if (kind === 'get') return `get ${key.name}`;
    if (kind === 'set') return `set ${key.name}`;
    return key.name as string;
  }
  if (isType(key, 'StringLiteral') || isType(key, 'Literal')) {
    return String((key as Node & { value: unknown }).value);
  }
  return 'unknown';
}

function getTypeAnnotation(node: Node): string | undefined {
  const typeAnnotation = (node as Node & { typeAnnotation: Node | null }).typeAnnotation;
  if (!typeAnnotation) return undefined;
  return getTypeAnnotationStr(typeAnnotation);
}

function getTypeAnnotationStr(node: Node): string {
  if (isType(node, 'TSTypeReference')) {
    const typeName = (node as Node & { typeName: Node }).typeName;
    return getName(typeName) ?? 'unknown';
  }
  if (isType(node, 'TSQualifiedName')) {
    const left = (node as Node & { left: Node }).left;
    const right = (node as Node & { right: Node }).right;
    const leftName = getName(left) ?? '';
    const rightName = getName(right) ?? '';
    return `${leftName}.${rightName}`;
  }
  if (isType(node, 'TSArrayType')) {
    const elementType = (node as Node & { elementType: Node }).elementType;
    return `${getTypeAnnotationStr(elementType)}[]`;
  }
  if (isType(node, 'TSUnionType')) {
    const types = ((node as Node & { types: Node[] }).types ?? []) as Node[];
    return types.map(getTypeAnnotationStr).join(' | ');
  }
  if (isType(node, 'TSIntersectionType')) {
    const types = ((node as Node & { types: Node[] }).types ?? []) as Node[];
    return types.map(getTypeAnnotationStr).join(' & ');
  }
  if (isType(node, 'TSVoidKeyword')) return 'void';
  if (isType(node, 'TSNullKeyword')) return 'null';
  if (isType(node, 'TSUndefinedKeyword')) return 'undefined';
  if (isType(node, 'TSNeverKeyword')) return 'never';
  if (isType(node, 'TSAnyKeyword')) return 'any';
  if (isType(node, 'TSNumberKeyword')) return 'number';
  if (isType(node, 'TSStringKeyword')) return 'string';
  if (isType(node, 'TSBooleanKeyword')) return 'boolean';
  if (isType(node, 'TSSymbolKeyword')) return 'symbol';
  if (isType(node, 'TSBigIntKeyword')) return 'bigint';
  if (isType(node, 'TSObjectKeyword')) return 'object';
  if (isType(node, 'TSFunctionType')) return 'Function';
  if (isType(node, 'TSConstructorType')) return 'new (...args) => any';
  if (isType(node, 'Literal')) return typeof (node as Node & { value: unknown }).value === 'string' ? 'string' : 'number';
  if (isType(node, 'Identifier')) return getName(node) ?? 'unknown';
  if (isType(node, 'StringLiteral')) return 'string';
  return 'unknown';
}

function getDecoratorName(node: Node): string | null {
  if (isType(node, 'CallExpression')) {
    return getCalleeName(node);
  }
  if (isType(node, 'Identifier')) {
    return getName(node);
  }
  return null;
}

function getChildren(node: Node): Node[] {
  const children: Node[] = [];
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'loc' || key === 'leadingComments' || key === 'innerComments') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === 'object' && 'type' in (item as object)) {
          children.push(item as Node);
        }
      }
    } else if (val && typeof val === 'object' && 'type' in (val as object)) {
      children.push(val as Node);
    }
  }
  return children;
}

interface Visitor {
  onClass?: (node: Node, heritage: { extendsType?: string; implementsTypes: string[] }) => void;
  onFunction?: (node: Node, isExported: boolean) => void;
  onArrowFunction?: (node: Node, declarator: Node, isExported: boolean) => void;
  onClassMethod?: (node: Node, isStatic: boolean) => void;
  onClassProperty?: (node: Node, isStatic: boolean) => void;
  onInterface?: (node: Node) => void;
  onTypeAlias?: (node: Node) => void;
  onEnum?: (node: Node) => void;
  onVariable?: (node: Node, isExported: boolean) => void;
  onDecorator?: (node: Node) => void;
  onTypeParameter?: (node: Node) => void;
  onImport?: (node: Node) => void;
  onCall?: (node: Node) => void;
}

// Blocks descent into function/class bodies for variable extraction
const BLOCK_SCOPE = new Set([
  'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression',
  'ClassMethod', 'ObjectMethod', 'ClassPrivateMethod', 'ClassBody',
]);

function walk(node: Node, visitor: Visitor, ancestors: Node[] = []): void {
  const type = nodeType(node);
  const parentInScope = ancestors.some(a => BLOCK_SCOPE.has(nodeType(a)));

  if (type === 'ImportDeclaration' && visitor.onImport) {
    visitor.onImport(node);
  } else if (type === 'ClassDeclaration' && visitor.onClass) {
    // Extract heritage
    const superClass = (node as Node & { superClass: Node | null }).superClass;
    const implementsClause = (node as Node & { implements: Node[] | null }).implements;
    let extendsType: string | undefined;
    if (superClass) {
      extendsType = isType(superClass, 'Identifier')
        ? getName(superClass) ?? undefined
        : getTypeAnnotationStr(superClass);
    }
    const implementsTypes: string[] = [];
    if (implementsClause) {
      for (const impl of implementsClause as Node[]) {
        if (isType(impl, 'TSExpressionWithTypeArguments')) {
          const expr = (impl as Node & { expression: Node }).expression;
          const name = getName(expr) ?? getTypeAnnotationStr(expr);
          if (name) implementsTypes.push(name);
        } else {
          const name = getName(impl) ?? getTypeAnnotationStr(impl);
          if (name) implementsTypes.push(name);
        }
      }
    }
    visitor.onClass(node, { extendsType, implementsTypes });
  } else if (type === 'FunctionDeclaration' && visitor.onFunction) {
    const isExported = ancestors.some(a => isType(a, 'ExportNamedDeclaration'));
    visitor.onFunction(node, isExported);
  } else if (type === 'ClassMethod' && visitor.onClassMethod) {
    const isStatic = !!(node as Node & { static: boolean }).static;
    visitor.onClassMethod(node, isStatic);
  } else if (type === 'ClassProperty' && visitor.onClassProperty) {
    const isStatic = !!(node as Node & { static: boolean }).static;
    visitor.onClassProperty(node, isStatic);
  } else if (type === 'TSInterfaceDeclaration' && visitor.onInterface) {
    visitor.onInterface(node);
  } else if (type === 'TSTypeAliasDeclaration' && visitor.onTypeAlias) {
    visitor.onTypeAlias(node);
  } else if (type === 'TSEnumDeclaration' && visitor.onEnum) {
    visitor.onEnum(node);
  } else if (type === 'Decorator' && visitor.onDecorator) {
    visitor.onDecorator(node);
  } else if (type === 'TSTypeParameter' && visitor.onTypeParameter) {
    visitor.onTypeParameter(node);
  } else if (type === 'VariableDeclaration' && visitor.onVariable) {
    if (!parentInScope) {
      // Top-level/module-scope variable declarations only
      const isExported = ancestors.some(a => isType(a, 'ExportNamedDeclaration'));
      visitor.onVariable(node, isExported);
    }
  } else if (type === 'VariableDeclaration' && visitor.onArrowFunction) {
    // Arrow functions assigned to top-level variables
    if (!parentInScope) {
      for (const decl of ((node as Node & { declarations: Node[] }).declarations ?? []) as Node[]) {
        if (isType(decl, 'VariableDeclarator')) {
          const init = (decl as Node & { init: Node | null }).init;
          if (init && isType(init, 'ArrowFunctionExpression')) {
            const isExported = ancestors.some(a => isType(a, 'ExportNamedDeclaration'));
            visitor.onArrowFunction(init, decl, isExported);
          }
        }
      }
    }
  }

  if (type === 'CallExpression' && visitor.onCall) {
    visitor.onCall(node);
  }

  if (!BLOCK_SCOPE.has(type)) {
    for (const child of getChildren(node)) {
      walk(child, visitor, [...ancestors, node]);
    }
  } else {
    // For function-like nodes, walk children but track that we're inside a scope
    for (const child of getChildren(node)) {
      walk(child, visitor, [...ancestors, node]);
    }
  }
}

function parseFile(fileInfo: FileInfo): ParseResult {
  const symbols: ParsedSymbol[] = [];
  const imports: ParsedImport[] = [];
  const calls: ParsedCall[] = [];
  const heritage: ParsedHeritage[] = [];
  const properties: ParsedProperty[] = [];

  let sourceCode: string;
  try {
    sourceCode = fs.readFileSync(fileInfo.path, 'utf-8');
  } catch {
    return { symbols, imports, calls, heritage, properties };
  }

  let ast: Node;
  try {
    ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties'],
      tokens: false,
    }) as unknown as Node;
  } catch {
    return { symbols, imports, calls, heritage, properties };
  }

  const classNameToId = new Map<string, string>();

  walk(ast, {
    onClass(node, heritageInfo) {
      const id = (node as Node & { id: Node }).id;
      const name = getName(id) ?? 'AnonymousClass';
      const nodeId = generateId(fileInfo.path, name, getLine(node));
      classNameToId.set(name, nodeId);

      // Collect class-level decorators
      const decorators: string[] = [];
      const classDecorators = (node as Node & { decorators: Node[] | null }).decorators;
      if (classDecorators) {
        for (const dec of classDecorators as Node[]) {
          const dn = getDecoratorName(dec);
          if (dn) decorators.push(dn);
        }
      }

      symbols.push({
        id: nodeId,
        name,
        label: 'Class',
        filePath: fileInfo.path,
        startLine: getLine(node),
        endLine: getEndLine(node),
        isExported: false,
        extendsType: heritageInfo.extendsType,
        implementsTypes: heritageInfo.implementsTypes,
        annotations: decorators.length > 0 ? decorators : undefined,
      });

      heritage.push({
        filePath: fileInfo.path,
        className: name,
        extendsType: heritageInfo.extendsType,
        implementsTypes: heritageInfo.implementsTypes,
      });
    },

    onFunction(node, isExported) {
      const name = getName((node as Node & { id: Node }).id) ?? 'anonymous';
      const asyncKeyword = !!(node as Node & { async: boolean }).async;
      const params = ((node as Node & { params: Node[] }).params ?? []) as Node[];
      symbols.push({
        id: generateId(fileInfo.path, name, getLine(node)),
        name,
        label: 'Function',
        filePath: fileInfo.path,
        startLine: getLine(node),
        endLine: getEndLine(node),
        isExported,
        parameterCount: params.length,
        isAsync: asyncKeyword,
      });
    },

    onArrowFunction(arrowNode, declarator, isExported) {
      const name = getName((declarator as Node & { id: Node }).id);
      if (!name) return;
      const params = ((arrowNode as Node & { params: Node[] }).params ?? []) as Node[];
      symbols.push({
        id: generateId(fileInfo.path, name, getLine(arrowNode)),
        name,
        label: 'Function',
        filePath: fileInfo.path,
        startLine: getLine(arrowNode),
        endLine: getEndLine(arrowNode),
        isExported,
        parameterCount: params.length,
        isAsync: !!(arrowNode as Node & { async: boolean }).async,
      });
    },

    onClassMethod(node, isStatic) {
      const kind = (node as Node & { kind: string }).kind;
      if (kind === 'constructor') return;
      const params = ((node as Node & { params: Node[] }).params ?? []) as Node[];
      symbols.push({
        id: generateId(fileInfo.path, getMethodName(node), getLine(node)),
        name: getMethodName(node),
        label: 'Method',
        filePath: fileInfo.path,
        startLine: getLine(node),
        endLine: getEndLine(node),
        isExported: true,
        parameterCount: params.length,
        isStatic,
        isAsync: !!(node as Node & { async: boolean }).async,
      });
    },

    onClassProperty(node, isStatic) {
      const key = (node as Node & { key: Node }).key;
      const name = getName(key) ?? 'unknown';
      const readonly = !!(node as Node & { readonly: boolean }).readonly;
      const declaredType = getTypeAnnotation(node);

      symbols.push({
        id: generateId(fileInfo.path, name, getLine(node)),
        name,
        label: 'Property',
        filePath: fileInfo.path,
        startLine: getLine(node),
        endLine: getEndLine(node),
        isExported: false,
        declaredType,
        isReadonly: readonly,
        isStatic,
      });

      properties.push({
        name,
        filePath: fileInfo.path,
        startLine: getLine(node),
        endLine: getEndLine(node),
        isExported: false,
        declaredType,
        isReadonly: readonly,
        isStatic,
      });
    },

    onInterface(node) {
      const name = getName((node as Node & { id: Node }).id) ?? 'AnonymousInterface';
      const typeParams = ((node as Node & { typeParameters: Node | null }).typeParameters) as Node | null;
      let constraintType: string | undefined;
      if (typeParams) {
        const params = ((typeParams as Node & { params: Node[] }).params ?? []) as Node[];
        if (params.length > 0) {
          constraintType = params.map(p => getName(p) ?? getTypeAnnotationStr(p)).join(', ');
        }
      }
      symbols.push({
        id: generateId(fileInfo.path, name, getLine(node)),
        name,
        label: 'Interface',
        filePath: fileInfo.path,
        startLine: getLine(node),
        endLine: getEndLine(node),
        isExported: false,
        constraintType,
      });
    },

    onTypeAlias(node) {
      const name = getName((node as Node & { id: Node }).id) ?? 'AnonymousType';
      const typeAnnotation = getTypeAnnotation(node);
      symbols.push({
        id: generateId(fileInfo.path, name, getLine(node)),
        name,
        label: 'Type',
        filePath: fileInfo.path,
        startLine: getLine(node),
        endLine: getEndLine(node),
        isExported: false,
        returnType: typeAnnotation,
      });
    },

    onEnum(node) {
      const name = getName((node as Node & { id: Node }).id) ?? 'AnonymousEnum';
      symbols.push({
        id: generateId(fileInfo.path, name, getLine(node)),
        name,
        label: 'Enum',
        filePath: fileInfo.path,
        startLine: getLine(node),
        endLine: getEndLine(node),
        isExported: false,
      });
    },

    onVariable(node, isExported) {
      for (const decl of ((node as Node & { declarations: Node[] }).declarations ?? []) as Node[]) {
        const declId = (decl as Node & { id: Node }).id;
        const name = getName(declId);
        if (!name) continue;
        const declaredType = getTypeAnnotation(decl);
        symbols.push({
          id: generateId(fileInfo.path, name, getLine(decl)),
          name,
          label: 'Variable',
          filePath: fileInfo.path,
          startLine: getLine(decl),
          endLine: getEndLine(decl),
          isExported,
          declaredType,
        });
      }
    },

    onDecorator(node) {
      const decoratorName = getDecoratorName(node);
      if (!decoratorName) return;
      symbols.push({
        id: generateId(fileInfo.path, decoratorName, getLine(node)),
        name: decoratorName,
        label: 'Decorator',
        filePath: fileInfo.path,
        startLine: getLine(node),
        endLine: getEndLine(node),
        isExported: false,
        decoratorName,
      });
    },

    onTypeParameter(node) {
      const name = getName((node as Node & { name: Node }).name) ?? 'T';
      const constraint = (node as Node & { constraint: Node | null }).constraint;
      let constraintType: string | undefined;
      if (constraint) {
        constraintType = getTypeAnnotationStr(constraint);
      }
      symbols.push({
        id: generateId(fileInfo.path, name, getLine(node)),
        name,
        label: 'TypeParameter',
        filePath: fileInfo.path,
        startLine: getLine(node),
        endLine: getEndLine(node),
        isExported: false,
        constraintType,
      });
    },

    onImport(node) {
      const source = getStrValue((node as Node & { source: Node }).source);
      if (!source) return;
      const specifiers: string[] = [];
      let isDefault = false;
      let isWildcard = false;

      for (const spec of ((node as Node & { specifiers: Node[] }).specifiers ?? []) as Node[]) {
        const stype = nodeType(spec);
        if (stype === 'ImportDefaultSpecifier') {
          isDefault = true;
          specifiers.push('default');
        } else if (stype === 'ImportSpecifier') {
          const imported = (spec as Node & { imported: Node }).imported;
          const name = getName(imported);
          specifiers.push(name ?? '');
        } else if (stype === 'ImportNamespaceSpecifier') {
          isWildcard = true;
          specifiers.push(getName((spec as Node & { local: Node }).local) ?? '*');
        }
      }

      imports.push({
        sourceFile: fileInfo.path,
        sourcePath: source,
        importedSymbols: specifiers,
        isDefault,
        isWildcard,
      });
    },

    onCall(node) {
      const calleeName = getCalleeName(node);
      if (!calleeName) return;
      calls.push({
        callerFile: fileInfo.path,
        callerLine: getLine(node),
        calleeName,
      });
    },
  });

  // Mark exported symbols (second pass via checkExports that descends everywhere)
  const exportedNames = new Set<string>();
  function checkExports(node: Node): void {
    if (nodeType(node) === 'ExportNamedDeclaration') {
      const decl = (node as Node & { declaration: Node | null }).declaration;
      if (decl) {
        if (isType(decl, 'ClassDeclaration')) {
          const name = getName((decl as Node & { id: Node }).id);
          if (name) exportedNames.add(name);
        } else if (isType(decl, 'FunctionDeclaration')) {
          const name = getName((decl as Node & { id: Node }).id);
          if (name) exportedNames.add(name);
        } else if (isType(decl, 'TSInterfaceDeclaration')) {
          const name = getName((decl as Node & { id: Node }).id);
          if (name) exportedNames.add(name);
        } else if (isType(decl, 'TSTypeAliasDeclaration')) {
          const name = getName((decl as Node & { id: Node }).id);
          if (name) exportedNames.add(name);
        } else if (isType(decl, 'TSEnumDeclaration')) {
          const name = getName((decl as Node & { id: Node }).id);
          if (name) exportedNames.add(name);
        } else if (isType(decl, 'VariableDeclaration')) {
          const declarations = ((decl as Node & { declarations: Node[] }).declarations ?? []) as Node[];
          for (const d of declarations) {
            const declId = (d as Node & { id: Node }).id;
            const name = getName(declId);
            if (name) exportedNames.add(name);
          }
        }
      }
    }
    for (const child of getChildren(node)) {
      checkExports(child);
    }
  }
  checkExports(ast);

  for (const sym of symbols) {
    if (exportedNames.has(sym.name)) {
      sym.isExported = true;
    }
  }

  return { symbols, imports, calls, heritage, properties };
}

export function parseFiles(files: FileInfo[]): {
  allSymbols: ParsedSymbol[];
  allImports: ParsedImport[];
  allCalls: ParsedCall[];
  allHeritage: ParsedHeritage[];
  allProperties: ParsedProperty[];
} {
  const allSymbols: ParsedSymbol[] = [];
  const allImports: ParsedImport[] = [];
  const allCalls: ParsedCall[] = [];
  const allHeritage: ParsedHeritage[] = [];
  const allProperties: ParsedProperty[] = [];

  for (const file of files) {
    if (file.language === 'unknown') continue;
    const result = parseFile(file);
    allSymbols.push(...result.symbols);
    allImports.push(...result.imports);
    allCalls.push(...result.calls);
    allHeritage.push(...result.heritage);
    allProperties.push(...result.properties);
  }

  return { allSymbols, allImports, allCalls, allHeritage, allProperties };
}
