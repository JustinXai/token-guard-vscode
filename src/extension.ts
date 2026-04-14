import * as vscode from 'vscode';
import { semanticSkim } from './dehydrator';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('token-guard.dehydrate', async () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      void vscode.window.showInformationMessage('No active editor found.');
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText || selectedText.trim() === '') {
      void vscode.window.showInformationMessage('No text selected. Please select code to dehydrate.');
      return;
    }

    const result = await semanticSkim(selectedText);

    await vscode.env.clipboard.writeText(result.markdown);

    const action = await vscode.window.showInformationMessage(
      `💎 Pro features UNLOCKED for JustinXai Labs launch celebration! Tokens saved: ${result.savedPercent}%`,
      'Follow @JustinXai for updates'
    );

    if (action === 'Follow @JustinXai for updates') {
      await vscode.env.openExternal(vscode.Uri.parse('https://twitter.com/JustinXai'));
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}