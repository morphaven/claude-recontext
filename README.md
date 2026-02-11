# claude-recontext

When you move or rename a project directory, Claude Code loses track of your conversations. This tool fixes that by updating all internal path references to match the new location.

## The Problem

Claude Code stores conversations under `~/.claude/projects/` using encoded directory names. When a project moves from `/old/path` to `/new/path`, Claude can't find the old conversations:

```
claude -c
# → "No conversation found to continue"
```

## The Fix

```bash
npx claude-recontext --from "/old/path" --to "/new/path"
```

That's it. Your conversations are back.

## Install

```bash
npm install -g claude-recontext
```

Or use directly with `npx` (no install needed).

## Usage

```bash
# Interactive mode — pick a project, broken ones shown first
claude-recontext

# Direct migration
claude-recontext --from "C:\old\path" --to "C:\new\path"

# Preview changes without applying
claude-recontext --from "C:\old\path" --to "C:\new\path" --dry-run

# Find broken projects (path no longer exists on disk)
claude-recontext --check

# List all registered projects
claude-recontext --list
```

## What It Does

1. **Renames** the project directory under `~/.claude/projects/`
2. **Updates** `sessions-index.json` with new path references
3. **Updates** all `.jsonl` session files (streaming — handles 300MB+ files)
4. **Updates** `~/.claude/history.jsonl` so recent activity shows correctly
5. **Updates** memory files (`.md`) that may contain path references
6. **Verifies** no old path references remain (full streaming scan)

All changes are **atomic** (write to temp file → rename) with **automatic rollback** if anything fails mid-migration.

## Health Check

Detect projects whose directories no longer exist on disk:

```bash
claude-recontext --check
```

```
Proje Sağlık Kontrolü

5 kırık proje bulundu:

   1. C:\Users\Me\old-location\my-project
      C--Users-Me-old-location-my-project
```

## How Path Encoding Works

Claude Code encodes project paths into directory names:

| Character | Replacement |
|-----------|-------------|
| `:\` | `--` |
| `/` `\` | `-` |
| ` ` (space) | `-` |
| `.` | `-` |
| Non-ASCII (ğ,ü,ş…) | `-` |

Example: `C:\Users\Me\My Project` → `C--Users-Me-My-Project`

## License

MIT
