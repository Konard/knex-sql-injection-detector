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

**Note:** Only `.js` files are currently supported. Files with other extensions (e.g., `.ts`, `.jsx`) are ignored.

**Node modules scanning:** By default, all files in `node_modules` are skipped. However, if the path you provide contains `node_modules` (e.g., `./node_modules/some-package`), the tool will scan all `node_modules` folders in all inner paths as well.

## What is considered safe?

A query is considered **safe** if the SQL string is constructed only from:
- String literals (e.g., `'SELECT * FROM users'`)
- Numeric literals (e.g., `42`)
- Boolean literals (`true`, `false`)
- `null`
- Template literals with only constant expressions (string, number, boolean, null, or ternary expressions that resolve to constants)
- Concatenations (`+`) of only such constants

A query is considered **unsafe** if:
- The SQL string contains any dynamic value (variable, function call, etc.)
- A template literal contains any non-constant interpolation
- A concatenation includes any non-constant part

## Options

- `--only-errors`  
  Print only errors (potential SQL injections). Suppresses info output for potentially safe calls.  
  **Default:** false

- `--code-quotes`  
  Print code and extra spacing in output. If disabled (`--no-code-quotes`), prints only a single line per finding (for easy parsing/clicking in editors).  
  **Default:** true

- `--ignore <pattern ...>`  
  Glob patterns for files/folders to ignore. You can specify multiple patterns.  
  Example: `--ignore "**/migration**" "**/test**"`

- `--include-node-modules`  
  Include `node_modules` in the scan. By default, all files in `node_modules` are skipped unless you explicitly provide a path inside `node_modules` or use this flag.  
  **Default:** false

- `-h, --help`  
  Show help and usage information.

## Output

- `[error] Potential SQL injection ...`  
  Indicates a likely SQL injection risk (e.g., template literals with non-constant interpolations, or any dynamic/non-constant query source).
- `[info] knex raw function call ...`  
  Indicates a likely safe usage: the query is constructed only from constants as described above.

- `[stats]`  
  At the end, prints total raw function calls and total potential SQL injections found.

## Example

```sh
knex-sql-injection-detector ./src \
  --ignore "**/migrations/**" \
  --only-errors \
  --no-code-quotes
```

This will scan all `.js` files in `./src`, print only errors in single-line format, and skip any files in `migrations` folders.
