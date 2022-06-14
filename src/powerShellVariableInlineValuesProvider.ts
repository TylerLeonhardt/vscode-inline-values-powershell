import * as vscode from 'vscode';
import { DocumentParser } from './documentParser';

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
    private documentParser: DocumentParser;

    constructor(documentParser: DocumentParser) {
        this.documentParser = documentParser;
    }

    async provideInlineValues(document: vscode.TextDocument, viewport: vscode.Range, context: vscode.InlineValueContext): Promise<vscode.InlineValue[]> {
        const allValues: vscode.InlineValue[] = [];

        const extensionSettings = vscode.workspace.getConfiguration('powershellInlineValues');
        const startLocationSetting = extensionSettings.get<string>('startLocation') ?? 'currentFunction';
        const startLine = await this.documentParser.getStartLine(document, startLocationSetting, context.stoppedLocation);
        const endLine = context.stoppedLocation.end.line;
        const excludedLines = await this.documentParser.getExcludedLines(document, context.stoppedLocation, startLine);

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
}
