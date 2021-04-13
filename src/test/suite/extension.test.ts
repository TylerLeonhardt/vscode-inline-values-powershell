import * as assert from 'assert';

import * as vscode from 'vscode';
import { PowerShellVariableInlineValuesProvider } from '../../powerShellVariableInlineValuesProvider';

suite('Extension Test Suite', async () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Misc variable tests', async () => {
		const doc = await vscode.workspace.openTextDocument({
			language: 'powershell',
			content: `$normal = Get-Process
$script:scoped = 5
\${braces} = "asdf"
$numb3rInside = 'asdf'
$33333 = 'numbers'
\${     } = 'spaces'
$normal, \${braces}, $script:scoped
4
$true
	`,
		});

		const provider = new PowerShellVariableInlineValuesProvider();

		const result = await provider.provideInlineValues(doc, new vscode.Range(0, 0, 0, 0), {
			stoppedLocation: new vscode.Range(doc.lineCount - 1, 0, doc.lineCount - 1, 0),
			frameId: 0
		});

		assert.strictEqual(result?.length, 9);
		for (let i = 0; i < result.length; i++) {
			const variable = result![i] as vscode.InlineValueVariableLookup;

			let name: string = '';
			let startChar: number = 0;
			let line: number = i;
			switch (i) {
				case 0:
					name = '$normal';
					break;
				case 1:
					name = '$scoped';
					break;
				case 2:
					name = '$braces';
					break;
				case 3:
					name = '$numb3rInside';
					break;
				case 4:
					name = '$33333';
					break;
				case 5:
					name = '$     ';
					break;
				case 6:
					name = '$normal';
					break;
				case 7:
					name = '$braces';
					startChar = 9;
					line = 6;
					break;
				case 8:
					name = '$scoped';
					startChar = 20;
					line = 6;
					break;
			}
		
			assert.strictEqual(variable.caseSensitiveLookup, false);
			assert.strictEqual(variable.range.start.line, line);
			assert.strictEqual(variable.range.end.line, line);
			assert.strictEqual(variable.range.start.character, startChar);
			assert.strictEqual(variable.variableName, name);
			assert.strictEqual(variable.range.end.character, name.length + startChar);
		}
	});
});
