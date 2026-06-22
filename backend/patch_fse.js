const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'routes', 'fse.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let startLine = -1, endLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (startLine === -1 && lines[i].includes('const fseNames = [...new Set(accessList') && i > 250) {
    startLine = i;
  }
  if (startLine !== -1 && endLine === -1 && lines[i].includes('// GET /api/fse/:name')) {
    endLine = i;
    break;
  }
}

if (startLine === -1 || endLine === -1) {
  console.error('Lines not found', { startLine, endLine });
  process.exit(1);
}

console.log('Removing lines', startLine+1, 'to', endLine, '(', endLine-startLine, 'lines)');
const newLines = [...lines.slice(0, startLine), ...lines.slice(endLine)];
fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
console.log('Done!');
