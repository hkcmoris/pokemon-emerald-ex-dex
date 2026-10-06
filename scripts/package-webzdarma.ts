import { fileURLToPath } from 'node:url';

import { prepareWebzdarmaUpload } from './webzdarma.js';

const output = await prepareWebzdarmaUpload(fileURLToPath(new URL('../', import.meta.url)));
console.log(`FileZilla upload folder: ${output}`);
