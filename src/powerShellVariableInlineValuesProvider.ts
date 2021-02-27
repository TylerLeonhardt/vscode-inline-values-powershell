import * as vscode from 'vscode';

export class PowerShellVariableInlineValuesProvider implements vscode.InlineValuesProvider {

    provideInlineValues(document: vscode.TextDocument, viewport: vscode.Range, context: vscode.InlineValueContext) : vscode.ProviderResult<vscode.InlineValue[]> {
        const allValues: vscode.InlineValue[] = [];

        for (let l = 0; l <= context.stoppedLocation.end.line; l++) {
            const line = document.lineAt(l);

            // Skip over comments
            if (line.text.trimStart().startsWith('#')) {
                continue;
            }

            const variableMatches = /(?:\${(.*)})|(?:\$\S+:\S+)|(?:\$\S+)/gi;
            for (let match = variableMatches.exec(line.text); match; match = variableMatches.exec(line.text)) {
                // If we're looking at an "anything goes" variable, that has a capture group so use that instead
                let varName = match[0][1] === '{'
                    ? '$' + match[1]
                    : match[0];

                // If there's a scope, we need to remove it
                const colon = varName.indexOf(':');
                if (colon !== -1) {
                    varName = '$' + varName.substring(colon + 1);
                }

                // These characters need to be trimmed off
                if ([';', ',', '-', '+', '/', '*'].includes(varName[varName.length - 1])) {
                    varName = varName.substring(0, varName.length - 1);
                }

                const rng = new vscode.Range(l, match.index, l, match.index + varName.length);
                allValues.push(new vscode.InlineValueVariableLookup(rng, varName, false));
            }
        }

        return allValues;
    }
}
