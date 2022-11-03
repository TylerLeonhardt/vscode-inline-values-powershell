import * as vscode from 'vscode';
import * as utils from './utils';

export class DocumentParser {
    // Used to avoid calling symbol provider for the same document on every stopped location
    private readonly functionCache: Map<string, vscode.DocumentSymbol[]> = new Map<string, vscode.DocumentSymbol[]>();

    // Clear cache between debugsessions to get updated symbols
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
            // Only return functions with stopped location inside range
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
            // Get all functions in a flat array from the symbol-tree
            functions = utils.flattenSymbols(documentSymbols).filter(s => s.kind === vscode.SymbolKind.Function);
        }

        this.functionCache.set(cacheKey, functions);
        return functions;
    }

    async getStartLine(document: vscode.TextDocument, startLocationSetting: string, stoppedLocation: vscode.Range): Promise<number> {
        if (startLocationSetting === 'document') {
            return 0;
        }

        // Lookup closest matching function start line or default to document start (0)
        const functions = await this.getFunctionsInScope(document, stoppedLocation);
        return Math.max(0, ...functions.map(fn => fn.range.start.line));
    }

    async getExcludedLines(document: vscode.TextDocument, stoppedLocation: vscode.Range, startLine: number): Promise<Set<number>> {
        const functions = await this.getFunctionsInDocument(document);
        const stoppedEnd = stoppedLocation.end.line;
        const excludedLines = [];

        for (var i = 0, length = functions.length; i < length; ++i) {
            const func = functions[i];
            // StartLine (either document start or closest function start) are provided, so functions necessary to exclude
            // will always start >= documentStart or same as currentFunction start if nested function.
            // Don't bother checking functions before startLine or after stoppedLocation
            if (func.range.start.line >= startLine && func.range.start.line <= stoppedEnd && !func.range.contains(stoppedLocation)) {
                const functionRange = utils.range(func.range.start.line, func.range.end.line);
                excludedLines.push(...functionRange);
            }
        }

        // Ensure we don't exclude our stopped location and make lookup blazing fast
        return new Set(excludedLines.filter(line => line < stoppedLocation.start.line || line > stoppedEnd));
    }
}
