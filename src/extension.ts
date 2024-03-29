import * as vscode from 'vscode';
import { PowerShellVariableInlineValuesProvider } from './powerShellVariableInlineValuesProvider';
import { DocumentParser } from './documentParser';

export function activate(context: vscode.ExtensionContext) {
	const parser = new DocumentParser();

	context.subscriptions.push(vscode.languages.registerInlineValuesProvider('powershell', new PowerShellVariableInlineValuesProvider(parser)));

	// Clear function symbol cache to ensure we get symbols from any updated files
	context.subscriptions.push(
		vscode.debug.onDidTerminateDebugSession((e) => {
			if (e.type.toLowerCase() === 'powershell') {
				parser.clearFunctionCache();
			}
		})
	);
}

export function deactivate() { }
