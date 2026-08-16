import { defineConfig } from 'tsup';
import { defineLibraryConfig } from '@llm-kit/build-config';

// `models.ts` is a separate entry so `@llm-kit/model-registry` is only
// bundled into a consumer's build when they actually import `chat-fit/models`
// — importing the package root never pulls registry data in.
export default defineConfig(defineLibraryConfig({ entry: ['src/index.ts', 'src/models.ts'] }));
