#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import { glob } from 'glob';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import pLimit from 'p-limit';
import { minimatch } from 'minimatch';

const rawMethods = [
  'raw',
  'whereRaw',
  'fromRaw',
  'joinRaw',
  'groupByRaw',
  'orderByRaw',
  'havingRaw',
];

function isConstantStringExpression(node) {
  if (!node) return false;
  if (node.type === 'StringLiteral') return true;
  if (node.type === 'TemplateLiteral') {
    // Is constant only if there are no interpolations
    return !(node.expressions && node.expressions.length > 0);
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return isConstantStringExpression(node.left) && isConstantStringExpression(node.right);
  }
  return false;
}

function isSafeSQLExpression(node) {
  if (!node) return false;
  if (node.type === 'StringLiteral') return true;
  if (node.type === 'TemplateLiteral') {
    // Safe only if there are no interpolations
    return !(node.expressions && node.expressions.length > 0);
  }
  if (node.type === 'BinaryExpression') {
    return isConstantStringExpression(node);
  }
  return false;
}

function analyzeCode(code, filePath) {
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: [], // Only JS
    });
  } catch (e) {
    return [];
  }

  const results = [];

  traverse.default(ast, {
    CallExpression(path) {
      const { node } = path;
      if (
        node.callee.type === 'MemberExpression' &&
        rawMethods.includes(node.callee.property.name)
      ) {
        const firstArg = node.arguments[0];
        const loc = node.loc;
        let type = isSafeSQLExpression(firstArg) ? 'info' : 'unsafe';
        results.push({
          type,
          code: code.slice(node.start, node.end),
          filePath,
          line: loc ? loc.start.line : null,
          column: loc ? loc.start.column + 1 : null,
        });
      }
    },
  });

  return results;
}

async function getAllJsFiles(targetPath) {
  let stat;
  try {
    stat = await fs.stat(targetPath);
  } catch (e) {
    return [];
  }
  if (stat.isDirectory()) {
    return await glob(path.join(targetPath, '**/*.js'));
  } else if (stat.isFile() && targetPath.endsWith('.js')) {
    return [targetPath];
  }
  return [];
}

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 <path>')
  .demandCommand(1)
  .option('only-errors', {
    type: 'boolean',
    description: 'Print only errors (potential SQL injections)',
    default: false,
  })
  .option('code-quotes', {
    type: 'boolean',
    description: 'Print code and extra spacing in output (disable for single-line output)',
    default: true,
  })
  .option('ignore', {
    type: 'array',
    description: 'Glob patterns for files/folders to ignore (e.g. --ignore "**/migrations/**" "**/test/**")',
    default: [],
  })
  .option('include-node-modules', {
    type: 'boolean',
    description: 'Include node_modules in scan (default: false)',
    default: false,
  })
  .help()
  .argv;

const targetPath = argv._[0];
const onlyErrors = argv['only-errors'];
const codeQuotes = argv['code-quotes'];
const ignorePatterns = argv.ignore;
const includeNodeModules = argv['include-node-modules'];

let totalRaw = 0;
let totalUnsafe = 0;
let totalSafe = 0;
let hadError = false;

const files = await getAllJsFiles(targetPath);

// Determine if user explicitly wants node_modules
const userExplicitlyWantsNodeModules = includeNodeModules || targetPath.includes('node_modules');

const limit = pLimit(256);

function quoteCode(code) {
  // Add two spaces at the start of each line
  return code.split('\n').map(line => '  ' + line).join('\n');
}

await Promise.all(files.map(file =>
  limit(async () => {
    // Skip node_modules unless explicitly requested
    if (!userExplicitlyWantsNodeModules && file.includes('node_modules')) {
      return;
    }
    // Skip files matching any ignore pattern
    if (ignorePatterns.some(pattern => minimatch(file, pattern))) {
      return;
    }
    let stat;
    try {
      stat = await fs.stat(file);
    } catch (e) {
      return; // skip unreadable
    }
    if (!stat.isFile()) {
      return; // skip directories and non-files
    }
    const code = await fs.readFile(file, 'utf8');
    const findings = analyzeCode(code, file);
    for (const f of findings) {
      totalRaw++;
      if (f.type === 'unsafe') {
        totalUnsafe++;
        hadError = true;
        if (!codeQuotes) {
          console.error(`[error] Potential SQL injection at ${f.filePath}:${f.line}:${f.column}`);
        } else {
          console.error(`[error] Potential SQL injection:\n\n${quoteCode(f.code)}\n\nat ${f.filePath}:${f.line}:${f.column}\n`);
        }
      } else if (!onlyErrors) {
        totalSafe++;
        if (!codeQuotes) {
          console.info(`[info] knex raw function call at ${f.filePath}:${f.line}:${f.column}`);
        } else {
          console.info(`[info] knex raw function call:\n\n${quoteCode(f.code)}\n\nat ${f.filePath}:${f.line}:${f.column}\n`);
        }
      }
    }
  })
));

console.log(`[stats]`);
console.log(`  Total raw function calls: ${totalRaw}`);
console.log(`  Total potential SQL injections: ${totalUnsafe}`);

if (hadError) {
  process.exit(1);
}
