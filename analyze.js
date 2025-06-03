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
