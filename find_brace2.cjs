const fs = require('fs');
const content = fs.readFileSync('src/pages/CampaignList.jsx', 'utf8');
const lines = content.split('\n');

// Track JSX structure more carefully
const jsxStack = [];
let lineNum = 0;

for (let i = 0; i < lines.length; i++) {
  lineNum = i + 1;
  const line = lines[i];
  
  // Track JSX expressions like {loading ? ...}
  let exprDepth = 0;
  let inExpr = false;
  let exprStart = 0;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    if (char === '{' && !inExpr) {
      // Check if this is a JSX expression (not an attribute)
      const prevChar = j === 0 ? '' : line[j-1];
      if (prevChar === '>') {
        inExpr = true;
        exprDepth = 0;
        exprStart = j + 1;
      }
    } else if (char === '}') {
      if (inExpr) {
        exprDepth--;
        if (exprDepth === 0) {
          inExpr = false;
          console.log(`  Line ${lineNum}, col ${exprStart}: JSX expression closed`);
        }
      } else if (jsxStack.length > 0) {
        jsxStack.pop();
      }
    } else if (char === '<' && !inExpr && !/["']/.test(line[j+1])) {
      // Check if this is a JSX opening tag
      const nextChar = line[j+1];
      if (nextChar === '/' || nextChar === '!') continue;
      
      const tagMatch = line.slice(j).match(/^<(\w+)/);
      if (tagMatch) {
        jsxStack.push({
          line: lineNum,
          tag: tagMatch[1],
          depth: jsxStack.length + 1
        });
        console.log(`  Line ${lineNum}: <${tagMatch[1]}> opened (depth: ${jsxStack.length + 1})`);
      }
    }
  }
  
  if (inExpr) {
    console.log(`  Line ${lineNum}: JSX expression not closed at end of line`);
  }
  
  if (jsxStack.length > 0) {
    console.log(`  Line ${lineNum}: ${jsxStack[jsxStack.length-1].tag} not closed (depth: ${jsxStack.length})`);
    console.log(`    Context: ${line.trim()}`);
  }
}

console.log('\nFinal JSX stack:');
console.log(jsxStack.map(s => `  - <${s.tag}> (line ${s.line})`).join('\n'));
