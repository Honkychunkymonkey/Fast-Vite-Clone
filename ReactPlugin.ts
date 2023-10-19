// ReactPlugin.ts
import { exec } from "child_process";
import { Plugin } from "./Plugin";
import { FileType } from "./FileType";
import path from "path";
import config from "./vc.config"
import fs from "fs";

export class ReactPlugin implements Plugin {
  defaultExtension(typescript?: boolean): string {
    return typescript ? 'tsx' : 'jsx';
  }

  onFileChange = async (filePath: string, fileType: FileType) => {
    if (fileType === FileType.JSX) { // Removed folder restriction
      this.transpileJSX(filePath);
    }
  };

  onServerStart = async () => {
    console.log("React Plugin initialized");
    // Get all JSX files in srcDir and transpile them
    const files = await fs.promises.readdir(config.srcDir);
  files.forEach(file => {
      if (file.endsWith('.jsx')) {
        this.transpileJSX(path.join(config.srcDir, file));
      }
    });
  };

  private transpileJSX(filePath: string) {
      const outputPath = path.join(config.outDir, path.basename(filePath).replace('.jsx', '.js'));
      exec(`bunx babel ${filePath} --out-file ${outputPath}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error transpiling ${filePath}: ${error}`);
          return;
        }
        console.log(`Transpiled ${filePath} to ${outputPath} successfully`);
      });
    }
  }