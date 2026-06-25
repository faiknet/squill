const fs = require('fs');
const content = fs.readFileSync('src/pages/CampaignList.jsx', 'utf8');
const lines = content.split('\n');

// Stack-based brace tracking
const stack = [];
let lineNum = 0;
let currentLine = '';

for (let i = 0; i < lines.length; i++) {
  lineNum = i + 1;
  currentLine = lines[i];
  
  for (let j = 0; j < currentLine.length; j++) {
    const char = currentLine[j];
    
    if (char === '{') {
      // Create a simplified content string without string literals
      let simplified = currentLine.substring(0, j + 1);
      // Remove single quotes
      simplified = simplified.replace(/'[^']*'/g, '');
      // Remove double quotes
      simplified = simplified.replace(/"[^"]*"/g, '');
      // Remove backticks
      simplified = simplified.replace(/`[^`]*`/g, '');
      
      stack.push({
        line: lineNum,
        column: j + 1,
        content: simplified
      });
    } else if (char === '}') {
      if (stack.length === 0) {
        console.error(`\n❌ EXTRA CLOSING BRACE at line ${lineNum}, column ${j + 1}`);
        console.error(`   Content: ${currentLine.substring(Math.max(0, j-50)).trimEnd()}`);
        process.exit(1);
      }
      stack.pop();
    }
  }
  
  if (stack.length === 0) {
    console.log(`Line ${lineNum}: balanced`);
  }
}

if (stack.length > 0) {
  console.error('\n❌ MISSING CLOSING BRACE(S)');
  console.error(`   ${stack.length} opening brace(s) left unclosed`);
  console.error(`   Last opened at line ${stack[stack.length-1].line}, column ${stack[stack.length-1].column}`);
  console.error('\n   Top of stack (last opened):');
  const last = stack[stack.length-1];
  console.error(`      Line ${last.line}, Column ${last.column}: "${last.content.trimEnd().slice(-60)}...`);
  
  // Show context around the last opened brace
  console.error('\n   Context around line ' + last.line + ':');
  const start = Math.max(0, last.line - 5);
  const end = Math.min(lines.length, last.line + 10);
  for (let i = start; i < end; i++) {
    const lineNum = i + 1;
    const prefix = lineNum === last.line ? '>>' : '  ';
    console.error(`${prefix}${lineNum}: ${lines[i]}`);
  }
  
  process.exit(1);
} else {
  console.log('\n✅ All braces are properly matched!');
}
