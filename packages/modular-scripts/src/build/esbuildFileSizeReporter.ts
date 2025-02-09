import type * as esbuild from 'esbuild';
import * as fs from 'fs-extra';
import { sync as gzipSize } from 'gzip-size';
import * as path from 'path';
import recursive from 'recursive-readdir';

import { Paths } from '../utils/createPaths';
import { Asset, canReadAsset } from './fileSizeReporter';

function removeFileNameHash(fileName: string): string {
  return fileName
    .replace(/\\/g, '/')
    .replace(
      /\/?(.*)(\.chunk)?(\.[0-9a-f]+)(\.js|\.css)/,
      (match, p1, p2, p3, p4) => p1 + p4,
    );
}

export function esbuildMeasureFileSizesBeforeBuild(
  buildFolder: string,
): Promise<Record<string, number>> {
  return new Promise<Record<string, number>>((resolve) => {
    recursive(buildFolder, (err: Error, fileNames: string[]) => {
      if (err) {
        resolve({});
      } else {
        resolve(
          fileNames
            .filter(canReadAsset)
            .reduce<Record<string, number>>((memo, absoluteFilePath) => {
              const filePath = path.relative(buildFolder, absoluteFilePath);

              const contents = fs.readFileSync(absoluteFilePath);
              const folder = path.join(
                path.basename(buildFolder),
                path.dirname(filePath),
              );
              const name = path.basename(filePath);

              const key = `${folder}/${removeFileNameHash(name)}`;

              memo[key] = gzipSize(contents);

              return memo;
            }, {}),
        );
      }
    });
  });
}

export function createEsbuildAssets(
  paths: Paths,
  stats: esbuild.Metafile,
): Asset[] {
  const readableAssets = Object.keys(stats.outputs)
    .map((name) => {
      return path.relative(paths.appBuild, path.join(paths.appPath, name));
    })
    .filter(canReadAsset);

  return readableAssets
    .map<Asset>((filePath) => {
      const fileContents = fs.readFileSync(path.join(paths.appBuild, filePath));
      const size = gzipSize(fileContents);
      const folder = path.join(
        path.basename(paths.appBuild),
        path.dirname(filePath),
      );
      const name = path.basename(filePath);
      return {
        folder,
        name,
        normalizedName: `${folder}/${removeFileNameHash(name)}`,
        size: size,
      };
    })
    .sort((a, b) => b.size - a.size);
}
