// vc.config.ts
import { Plugin } from './Plugin';  
import { ReactPlugin } from './ReactPlugin';

export interface VCConfig {
  srcDir: string;
  outDir: string;
  port: number;
  entryPoint?: string;
  typescript?: boolean;
  plugins: Plugin[];
}

const config: VCConfig = {
  srcDir: "frontend",
  outDir: "dist",
  port: 3000,
  typescript: false,
  entryPoint: "index.jsx",
  plugins: [
    new ReactPlugin()
  ],
};

export default config;
