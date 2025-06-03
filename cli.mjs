#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import { glob } from 'glob';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const rawMethods = [
  'raw',
  'whereRaw',
  'fromRaw',
  'joinRaw',
  'groupByRaw',
  'orderByRaw',
  'havingRaw',
];

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
        const secondArg = node.arguments[1];
        const loc = node.loc;
        let type = 'info';
        if (firstArg?.type === 'TemplateLiteral') {
          // Unsafe only if there are expressions (interpolations) in the template
          if (firstArg.expressions && firstArg.expressions.length > 0) {
            type = 'unsafe';
          } else {
            // Template literal with no interpolations is treated as a string literal
            if (secondArg?.type === 'ArrayExpression') {
              type = 'info';
            }
          }
        } else if (
          firstArg?.type === 'StringLiteral' &&
          secondArg?.type === 'ArrayExpression'
        ) {
          type = 'info';
        } else if (
          firstArg && firstArg.type !== 'StringLiteral' && firstArg.type !== 'TemplateLiteral'
        ) {
          // Any non-literal (e.g., Identifier, CallExpression, etc.) is unsafe
          type = 'unsafe';
        }
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
  .help()
  .argv;

const targetPath = argv._[0];
const onlyErrors = argv['only-errors'];
const codeQuotes = argv['code-quotes'];

let totalRaw = 0;
let totalUnsafe = 0;
let totalSafe = 0;
let hadError = false;

const files = await getAllJsFiles(targetPath);

await Promise.all(files.map(async file => {
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
        console.error(`[error] Potential SQL injection:\n\n  ${f.code}\n\nat ${f.filePath}:${f.line}:${f.column}\n`);
      }
    } else if (!onlyErrors) {
      totalSafe++;
      if (!codeQuotes) {
        console.info(`[info] knex raw function call at ${f.filePath}:${f.line}:${f.column}`);
      } else {
        console.info(`[info] knex raw function call:\n\n  ${f.code}\n\nat ${f.filePath}:${f.line}:${f.column}\n`);
      }
    }
  }
}));

console.log(`[stats]`);
console.log(`  Total raw function calls: ${totalRaw}`);
console.log(`  Total potential SQL injections: ${totalUnsafe}`);

if (hadError) {
  process.exit(1);
}
