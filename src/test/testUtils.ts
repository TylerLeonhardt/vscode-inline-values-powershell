import * as vscode from "vscode";

const extensionId = 'TylerLeonhardt.vscode-inline-values-powershell';

/**
 * IExternalPowerShellDetails and IPowerShellExtensionClient
 * https://github.com/PowerShell/vscode-powershell/blob/c323846803f0d43f75562a7fd1e8c225099cc528/src/features/ExternalApi.ts#L10-L22
 */
export interface IExternalPowerShellDetails {
    exePath: string;
    version: string;
    displayName: string;
    architecture: string;
}

export interface IPowerShellExtensionClient {
    registerExternalExtension(id: string, apiVersion?: string): string;
    unregisterExternalExtension(uuid: string): boolean;
    getPowerShellVersionDetails(uuid: string): Promise<IExternalPowerShellDetails>;
    waitUntilStarted(uuid: string): Promise<void>;
}

/**
 * Modified version of ensureEditorServicesIsConnected()
 * https://github.com/PowerShell/vscode-powershell/blob/c323846803f0d43f75562a7fd1e8c225099cc528/test/utils.ts#L17-L21
 */
export async function ensureExtensionIsActivated(): Promise<vscode.Extension<any>> {
    const powershellExtension = vscode.extensions.getExtension<IPowerShellExtensionClient>("ms-vscode.PowerShell") || vscode.extensions.getExtension<IPowerShellExtensionClient>("ms-vscode.PowerShell-Preview");
    if (!powershellExtension!.isActive) { await powershellExtension!.activate(); }
    return powershellExtension!;
}

/**
 * ensureEditorServicesIsConnected()
 * https://github.com/PowerShell/vscode-powershell/blob/c323846803f0d43f75562a7fd1e8c225099cc528/test/utils.ts#L23-L29
 */
export async function ensureEditorServicesIsConnected(): Promise<void> {
    const powershellExtension = await ensureExtensionIsActivated();
    const client = powershellExtension!.exports as IPowerShellExtensionClient;
    const sessionId = client.registerExternalExtension(extensionId);
    await client.waitUntilStarted(sessionId);
    client.unregisterExternalExtension(sessionId);
};
