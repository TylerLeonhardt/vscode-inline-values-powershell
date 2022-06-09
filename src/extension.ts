import * as vscode from 'vscode';
import { PowerShellVariableInlineValuesProvider } from './powerShellVariableInlineValuesProvider';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerInlineValuesProvider('powershell', new PowerShellVariableInlineValuesProvider()));
}

export function deactivate() { }
