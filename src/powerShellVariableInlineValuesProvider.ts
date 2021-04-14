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

            // Finds variables or expressions starting with $
            // Group 1 + 2: Variable-name. Group 3: Expression if any
            // Support variables names like ${var} or $var
            // and properties like  ."prop", .'prop' or .{ some prop }
            // and indexes
            const inlineValueMatches = /\$(?:(?:\{(.+?)\})|(?:([^\[\{\s\.]+)))((?:\[\d+\])?(?:\.(?:(?:[^ \'\"\{]+?)|(?:\{.+?\})|(?:".+?")|(?:'.+?'))(?:\[\d+\])?)*)(?:\;|\,|\-|\+|\/|\*|\s|$)/gi;
            for (let match = inlineValueMatches.exec(line.text); match; match = inlineValueMatches.exec(line.text)) {
                let inlineValue;
                
                // If expression (capture group 3) found, else variable
                if(match[3]) {
                    inlineValue = this.processInlineExpression(match, l);
                } else {
                    inlineValue = this.processInlineVariable(match, l);
                }
                
                if(inlineValue) { allValues.push(inlineValue); }
            }
        }

        return allValues;
    }

    processInlineVariable(match: RegExpExecArray, line: number) : vscode.InlineValueVariableLookup | undefined {
        const ignoredVariables = /^\$(?:true|false|null)$/i;

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

        // If known PowerShell constant, ignore
        if (ignoredVariables.test(varName)) {
            return;
        }

        const rng = new vscode.Range(line, match.index, line, match.index + varName.length);
        return new vscode.InlineValueVariableLookup(rng, varName, false);
    }

    processInlineExpression(match: RegExpExecArray, line: number) : vscode.InlineValueEvaluatableExpression {
        let expression = match[0];
        
        // These characters need to be trimmed off
        if ([';', ',', '-', '+', '/', '*'].includes(expression[expression.length - 1])) {
            expression = expression.substring(0, expression.length - 1);
        }

        const rng = new vscode.Range(line, match.index, line, match.index + expression.length);
        return new vscode.InlineValueEvaluatableExpression(rng, expression);
    }
}