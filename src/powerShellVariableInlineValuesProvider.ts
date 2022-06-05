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
        `(?:\\$\\w+:${this.alphanumChars}+)`, // Scoped variables
        `(?:\\$${this.alphanumChars}+)`, // Normal variables
    ].join('|'), 'giu'); // u flag to support unicode char classes

    async provideInlineValues(document: vscode.TextDocument, viewport: vscode.Range, context: vscode.InlineValueContext) : Promise<vscode.InlineValue[]> {
        const extensionSettings = vscode.workspace.getConfiguration('powershellInlineValues');
        const allValues: vscode.InlineValue[] = [];

        let functions = extensionSettings.get('startLocation') !== 'file' ? await this.getFunctionsInScope(document, context) : [];
        // Lookup closest matching function start or default to document start (0)
        const startLine = Math.max(0, ...functions.map(fn => fn.range.start.line));
        const endLine = context.stoppedLocation.end.line;

        for (let l = startLine; l <= endLine; l++) {
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
        const extensionSettings = vscode.workspace.getConfiguration('powershellInlineValues');

        // TODO Possible to cache this per document.uri per debugsession? Document changes during debugging are ignored
        const allSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri);

        if(allSymbols) {
            // currentFunction not recommended atm. as nested functions might not show variables defined in parent scope. Similar to https://github.com/TylerLeonhardt/vscode-inline-values-powershell/issues/11
            // flatten symbols if user selected anyFcurrentFunctionunction (nested functions)
            const symbolsInScope = extensionSettings.get('startLocation') === 'currentFunction' ? this.processSymbols(allSymbols) : allSymbols;
            // keep only functions
            return symbolsInScope.filter(s => s.kind === vscode.SymbolKind.Function);
        }

        return [];
    }

    private processSymbols(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
        let result: vscode.DocumentSymbol[] = [];
        symbols.map(symbol => {
            result.push(symbol);
            if (symbol.children && symbol.children.length > 0) {
                result = result.concat(this.processSymbols(symbol.children));
            }
        });

        return result;
    }
}
