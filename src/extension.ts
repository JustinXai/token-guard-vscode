import * as vscode from 'vscode';

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

    const originalLength = selectedText.length;

    let dehydrated = selectedText
      .replace(/\/\*\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '');

    const lines = dehydrated.split('\n');
    const processedLines = lines
      .map((line: string) => line.trimEnd())
      .filter((line: string) => line.length > 0);
    dehydrated = processedLines.join('\n');

    const saved = originalLength - dehydrated.length;
    const percentage = Math.round((saved / originalLength) * 100);

    await vscode.env.clipboard.writeText(dehydrated);

    const action = await vscode.window.showInformationMessage(
      `Tokens saved: ${percentage}%. Compressed code copied to clipboard!`,
      'Try Clipper (Chrome)'
    );

    if (action === 'Try Clipper (Chrome)') {
      await vscode.env.openExternal(vscode.Uri.parse('https://github.com/JustinXai/cursor-context-clipper'));
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
