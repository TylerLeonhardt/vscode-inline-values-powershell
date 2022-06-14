import * as vscode from 'vscode';
import * as utils from './utils';

export class DocumentParser {
    // Used to avoid calling symbol provider for the same document on every stopped location
    private readonly functionCache: Map<string, vscode.DocumentSymbol[]> = new Map<string, vscode.DocumentSymbol[]>();

    clearFunctionCache(): void {
        this.functionCache.clear();
    }

    async getFunctionsInScope(document: vscode.TextDocument, stoppedLocation: vscode.Range): Promise<vscode.DocumentSymbol[]> {
        const functions = await this.getFunctionsInDocument(document);
        const stoppedStart = stoppedLocation.start.line;
        const stoppedEnd = stoppedLocation.end.line;
        const res: vscode.DocumentSymbol[] = [];

        for (var i = 0, length = functions.length; i < length; ++i) {
            const func = functions[i];
            // only return functions with stopped location in range
            if (func.range.start.line <= stoppedStart && func.range.end.line >= stoppedEnd && func.range.contains(stoppedLocation)) {
                res.push(func);
            }
        }

        return res;
    }

    async getFunctionsInDocument(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[]> {
        const cacheKey = document.uri.toString();
        if (this.functionCache.has(cacheKey)) {
            return this.functionCache.get(cacheKey)!;
        }

        const documentSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', document.uri);
        let functions: vscode.DocumentSymbol[] = [];

        if (documentSymbols) {
            // flatten symbols and keep only functions
            functions = utils.flattenSymbols(documentSymbols).filter(s => s.kind === vscode.SymbolKind.Function);
        }

        this.functionCache.set(cacheKey, functions);
        return functions;
    }

    async getStartLine(document: vscode.TextDocument, startLocationSetting: string, stoppedLocation: vscode.Range): Promise<number> {
        if (startLocationSetting === 'document') {
            return 0;
        }

        // Lookup closest matching function start or default to document start (0)
        const functions = await this.getFunctionsInScope(document, stoppedLocation);
        return Math.max(0, ...functions.map(fn => fn.range.start.line));
    }

    async getExcludedLines(document: vscode.TextDocument, stoppedLocation: vscode.Range, startLine: number): Promise<number[]> {
        const functions = await this.getFunctionsInDocument(document);
        const stoppedEnd = stoppedLocation.end.line;
        const excludedLines = [];

        for (var i = 0, length = functions.length; i < length; ++i) {
            const func = functions[i];
            // startLine (either document start or closest function start) are provided, so functions necessary to exclude
            // will always start >= documentStart or after currentFunction start if nested function.
            // Don't bother checking functions before startLine or after stoppedLocation
            if (func.range.start.line >= startLine && func.range.start.line < stoppedEnd && !func.range.contains(stoppedLocation)) {
                const functionRange = utils.range(func.range.start.line, func.range.end.line);
                excludedLines.push(...functionRange.filter(line => line < stoppedLocation.start.line || line > stoppedEnd));
            }
        }

        return excludedLines;
    }

}
