import * as fs from 'node:fs';
import { parse } from '@babel/parser';
function generateId(filePath, name, line) {
    const str = `${filePath}:${name}:${line}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
}
function getLine(node) {
    return (node.loc?.start.line ?? 1);
}
function getEndLine(node) {
    return (node.loc?.end.line ?? getLine(node));
}
function nodeType(node) {
    return node.type;
}
function isType(node, type) {
    return nodeType(node) === type;
}
function getName(node) {
    if (isType(node, 'Identifier') || isType(node, 'PrivateName')) {
        return String(node.name);
    }
    return null;
}
function getStrValue(node) {
    if (isType(node, 'StringLiteral')) {
        return String(node.value);
    }
    if (isType(node, 'Literal') && typeof node.value === 'string') {
        return String(node.value);
    }
    return null;
}
function getMemberExprName(node) {
    if (!isType(node, 'MemberExpression'))
        return null;
    const obj = node.object;
    const prop = node.property;
    const objName = getName(obj) ?? '';
    let propName = null;
    if (isType(prop, 'Identifier'))
        propName = getName(prop);
    else if (isType(prop, 'StringLiteral') || isType(prop, 'Literal'))
        propName = getStrValue(prop);
    if (!propName)
        return objName;
    return `${objName}.${propName}`;
}
function getCalleeName(callNode) {
    const callee = callNode.callee;
    if (!callee)
        return null;
    if (isType(callee, 'Identifier'))
        return getName(callee);
    if (isType(callee, 'MemberExpression'))
        return getMemberExprName(callee);
    return null;
}
function getMethodName(node) {
    const key = node.key;
    const kind = node.kind;
    if (!key)
        return 'unknown';
    if (isType(key, 'Identifier')) {
        if (kind === 'get')
            return `get ${key.name}`;
        if (kind === 'set')
            return `set ${key.name}`;
        return key.name;
    }
    if (isType(key, 'StringLiteral') || isType(key, 'Literal')) {
        return String(key.value);
    }
    return 'unknown';
}
function getTypeAnnotation(node) {
    const typeAnnotation = node.typeAnnotation;
    if (!typeAnnotation)
        return undefined;
    return getTypeAnnotationStr(typeAnnotation);
}
function getTypeAnnotationStr(node) {
    if (isType(node, 'TSTypeReference')) {
        const typeName = node.typeName;
        return getName(typeName) ?? 'unknown';
    }
    if (isType(node, 'TSQualifiedName')) {
        const left = node.left;
        const right = node.right;
        const leftName = getName(left) ?? '';
        const rightName = getName(right) ?? '';
        return `${leftName}.${rightName}`;
    }
    if (isType(node, 'TSArrayType')) {
        const elementType = node.elementType;
        return `${getTypeAnnotationStr(elementType)}[]`;
    }
    if (isType(node, 'TSUnionType')) {
        const types = (node.types ?? []);
        return types.map(getTypeAnnotationStr).join(' | ');
    }
    if (isType(node, 'TSIntersectionType')) {
        const types = (node.types ?? []);
        return types.map(getTypeAnnotationStr).join(' & ');
    }
    if (isType(node, 'TSVoidKeyword'))
        return 'void';
    if (isType(node, 'TSNullKeyword'))
        return 'null';
    if (isType(node, 'TSUndefinedKeyword'))
        return 'undefined';
    if (isType(node, 'TSNeverKeyword'))
        return 'never';
    if (isType(node, 'TSAnyKeyword'))
        return 'any';
    if (isType(node, 'TSNumberKeyword'))
        return 'number';
    if (isType(node, 'TSStringKeyword'))
        return 'string';
    if (isType(node, 'TSBooleanKeyword'))
        return 'boolean';
    if (isType(node, 'TSSymbolKeyword'))
        return 'symbol';
    if (isType(node, 'TSBigIntKeyword'))
        return 'bigint';
    if (isType(node, 'TSObjectKeyword'))
        return 'object';
    if (isType(node, 'TSFunctionType'))
        return 'Function';
    if (isType(node, 'TSConstructorType'))
        return 'new (...args) => any';
    if (isType(node, 'Literal'))
        return typeof node.value === 'string' ? 'string' : 'number';
    if (isType(node, 'Identifier'))
        return getName(node) ?? 'unknown';
    if (isType(node, 'StringLiteral'))
        return 'string';
    return 'unknown';
}
function getDecoratorName(node) {
    if (isType(node, 'CallExpression')) {
        return getCalleeName(node);
    }
    if (isType(node, 'Identifier')) {
        return getName(node);
    }
    return null;
}
function getChildren(node) {
    const children = [];
    for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'loc' || key === 'leadingComments' || key === 'innerComments')
            continue;
        const val = node[key];
        if (Array.isArray(val)) {
            for (const item of val) {
                if (item && typeof item === 'object' && 'type' in item) {
                    children.push(item);
                }
            }
        }
        else if (val && typeof val === 'object' && 'type' in val) {
            children.push(val);
        }
    }
    return children;
}
// Blocks descent into function/class bodies for variable extraction
const BLOCK_SCOPE = new Set([
    'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression',
    'ClassMethod', 'ObjectMethod', 'ClassPrivateMethod', 'ClassBody',
]);
function walk(node, visitor, ancestors = []) {
    const type = nodeType(node);
    const parentInScope = ancestors.some(a => BLOCK_SCOPE.has(nodeType(a)));
    if (type === 'ImportDeclaration' && visitor.onImport) {
        visitor.onImport(node);
    }
    else if (type === 'ClassDeclaration' && visitor.onClass) {
        // Extract heritage
        const superClass = node.superClass;
        const implementsClause = node.implements;
        let extendsType;
        if (superClass) {
            extendsType = isType(superClass, 'Identifier')
                ? getName(superClass) ?? undefined
                : getTypeAnnotationStr(superClass);
        }
        const implementsTypes = [];
        if (implementsClause) {
            for (const impl of implementsClause) {
                if (isType(impl, 'TSExpressionWithTypeArguments')) {
                    const expr = impl.expression;
                    const name = getName(expr) ?? getTypeAnnotationStr(expr);
                    if (name)
                        implementsTypes.push(name);
                }
                else {
                    const name = getName(impl) ?? getTypeAnnotationStr(impl);
                    if (name)
                        implementsTypes.push(name);
                }
            }
        }
        visitor.onClass(node, { extendsType, implementsTypes });
    }
    else if (type === 'FunctionDeclaration' && visitor.onFunction) {
        const isExported = ancestors.some(a => isType(a, 'ExportNamedDeclaration'));
        visitor.onFunction(node, isExported);
    }
    else if (type === 'ClassMethod' && visitor.onClassMethod) {
        const isStatic = !!node.static;
        visitor.onClassMethod(node, isStatic);
    }
    else if (type === 'ClassProperty' && visitor.onClassProperty) {
        const isStatic = !!node.static;
        visitor.onClassProperty(node, isStatic);
    }
    else if (type === 'TSInterfaceDeclaration' && visitor.onInterface) {
        visitor.onInterface(node);
    }
    else if (type === 'TSTypeAliasDeclaration' && visitor.onTypeAlias) {
        visitor.onTypeAlias(node);
    }
    else if (type === 'TSEnumDeclaration' && visitor.onEnum) {
        visitor.onEnum(node);
    }
    else if (type === 'Decorator' && visitor.onDecorator) {
        visitor.onDecorator(node);
    }
    else if (type === 'TSTypeParameter' && visitor.onTypeParameter) {
        visitor.onTypeParameter(node);
    }
    else if (type === 'VariableDeclaration' && visitor.onVariable) {
        if (!parentInScope) {
            // Top-level/module-scope variable declarations only
            const isExported = ancestors.some(a => isType(a, 'ExportNamedDeclaration'));
            visitor.onVariable(node, isExported);
        }
    }
    else if (type === 'VariableDeclaration' && visitor.onArrowFunction) {
        // Arrow functions assigned to top-level variables
        if (!parentInScope) {
            for (const decl of (node.declarations ?? [])) {
                if (isType(decl, 'VariableDeclarator')) {
                    const init = decl.init;
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
    }
    else {
        // For function-like nodes, walk children but track that we're inside a scope
        for (const child of getChildren(node)) {
            walk(child, visitor, [...ancestors, node]);
        }
    }
}
function parseFile(fileInfo) {
    const symbols = [];
    const imports = [];
    const calls = [];
    const heritage = [];
    const properties = [];
    let sourceCode;
    try {
        sourceCode = fs.readFileSync(fileInfo.path, 'utf-8');
    }
    catch {
        return { symbols, imports, calls, heritage, properties };
    }
    let ast;
    try {
        ast = parse(sourceCode, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties'],
            tokens: false,
        });
    }
    catch {
        return { symbols, imports, calls, heritage, properties };
    }
    const classNameToId = new Map();
    walk(ast, {
        onClass(node, heritageInfo) {
            const id = node.id;
            const name = getName(id) ?? 'AnonymousClass';
            const nodeId = generateId(fileInfo.path, name, getLine(node));
            classNameToId.set(name, nodeId);
            // Collect class-level decorators
            const decorators = [];
            const classDecorators = node.decorators;
            if (classDecorators) {
                for (const dec of classDecorators) {
                    const dn = getDecoratorName(dec);
                    if (dn)
                        decorators.push(dn);
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
            const name = getName(node.id) ?? 'anonymous';
            const asyncKeyword = !!node.async;
            const params = (node.params ?? []);
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
            const name = getName(declarator.id);
            if (!name)
                return;
            const params = (arrowNode.params ?? []);
            symbols.push({
                id: generateId(fileInfo.path, name, getLine(arrowNode)),
                name,
                label: 'Function',
                filePath: fileInfo.path,
                startLine: getLine(arrowNode),
                endLine: getEndLine(arrowNode),
                isExported,
                parameterCount: params.length,
                isAsync: !!arrowNode.async,
            });
        },
        onClassMethod(node, isStatic) {
            const kind = node.kind;
            if (kind === 'constructor')
                return;
            const params = (node.params ?? []);
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
                isAsync: !!node.async,
            });
        },
        onClassProperty(node, isStatic) {
            const key = node.key;
            const name = getName(key) ?? 'unknown';
            const readonly = !!node.readonly;
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
            const name = getName(node.id) ?? 'AnonymousInterface';
            const typeParams = (node.typeParameters);
            let constraintType;
            if (typeParams) {
                const params = (typeParams.params ?? []);
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
            const name = getName(node.id) ?? 'AnonymousType';
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
            const name = getName(node.id) ?? 'AnonymousEnum';
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
            for (const decl of (node.declarations ?? [])) {
                const declId = decl.id;
                const name = getName(declId);
                if (!name)
                    continue;
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
            if (!decoratorName)
                return;
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
            const name = getName(node.name) ?? 'T';
            const constraint = node.constraint;
            let constraintType;
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
            const source = getStrValue(node.source);
            if (!source)
                return;
            const specifiers = [];
            let isDefault = false;
            let isWildcard = false;
            for (const spec of (node.specifiers ?? [])) {
                const stype = nodeType(spec);
                if (stype === 'ImportDefaultSpecifier') {
                    isDefault = true;
                    specifiers.push('default');
                }
                else if (stype === 'ImportSpecifier') {
                    const imported = spec.imported;
                    const name = getName(imported);
                    specifiers.push(name ?? '');
                }
                else if (stype === 'ImportNamespaceSpecifier') {
                    isWildcard = true;
                    specifiers.push(getName(spec.local) ?? '*');
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
            if (!calleeName)
                return;
            calls.push({
                callerFile: fileInfo.path,
                callerLine: getLine(node),
                calleeName,
            });
        },
    });
    // Mark exported symbols (second pass via checkExports that descends everywhere)
    const exportedNames = new Set();
    function checkExports(node) {
        if (nodeType(node) === 'ExportNamedDeclaration') {
            const decl = node.declaration;
            if (decl) {
                if (isType(decl, 'ClassDeclaration')) {
                    const name = getName(decl.id);
                    if (name)
                        exportedNames.add(name);
                }
                else if (isType(decl, 'FunctionDeclaration')) {
                    const name = getName(decl.id);
                    if (name)
                        exportedNames.add(name);
                }
                else if (isType(decl, 'TSInterfaceDeclaration')) {
                    const name = getName(decl.id);
                    if (name)
                        exportedNames.add(name);
                }
                else if (isType(decl, 'TSTypeAliasDeclaration')) {
                    const name = getName(decl.id);
                    if (name)
                        exportedNames.add(name);
                }
                else if (isType(decl, 'TSEnumDeclaration')) {
                    const name = getName(decl.id);
                    if (name)
                        exportedNames.add(name);
                }
                else if (isType(decl, 'VariableDeclaration')) {
                    const declarations = (decl.declarations ?? []);
                    for (const d of declarations) {
                        const declId = d.id;
                        const name = getName(declId);
                        if (name)
                            exportedNames.add(name);
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
export function parseFiles(files) {
    const allSymbols = [];
    const allImports = [];
    const allCalls = [];
    const allHeritage = [];
    const allProperties = [];
    for (const file of files) {
        if (file.language === 'unknown')
            continue;
        const result = parseFile(file);
        allSymbols.push(...result.symbols);
        allImports.push(...result.imports);
        allCalls.push(...result.calls);
        allHeritage.push(...result.heritage);
        allProperties.push(...result.properties);
    }
    return { allSymbols, allImports, allCalls, allHeritage, allProperties };
}
