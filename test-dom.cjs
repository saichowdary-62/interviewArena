const fs = require('fs');
const html = fs.readFileSync('dist/index.html', 'utf8');
console.log(html);
