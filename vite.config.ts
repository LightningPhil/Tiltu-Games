import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

const license = readFileSync(new URL('./LICENSE', import.meta.url), 'utf8');
const notices = readFileSync(new URL('./THIRD_PARTY_NOTICES.txt', import.meta.url), 'utf8');

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'collection-license',
      transformIndexHtml(html) {
        return html
          .replace('<script type="text/plain" id="third-party-notices"></script>',
            `<script type="text/plain" id="third-party-notices">${notices}</script>`)
          .replace('<script type="text/plain" id="collection-license"></script>',
            `<script type="text/plain" id="collection-license">${license}</script>`);
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'LICENSE.txt', source: license });
        this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_NOTICES.txt', source: notices });
      },
    },
    viteSingleFile(),
  ],
  build: { outDir: 'dist_single', emptyOutDir: true, assetsInlineLimit: Number.MAX_SAFE_INTEGER, cssCodeSplit: false },
});
