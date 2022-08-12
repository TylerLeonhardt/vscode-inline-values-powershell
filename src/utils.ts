import { DocumentSymbol } from 'vscode';

// Because 1..10 isn't supported here...
export function range(start: number, end: number) {
    return Array(end - start + 1).fill(undefined).map((_, i) => start + i);
}

// Convert the symbol-tree to a flat array
export function flattenSymbols(symbols: DocumentSymbol[]): DocumentSymbol[] {
    let result: DocumentSymbol[] = [];
    symbols.map(symbol => {
        result.push(symbol);
        if (symbol.children && symbol.children.length > 0) {
            result = result.concat(flattenSymbols(symbol.children));
        }
    });
    return result;
}
