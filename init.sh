#!/bin/bash

# Exit on error
set -e

# License: Unlicense

# Initialize npm project in root if not already initialized
if [ ! -f package.json ]; then
  npm init -y --license=Unlicense
fi

# Install Babel parser and traverse
npm install @babel/parser @babel/traverse

# Create example.js
cat <<EOF > example.js
const db = require('knex')();

let userId = 42;

// Unsafe
db.raw(`SELECT * FROM users WHERE id = \\${userId}`);

// Safe
db.raw('SELECT * FROM users WHERE id = ?', [userId]);

// Unknown
db.raw(queryString);
EOF

# Create analyzer script
cat <<EOF > analyze.js
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');

function analyzeCode(code) {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const results = [];

  traverse(ast, {
    CallExpression(path) {
      const { node } = path;

      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.property.name === 'raw'
      ) {
        const firstArg = node.arguments[0];
        const secondArg = node.arguments[1];

        if (firstArg?.type === 'TemplateLiteral') {
          results.push({
            type: 'unsafe',
            code: code.slice(node.start, node.end),
          });
        } else if (
          firstArg?.type === 'StringLiteral' &&
          secondArg?.type === 'ArrayExpression'
        ) {
          results.push({
            type: 'safe',
            code: code.slice(node.start, node.end),
          });
        } else {
          results.push({
            type: 'unknown',
            code: code.slice(node.start, node.end),
          });
        }
      }
    },
  });

  return results;
}

const sourceCode = fs.readFileSync('./example.js', 'utf8');
const findings = analyzeCode(sourceCode);

console.log('\nAnalysis Results:');
findings.forEach(f => {
  console.log(`\nType: ${f.type}`);
  console.log(`Code: ${f.code}`);
});
EOF

# Run analyzer
echo -e "\nRunning analysis...\n"
node analyze.js