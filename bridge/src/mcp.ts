import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.ts';
import { executeTool, toolsFor, type ToolContext } from './tools.ts';
import { Vault } from './vault.ts';
import { VaultIndex } from './vaultIndex.ts';

// stdio MCP server exposing the notes vault. Spawned by an MCP client (Hermes Agent, Claude
// Desktop/Code), which supplies VAULT_ROOT / ALLOW_WRITES via env. The client owns the agent
// loop, model routing, chat transport, and scheduling — this process only knows how to read
// and edit the vault using the desktop app's own file conventions.
async function main(): Promise<void> {
  const config = loadConfig();
  const vault = new Vault(config.vaultRoot);
  const index = new VaultIndex(vault);
  const ctx: ToolContext = { vault, index, config, canWrite: config.allowWrites };

  const server = new McpServer({ name: 'notes-vault', version: '0.2.0' });

  // toolsFor filters out the write tools when ALLOW_WRITES is false, so a read-only server
  // never advertises them; each write tool also re-checks ctx.canWrite before touching disk.
  for (const tool of toolsFor(ctx)) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: !tool.writes },
      },
      async (args: Record<string, unknown>) => {
        try {
          const text = await executeTool(tool, args ?? {}, ctx);
          // Writes bypass the vault index's cache — force the next read to see them instead
          // of a pre-write snapshot.
          if (tool.writes) index.invalidate();
          return { content: [{ type: 'text' as const, text }] };
        } catch (err) {
          // Surface failures as tool-level errors so the model can correct itself, rather
          // than as a transport error that would kill the whole call.
          const message = err instanceof Error ? err.message : String(err);
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true };
        }
      },
    );
  }

  // stdout is the MCP transport — anything logged there corrupts the protocol framing, so
  // diagnostics must go to stderr.
  console.error(
    `notes-vault MCP server ready — vault: ${config.vaultRoot}, writes: ${config.allowWrites ? 'ENABLED' : 'read-only'}`,
  );

  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error('notes-vault MCP server failed to start:', err);
  process.exit(1);
});
