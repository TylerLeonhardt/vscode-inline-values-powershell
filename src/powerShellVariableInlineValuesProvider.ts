import * as vscode from 'vscode';

export class PowerShellVariableInlineValuesProvider implements vscode.InlineValuesProvider {

    // Known constants
    private readonly knownConstants = /^\$(?:true|false|null)$/i;

    // https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_scopes?view=powershell-5.1#scope-modifiers
    private readonly supportedScopes = /^(?:global|local|script|private|using|variable)$/i;

    // Variable patterns
    // https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_variables?view=powershell-5.1#variable-names-that-include-special-characters
    private readonly alphanumChars = /(?:\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nd}|[_?])/.source;
    private readonly variableRegex = new RegExp([
        '(?:\\$\\{(?<specialName>.*?)(?<!`)\\})', // Special characters variables. Lazy match until unescaped }
        `(?:\\$${this.alphanumChars}+:${this.alphanumChars}+)`, // Scoped variables
        `(?:\\$${this.alphanumChars}+)`, // Normal variables
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
        const excludedLines = await this.getExcludedLines(document, context);

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
                    if (!this.supportedScopes.test(scope)) {
                        continue;
                    }

                    varName = '$' + varName.substring(colon + 1);
                }

                // If known PowerShell constant, ignore
                if (this.knownConstants.test(varName)) {
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
        if (functions) {
            // only return functions with stopped location in range
            return functions.filter(func => func.range.contains(context.stoppedLocation));
        }

        return [];
    }

    private async getFunctionsInDocument(document: vscode.TextDocument) : Promise<vscode.DocumentSymbol[]> {
        const cacheKey = document.uri.toString();
        if (this.functionCache.has(cacheKey)) {
            return this.functionCache.get(cacheKey) ?? [];
        }

        const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri);
        let functions: vscode.DocumentSymbol[] = [];

        if (documentSymbols) {
            // flatten symbols and keep only functions
            functions = this.flattenSymbols(documentSymbols).filter(s => s.kind === vscode.SymbolKind.Function);
        }

        this.functionCache.set(cacheKey, functions);
        return functions;
    }

    private flattenSymbols(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
        let result: vscode.DocumentSymbol[] = [];
        symbols.map(symbol => {
            result.push(symbol);
            if (symbol.children && symbol.children.length > 0) {
                result = result.concat(this.flattenSymbols(symbol.children));
            }
        });
        return result;
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

    private async getExcludedLines(document: vscode.TextDocument, context: vscode.InlineValueContext): Promise<number[]> {
        const functions = await this.getFunctionsInDocument(document);
        const outOfScopeFunctions = functions.filter(f => !f.range.contains(context.stoppedLocation));
        const excludedLines = [];

        for (var i = 0, length = outOfScopeFunctions.length; i < length; ++i) {
            const functionRange = this.range(outOfScopeFunctions[i].range.start.line, outOfScopeFunctions[i].range.end.line);
            excludedLines.push(...functionRange.filter(line => context.stoppedLocation.start.line > line || context.stoppedLocation.end.line < line));
        }

        return excludedLines;
    }

    private range(start: number, end: number) {
        return Array(end - start + 1).fill(undefined).map((_, i) => start + i);
    }
}
