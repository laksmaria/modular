import { paramCase as toParamCase } from 'change-case';

import actionPreflightCheck from './utils/actionPreflightCheck';
import isModularType from './utils/isModularType';
import execAsync from './utils/execAsync';
import getLocation from './utils/getLocation';
import stageView from './utils/stageView';
import getModularRoot from './utils/getModularRoot';
import { setupEnvForDirectory } from './utils/setupEnv';
import { checkBrowsers } from './utils/checkBrowsers';
import checkRequiredFiles from './utils/checkRequiredFiles';
import createPaths from './utils/createPaths';
import * as logger from './utils/logger';
import createEsbuildBrowserslistTarget from './utils/createEsbuildBrowserslistTarget';

async function start(target: string): Promise<void> {
  const targetPath = await getLocation(target);

  await setupEnvForDirectory(targetPath);

  if (isModularType(targetPath, 'package')) {
    throw new Error(
      `The package at ${targetPath} is not a valid modular app or view.`,
    );
  }

  /**
   * If we're trying to start a view then we first need to stage out the
   * view into an 'app' directory which can be built.
   */
  let startPath: string;
  if (isModularType(targetPath, 'view')) {
    startPath = stageView(target);
  } else {
    startPath = targetPath;

    // in the case we're an app then we need to make sure that users have no incorrectly
    // setup their app folder.
    const paths = await createPaths(target);
    await checkRequiredFiles([paths.appHtml, paths.appIndexJs]);
  }

  await checkBrowsers(startPath);

  // True if there's no preference set - or the preference is for webpack.
  const useWebpack =
    !process.env.USE_MODULAR_WEBPACK ||
    process.env.USE_MODULAR_WEBPACK === 'true';

  // True if the preferene IS set and the preference is esbuid.
  const useEsbuild =
    process.env.USE_MODULAR_ESBUILD &&
    process.env.USE_MODULAR_ESBUILD === 'true';

  // If you want to use webpack then we'll always use webpack. But if you've indicated
  // you want esbuild - then we'll switch you to the new fancy world.
  if (!useWebpack || useEsbuild) {
    const { default: startEsbuildApp } = await import(
      './esbuild-scripts/start'
    );
    await startEsbuildApp(target);
  } else {
    const startScript = require.resolve(
      'modular-scripts/react-scripts/scripts/start.js',
    );
    const modularRoot = getModularRoot();
    const targetName = toParamCase(target);

    const browserTarget = createEsbuildBrowserslistTarget(targetPath);

    logger.debug(`Using target: ${browserTarget.join(', ')}`);

    await execAsync('node', [startScript], {
      cwd: startPath,
      log: false,
      // @ts-ignore
      env: {
        ESBUILD_TARGET_FACTORY: JSON.stringify(browserTarget),
        MODULAR_ROOT: modularRoot,
        MODULAR_PACKAGE: target,
        MODULAR_PACKAGE_NAME: targetName,
      },
    });
  }
}

export default actionPreflightCheck(start);
