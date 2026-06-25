const fs = require('fs');
const babel = require('@babel/parser');
const content = fs.readFileSync('src/pages/CampaignList.jsx', 'utf8');

// Try to parse the file and get a stack trace
try {
  const ast = babel.parse(content, {
    sourceType: 'module',
    plugins: ['jsx'],
    tokens: true,
    attachComment: true,
  });
  console.log('✅ File parses successfully!');
} catch (e) {
  console.log('❌ Parse error:', e.message);
  console.log('\nError location:', e.loc?.line, e.loc?.column);
  console.log('\nRelevant code section:');
  
  const lines = content.split('\n');
  const errorLine = e.loc?.line;
  const errorCol = e.loc?.column;
  
  if (errorLine && errorCol) {
    console.log(`Line ${errorLine - 1}: ${lines[errorLine - 2]?.slice(Math.max(0, errorCol - 10)).trimEnd()}`);
    console.log(`Line ${errorLine}:   ${lines[errorLine - 1]?.slice(Math.max(0, errorCol - 10)).trimEnd()}`);
    console.log(`Line ${errorLine + 1}: ${lines[errorLine]?.slice(Math.max(0, errorCol - 10)).trimEnd()}`);
  }
  
  // Try to find the actual issue by looking at the token stream
  console.log('\nToken stream around the error:');
  const tokens = babel.tokenizer(content, {
    plugins: ['jsx'],
  });
  
  let tokenCount = 0;
  let errorTokenIndex = null;
  
  for (const token of tokens) {
    tokenCount++;
    if (tokenCount >= errorTokenIndex - 10 && tokenCount <= errorTokenIndex + 10) {
      console.log(`${tokenCount}: ${JSON.stringify(token)}`);
    }
    if (token.type === 'Error' || token.loc?.start.line === errorLine) {
      errorTokenIndex = tokenCount;
    }
  }
}
