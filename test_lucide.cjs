const fs = require('fs');
const lucide = require('lucide-react');
const execSync = require('child_process').execSync;

const files = execSync('find src -type f -name "*.tsx"').toString().trim().split('\n');
const errors = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lucideImportsMatch = content.match(/import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/);
  if (lucideImportsMatch) {
    const imports = lucideImportsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const name of imports) {
      if (!lucide[name]) {
        errors.push(`Missing ${name} in ${file}`);
      }
    }
  }
}
console.log(errors.length ? errors.join('\n') : 'All icons found');
