// يتأكد أن ملفات الخطوط التي يطلبها src/skia/fonts.ts موجودة بعد npm install.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'skia', 'fonts.ts'), 'utf8');
const paths = [...src.matchAll(/require\('([^']+\.ttf)'\)/g)].map((m) => m[1]);
let missing = 0;
for (const p of paths) {
  const full = path.join(__dirname, '..', 'node_modules', p);
  if (!fs.existsSync(full)) {
    console.error('✗ مفقود:', p);
    missing++;
  }
}
if (missing) {
  console.error(`\n${missing} من ${paths.length} ملف خط مفقود. افتح مجلد الحزمة في node_modules وعدّل المسار في src/skia/fonts.ts.`);
  process.exit(1);
}
console.log(`✓ كل ملفات الخطوط (${paths.length}) موجودة`);
