# knex-sql-injection-detector

A CLI tool to detect potential SQL injections in knex.js codebases.

## Installation

```sh
npm install -g knex-sql-injection-detector
```

## Usage

```sh
knex-sql-injection-detector <path> [options]
```

- `<path>`: Path to a file or directory to scan for potential SQL injections in knex raw queries.

## Options

- `--only-errors`  
  Print only errors (potential SQL injections). Suppresses info output for safe/unknown calls.  
  **Default:** false

- `--code-quotes`  
  Print code and extra spacing in output. If disabled (`--no-code-quotes`), prints only a single line per finding (for easy parsing/clicking in editors).  
  **Default:** true

- `--ignore <pattern ...>`  
  Glob patterns for files/folders to ignore. You can specify multiple patterns.  
  Example: `--ignore "**/migrations/**" "**/test/**"`

- `--include-node-modules`  
  Include `node_modules` in the scan. By default, all files in `node_modules` are skipped unless you explicitly provide a path inside `node_modules` or use this flag.  
  **Default:** false

- `-h, --help`  
  Show help and usage information.

## Output

- `[error] Potential SQL injection ...`  
  Indicates a likely SQL injection risk (e.g., template literals with interpolations, or non-literal query sources).
- `[info] knex raw function call ...`  
  Indicates a safe or non-flagged usage.

- `[stats]`  
  At the end, prints total raw function calls and total potential SQL injections found.

## Example

```sh
knex-sql-injection-detector ./src --only-errors --no-code-quotes --ignore "**/migrations/**"
```

This will scan all `.js` files in `./src`, print only errors in single-line format, and skip any files in `migrations` folders.
