import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { sanityDataset, sanityProjectId } from './lib/sanity/env';
import { schemaTypes } from './sanity/schemaTypes';

export default defineConfig({
  name: 'muqabala-guides',
  title: 'Muqabala Guides',
  projectId: sanityProjectId,
  dataset: sanityDataset,
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
});
