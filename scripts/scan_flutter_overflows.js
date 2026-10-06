const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.dart')) {
      results.push(fullPath);
    }
  });
  return results;
}

const dartFiles = walk(path.join(__dirname, '..', 'lib'));
console.log(`Scanning ${dartFiles.length} Dart files for layout overflow risks...\n`);

const findings = [];

dartFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(path.join(__dirname, '..'), filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check 1: TabBar without isScrollable
    if (line.includes('TabBar(')) {
      const block = lines.slice(i, Math.min(lines.length, i + 30)).join('\n');
      if (block.includes('tabs:') && !block.includes('isScrollable: true')) {
        const tabCount = (block.match(/Tab\(/g) || []).length;
        if (tabCount >= 3) {
          findings.push({
            file: relPath,
            line: lineNum,
            type: 'TABBAR_CONGESTION',
            detail: `TabBar has ${tabCount} tabs without isScrollable: true`
          });
        }
      }
    }

    // Check 2: Row inside AppBar title without Flexible/Expanded Text
    if (line.includes('title: Row(') || (line.includes('AppBar(') && lines.slice(i, i + 10).some(l => l.includes('Row(')))) {
      const block = lines.slice(i, Math.min(lines.length, i + 25)).join('\n');
      if (block.includes('Text(') && !block.includes('Expanded') && !block.includes('Flexible')) {
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'APPBAR_TITLE_ROW_OVERFLOW',
          detail: 'Row in AppBar title has Text without Expanded/Flexible'
        });
      }
    }

    // Check 3: Row with long hardcoded Text or multiple Text widgets without Expanded/Flexible
    if (line.trim().startsWith('Row(') || line.includes(' Row(')) {
      let rowBlock = '';
      for (let j = i; j < Math.min(lines.length, i + 35); j++) {
        rowBlock += lines[j] + '\n';
        if (lines[j].includes(');')) break;
      }

      const textMatches = rowBlock.match(/Text\(\s*['"][^'"]{25,}['"]/g);
      if (textMatches && !rowBlock.includes('Expanded(') && !rowBlock.includes('Flexible(') && !rowBlock.includes('SingleChildScrollView')) {
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'ROW_UNWRAPPED_LONG_TEXT',
          detail: `Row contains long Text without Expanded/Flexible: ${textMatches[0].slice(0, 45)}...`
        });
      }

      if (rowBlock.includes('trailing:') && rowBlock.includes('Row(') && !rowBlock.includes('mainAxisSize: MainAxisSize.min')) {
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'LISTTILE_TRAILING_ROW',
          detail: 'ListTile trailing Row missing mainAxisSize: MainAxisSize.min'
        });
      }
    }

    // Check 4: Modal bottom sheet without isScrollControlled
    if (line.includes('showModalBottomSheet(')) {
      const block = lines.slice(i, Math.min(lines.length, i + 20)).join('\n');
      if (!block.includes('isScrollControlled: true')) {
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'BOTTOMSHEET_UNCONTROLLED',
          detail: 'showModalBottomSheet without isScrollControlled: true'
        });
      }
    }

    // Check 5: Hardcoded container widths >= 360
    const widthMatch = line.match(/width:\s*([0-9]+)/);
    if (widthMatch) {
      const w = parseInt(widthMatch[1]);
      if (w >= 360 && !line.includes('double.infinity') && !filePath.includes('test')) {
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'HARDCODED_LARGE_WIDTH',
          detail: `Hardcoded width: ${w}px exceeds or approaches mobile viewport (A71 ~392dp)`
        });
      }
    }
  }
});

console.log(`Scan completed. Found ${findings.length} potential layout risk points:\n`);
findings.forEach((f, idx) => {
  console.log(`${idx + 1}. [${f.type}] ${f.file}:${f.line}`);
  console.log(`   -> ${f.detail}\n`);
});
