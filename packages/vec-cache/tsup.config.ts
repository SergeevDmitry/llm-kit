import { defineConfig } from 'tsup';
import { defineNodeLibraryConfig } from '@llm-kit/build-config';

export default defineConfig(defineNodeLibraryConfig({ external: ['better-sqlite3'] }));
