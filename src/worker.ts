import * as fs from 'fs';
import workerpool from 'workerpool';
import { parse, transform } from './index';

interface TransformResult {
  changed: boolean;
  skipped: boolean;
  source: string;
}

interface TransformOptions {
  dry: boolean;
}

async function run(transformPath: string, filePath: string, options: TransformOptions) {
  const module = require(transformPath);
  const plugin = typeof module.default === 'function' ? module.default : module;

  return readFile(filePath)
    .then((contents) => applyTransform(plugin, filePath, contents))
    .then((output) => writeFile(filePath, output, options))
    .then((output) => ({
      type: 'update',
      file: filePath,
      status: output.skipped ? 'skipped' : output.changed ? 'ok' : 'nochange',
    }))
    .catch((err) => ({
      type: 'error',
      file: filePath,
      error: err.stack,
    }));
}

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
function readFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, contents) => {
      err ? reject(err) : resolve(contents);
    });
  });
}

function applyTransform(plugin: Function, filePath: string, contents: string): TransformResult {
  const code = plugin(
    {
      path: filePath,
      source: contents,
    },
    {
      parse,
      visit(ast: any, callback: any) {
        const results = transform(ast, callback);
        return results && results.code;
      },
    }
  );

  return {
    skipped: !code,
    changed: code !== contents,
    source: code,
  };
}

async function writeFile(
  filePath: string,
  output: TransformResult,
  options: TransformOptions
): Promise<TransformResult> {
  const { changed, source } = output;

  if (options.dry || !changed) {
    return output;
  }

  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, source, 'utf8', (err) => {
      err ? reject(err) : resolve(output);
    });
  });
}

workerpool.worker({
  run,
});
