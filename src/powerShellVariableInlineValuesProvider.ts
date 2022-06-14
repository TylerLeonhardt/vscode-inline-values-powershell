import * as vscode from 'vscode';
import * as utils from './utils';

export class PowerShellVariableInlineValuesProvider implements vscode.InlineValuesProvider {

    // Known constants
    private readonly knownConstants = ['$true', '$false', '$null'];

    // https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_scopes?view=powershell-5.1#scope-modifiers
    private readonly supportedScopes = ['global', 'local', 'script', 'private', 'using', 'variable'];

    // Variable patterns
    // https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_variables?view=powershell-5.1#variable-names-that-include-special-characters
    private readonly alphanumChars = /(?:\p{Ll}|\p{Lu}|\p{Nd}|[_?]|\p{Lt}|\p{Lm}|\p{Lo})/.source;
    private readonly variableRegex = new RegExp([
        '(?:\\$\\{(?<specialName>.*?)(?<!`)\\})', // Special characters variables. Lazy match until unescaped }
        `(?:\\$(?:[a-zA-Z]+:)?${this.alphanumChars}+)`, // Scoped or normal variables
    ].join('|'), 'giu'); // u flag to support unicode char classes

    // Cache for symbols per document in the current debugsessions
    private functionCache: Map<string, vscode.DocumentSymbol[]>;

    constructor(functionCache: Map<string, vscode.DocumentSymbol[]>) {
        this.functionCache = functionCache;
    }

    async provideInlineValues(document: vscode.TextDocument, viewport: vscode.Range, context: vscode.InlineValueContext): Promise<vscode.InlineValue[]> {
        const allValues: vscode.InlineValue[] = [];
        const startLine = await this.getStartLine(document, context);
        const endLine = context.stoppedLocation.end.line;
        const excludedLines = await this.getExcludedLines(document, context, startLine);

        for (let l = startLine; l <= endLine; l++) {
            // Exclude lines out of scope (other functions)
            if (excludedLines.includes(l)) {
                continue;
            }

            const line = document.lineAt(l);

            // Skip over comments
            if (line.text.trimStart().startsWith('#')) {
                continue;
            }
            for (let match = this.variableRegex.exec(line.text); match; match = this.variableRegex.exec(line.text)) {
                // If we're looking at special characters variable, use the extracted variable name in capture group
                let varName = match[0][1] === '{'
                    ? '$' + match.groups?.specialName?.replace(/`(.)/g, '$1') // Remove backticks used as escape char for curly braces, unicode etc.
                    : match[0];

                // If there's a scope, we need to remove it
                const colon = varName.indexOf(':');
                if (colon !== -1) {
                    // If invalid scope, ignore
                    const scope = varName.substring(1, colon);
                    if (!this.supportedScopes.includes(scope.toLowerCase())) {
                        continue;
                    }

                    varName = '$' + varName.substring(colon + 1);
                }

                // If known PowerShell constant, ignore
                if (this.knownConstants.includes(varName.toLowerCase())) {
                    continue;
                }

                const rng = new vscode.Range(l, match.index, l, match.index + varName.length);
                allValues.push(new vscode.InlineValueVariableLookup(rng, varName, false));
            }
        }
        return allValues;
    }

    private async getFunctionsInScope(document: vscode.TextDocument, context: vscode.InlineValueContext) : Promise<vscode.DocumentSymbol[]> {
        const functions = await this.getFunctionsInDocument(document);
        const stoppedStart = context.stoppedLocation.start.line;
        const stoppedEnd = context.stoppedLocation.end.line;
        const res: vscode.DocumentSymbol[] = [];

        for (var i = 0, length = functions.length; i < length; ++i) {
            const func = functions[i];
            // only return functions with stopped location in range
            if (func.range.start.line <= stoppedStart && func.range.end.line >= stoppedEnd && func.range.contains(context.stoppedLocation)) {
                res.push(func);
            }
        }

        return res;
    }

    private async getFunctionsInDocument(document: vscode.TextDocument) : Promise<vscode.DocumentSymbol[]> {
        const cacheKey = document.uri.toString();
        if (this.functionCache.has(cacheKey)) {
            return this.functionCache.get(cacheKey)!;
        }

        const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri);
        let functions: vscode.DocumentSymbol[] = [];

        if (documentSymbols) {
            // flatten symbols and keep only functions
            functions = utils.flattenSymbols(documentSymbols).filter(s => s.kind === vscode.SymbolKind.Function);
        }

        this.functionCache.set(cacheKey, functions);
        return functions;
    }

    private async getStartLine(document: vscode.TextDocument, context: vscode.InlineValueContext): Promise<number> {
        const extensionSettings = vscode.workspace.getConfiguration('powershellInlineValues');
        const startLocationSetting = extensionSettings.get('startLocation');

        if (startLocationSetting === 'document') {
            return 0;
        }

        // Lookup closest matching function start or default to document start (0)
        const functions = await this.getFunctionsInScope(document, context);
        return Math.max(0, ...functions.map(fn => fn.range.start.line));
    }

    private async getExcludedLines(document: vscode.TextDocument, context: vscode.InlineValueContext, startLine: number): Promise<number[]> {
        const functions = await this.getFunctionsInDocument(document);
        const stoppedEnd = context.stoppedLocation.end.line;
        const excludedLines = [];

        for (var i = 0, length = functions.length; i < length; ++i) {
            const func = functions[i];
            // startLine (either document start or closest function start) are provided, so functions necessary to exclude
            // will always start >= documentStart or after currentFunction start if nested function.
            // Don't bother checking functions before startLine or after stoppedLocation
            if (func.range.start.line >= startLine && func.range.start.line < stoppedEnd && !func.range.contains(context.stoppedLocation)) {
                const functionRange = utils.range(func.range.start.line, func.range.end.line);
                excludedLines.push(...functionRange.filter(line => line < context.stoppedLocation.start.line || line > stoppedEnd));
            }
        }

        return excludedLines;
    }
}
