const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const {version} = require('../package.json');
const source = ['engine.js', 'position.js', 'ui.js']
  .map(name => fs.readFileSync(path.join(root, 'src', name), 'utf8'));
fs.writeFileSync(path.join(root, 'ad-skip.js'),
  `// Ad Skip for Spotify Desktop ${version} — Spicetify extension\n` + source.join('\n'));
console.log(`Built ad-skip.js v${version}`);
