import * as vscode from 'vscode';
import { PowerShellVariableInlineValuesProvider } from './powerShellVariableInlineValuesProvider';
import { DocumentParser } from './documentParser';

export function activate(context: vscode.ExtensionContext) {
	const parser = new DocumentParser();

	context.subscriptions.push(vscode.languages.registerInlineValuesProvider('powershell', new PowerShellVariableInlineValuesProvider(parser)));

	// Clear function cache to get updated files in next debug session
	context.subscriptions.push(
		vscode.debug.onDidTerminateDebugSession((e) => {
			if (e.type.toLowerCase() === 'powershell') {
				parser.clearFunctionCache();
			}
		})
	);
}

export function deactivate() { }
