import * as vscode from 'vscode';
import { PowerShellVariableInlineValuesProvider } from './powerShellVariableInlineValuesProvider';

export function activate(context: vscode.ExtensionContext) {
	// Used to avoid calling symbol provider for the same document on every stopped location
	const functionCache: Map<string, vscode.DocumentSymbol[]> = new Map<string, vscode.DocumentSymbol[]>();

	context.subscriptions.push(vscode.languages.registerInlineValuesProvider('powershell', new PowerShellVariableInlineValuesProvider(functionCache)));

	// Clear function cache to get updated files in next debug session
	context.subscriptions.push(
		vscode.debug.onDidTerminateDebugSession((e) => {
			if (e.type.toLowerCase() === 'powershell') {
				functionCache.clear();
			}
		}));
}

export function deactivate() { }
