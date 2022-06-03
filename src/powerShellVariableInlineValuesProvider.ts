import * as vscode from 'vscode';

export class PowerShellVariableInlineValuesProvider implements vscode.InlineValuesProvider {

    // Known constants
    private readonly ignoredVariables = /^\$(?:true|false|null)$/i;
    
    // Variable patterns
    // https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_variables?view=powershell-5.1#variable-names-that-include-special-characters
    private readonly alphanumChars = /(?:\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nd}|[_?])/.source;
    private readonly variableRegex = new RegExp([
        '(?:\\$\\{(.*?)(?<!`)\\})' // Special characters variables. Lazy match until unescaped }
        ,`|(?:\\$${this.alphanumChars}+:${this.alphanumChars}+)` // Scoped variables
        ,`|(?:\\$${this.alphanumChars}+)` // Normal variables
    ].join(''), 'giu'); // u flag to support unicode char classes

    provideInlineValues(document: vscode.TextDocument, viewport: vscode.Range, context: vscode.InlineValueContext) : vscode.ProviderResult<vscode.InlineValue[]> {
        const allValues: vscode.InlineValue[] = [];

        for (let l = 0; l <= context.stoppedLocation.end.line; l++) {
            const line = document.lineAt(l);

            // Skip over comments
            if (line.text.trimStart().startsWith('#')) {
                continue;
            }

            for (let match = this.variableRegex.exec(line.text); match; match = this.variableRegex.exec(line.text)) {
                // If we're looking at special characters variable, use the variable name in capture group 1
                let varName = match[0][1] === '{'
                    ? '$' + match[1].replace(/`(.)/g,'$1') // Remove backticks used as escape char for curly braces, unicode etc.
                    : match[0];

                // If there's a scope, we need to remove it
                const colon = varName.indexOf(':');
                if (colon !== -1) {
                    varName = '$' + varName.substring(colon + 1);
                }

                // If known PowerShell constant, ignore
                if (this.ignoredVariables.test(varName)) {
                    continue;
                }

                const rng = new vscode.Range(l, match.index, l, match.index + varName.length);
                allValues.push(new vscode.InlineValueVariableLookup(rng, varName, false));
            }
        }

        return allValues;
    }
}
