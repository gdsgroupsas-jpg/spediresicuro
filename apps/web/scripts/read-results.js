const fs = require('fs');
try {
  const content = fs.readFileSync('discovery_output.txt', 'utf16le');
  console.log(content);
} catch (e) {
  console.error(e);
}
