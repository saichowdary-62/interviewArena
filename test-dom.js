const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('dist/index.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;
const root = document.querySelector('div#root:nth-of-type(1)');
console.log(root);
