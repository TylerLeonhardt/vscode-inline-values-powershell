import * as assert from 'assert';
import * as utils from "../../utils";
import * as vscode from 'vscode';
import * as testUtils from '../testUtils';
import { DocumentParser } from '../../documentParser';

suite('DocumentParser tests', async () => {
    let parser: DocumentParser;
    let docSample1: vscode.TextDocument;

    suiteSetup(async () => {
        parser = new DocumentParser();
        docSample1 = await vscode.workspace.openTextDocument({
            language: 'powershell',
            content: `
$a;
function test1 {
    function test2 {
        $b # Stopped location
    }
    $a
}
$b
$notfound
`,
        });

        // Ensure PowerShell extension is finished starting because we need it's symbol provider
        await testUtils.ensureEditorServicesIsConnected();
    });

    suite('getFunctionsInScope() function', async () => {
        test('returns only functions with stoppedLocation in range', async () => {
            const result = await parser.getFunctionsInScope(docSample1, new vscode.Range(4, 8, 4, 10));
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].name, 'test1 { }');
            assert.strictEqual(result[0].kind, vscode.SymbolKind.Function);
            assert.strictEqual(result[1].name, 'test2 { }');
            assert.strictEqual(result[1].kind, vscode.SymbolKind.Function);
        });
    });

    suite('getFunctionsInDocument() function', async () => {
        test('returns all functions in document', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'powershell',
                content: `
$a;
function test1 {
    function test2 {
        $b
    }
    $a
}
$b # Stopped location
function test3 { }
$notfound
`,
            });

            const result = await parser.getFunctionsInDocument(doc);
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].name, 'test1 { }');
            assert.strictEqual(result[0].kind, vscode.SymbolKind.Function);
            assert.strictEqual(result[1].name, 'test2 { }');
            assert.strictEqual(result[1].kind, vscode.SymbolKind.Function);
            assert.strictEqual(result[2].name, 'test3 { }');
            assert.strictEqual(result[2].kind, vscode.SymbolKind.Function);
        });

        test('returns empty array when no functions exist', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'powershell',
                content: `
$a;
$b # Stopped location
$notfound
`,
            });

            const result = await parser.getFunctionsInDocument(doc);
            assert.strictEqual(result.length, 0);
        });
    });

    suite('getStartLine() function', async () => {
        test('returns linenumber for closest function start when stopped inside function', async () => {
            const result = await parser.getStartLine(docSample1, 'currentFunction', new vscode.Range(4, 8, 4, 10));
            assert.strictEqual(result, 3);
        });

        test('returns document start when startLocationSetting is set to document when stopped inside function', async () => {
            const result = await parser.getStartLine(docSample1, 'document', new vscode.Range(4, 8, 4, 10));
            assert.strictEqual(result, 0);
        });

        test('returns document start when not stopped inside function', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'powershell',
                content: `
$a;
function test1 {
    function test2 {
        $b
    }
    $a
}
$b # Stopped location
$notfound
`,
            });

            const result = await parser.getStartLine(doc, 'currentFunction', new vscode.Range(8, 0, 8, 3));
            assert.strictEqual(result, 0);
        });
    });

    suite('getExcludedLines() function', async () => {
        test('returns array of lines for all functions outside scope of stopped location', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'powershell',
                content: `
$a
function test1 {
    $b
    $notfound
}

function test2 {
    $helloWorld
}

$a # Stopped location

test1
`,
            });

            const result = await parser.getExcludedLines(doc, new vscode.Range(11, 0, 11, 3), 0);
            assert.strictEqual(result.length, 7);
            assert.strictEqual(result[0], 2);
            assert.strictEqual(result[1], 3);
            assert.strictEqual(result[2], 4);
            assert.strictEqual(result[3], 5);
            assert.strictEqual(result[4], 7);
            assert.strictEqual(result[5], 8);
            assert.strictEqual(result[6], 9);
        });

        test('returns empty array when no functions out of scope are present in range', async () => {
            // range = startline (test2 function start) -> stopped location
            const doc = await vscode.workspace.openTextDocument({
                language: 'powershell',
                content: `
$a
function test1 {
    $b
    $notfound
}

function test2 {
    $b # Stopped location
}
$a

test2
`,
            });

            const result = await parser.getExcludedLines(doc, new vscode.Range(8, 4, 8, 7), 7);
            assert.strictEqual(result.length, 0);
        });
    });
});
