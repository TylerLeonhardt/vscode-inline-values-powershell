import * as assert from 'assert';
import * as utils from "../../utils";
import { DocumentSymbol, Range, SymbolKind } from 'vscode';

suite('Helper functions', async () => {
    suite('range()', async () => {
        test('returns array of 1,2,3 when called with 1,3', async () => {
            const result = utils.range(1, 3);
            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0], 1);
            assert.strictEqual(result[1], 2);
            assert.strictEqual(result[2], 3);
        });
    });

    suite('flattenSymbols()', async () => {
        test('returns flat array of symbols with child-symbols', async () => {
            const root = new DocumentSymbol('f1', '', SymbolKind.Function, new Range(0, 0, 0, 0), new Range(0, 0, 0, 0));
            const child1 = new DocumentSymbol('f1-child1', '', SymbolKind.Function, new Range(0, 0, 0, 0), new Range(0, 0, 0, 0));
            const child2 = new DocumentSymbol('f1-child2', '', SymbolKind.Function, new Range(0, 0, 0, 0), new Range(0, 0, 0, 0));
            root.children = [child1, child2];
            child1.children = [new DocumentSymbol('f1-child1-inner1', '', SymbolKind.Function, new Range(0, 0, 0, 0), new Range(0, 0, 0, 0))];
            const root2 = new DocumentSymbol('f2', '', SymbolKind.Function, new Range(0, 0, 0, 0), new Range(0, 0, 0, 0));

            const res = utils.flattenSymbols([root, root2]);
            assert.strictEqual(res.length, 5);
            assert.strictEqual(res[0].name, 'f1');
            assert.strictEqual(res[1].name, 'f1-child1');
            assert.strictEqual(res[2].name, 'f1-child1-inner1');
            assert.strictEqual(res[3].name, 'f1-child2');
            assert.strictEqual(res[4].name, 'f2');
        });
    });
});
