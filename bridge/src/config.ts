import 'dotenv/config';
import path from 'node:path';
import { DEFAULT_DAILY_TEMPLATE } from './dailyNotes.ts';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env var: ${name}`);
  return v;
}

export interface Config {
  vaultRoot: string;
  dailyFolder: string;
  dailyTemplate: string;
  // Master switch for the write tools. When false they are neither advertised to the MCP
  // client nor executed if called anyway (see ToolContext.canWrite).
  allowWrites: boolean;
}

export function loadConfig(): Config {
  return {
    vaultRoot: path.resolve(required('VAULT_ROOT')),
    dailyFolder: process.env.DAILY_FOLDER || 'Daily',
    // .env values keep literal "\n" — expand to real newlines, matching how the app's own
    // template string is authored (see app/src/lib/utils.ts DEFAULT_DAILY_TEMPLATE).
    dailyTemplate: (process.env.DAILY_TEMPLATE || DEFAULT_DAILY_TEMPLATE).replace(/\\n/g, '\n'),
    // Opt-in, not opt-out: anything other than an explicit "true" leaves the vault read-only.
    allowWrites: (process.env.ALLOW_WRITES ?? '').trim().toLowerCase() === 'true',
  };
}
