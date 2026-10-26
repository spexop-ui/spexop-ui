import fs from 'node:fs';
import path from 'node:path';
import { captureDesignFoundation, type CaptureOptions } from '../capture/index.js';
import { planCanonicalCSS, renderCanonicalCSS, type CSSPlanOptions } from './index.js';
/** Explicit action: re-capture now, preview/validate before IO, reserve one NEW directory. */
export function writeCanonicalCSS(captureOptions: CaptureOptions, options: CSSPlanOptions & {outputDirectory:string;allowPartial?:boolean}) {
  if (!options || Object.keys(options).some(k=>!['outputDirectory','allowPartial','themeLiterals'].includes(k)) || typeof options.outputDirectory !== 'string' || !options.outputDirectory || path.isAbsolute(options.outputDirectory) || options.outputDirectory.split(/[\\/]/).some(p=>!p || p==='.' || p==='..')) throw new TypeError('Output must be a new relative directory within the project.');
  const selected = path.resolve(captureOptions.projectRoot);
  if (fs.lstatSync(selected).isSymbolicLink()) throw new Error('Root symlink refused');
  const root = fs.realpathSync(selected), output = path.join(root, options.outputDirectory), parent = path.dirname(output);
  let part = root;
  for (const name of path.relative(root,parent).split(path.sep).filter(Boolean)) {
    part = path.join(part,name);
    const stat = fs.lstatSync(part);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Output parent must be an existing real directory');
  }
  const before = fs.lstatSync(parent);
  const capture = captureDesignFoundation(captureOptions);
  const plan = planCanonicalCSS(capture, options.themeLiterals ? {themeLiterals:options.themeLiterals}:{});
  const result = renderCanonicalCSS(plan,{allowPartial:options.allowPartial});
  const after = fs.lstatSync(parent);
  if (after.isSymbolicLink() || before.dev!==after.dev || before.ino!==after.ino || fs.realpathSync(parent)!==parent) throw new Error('Output parent changed');
  fs.mkdirSync(output,{mode:0o700}); // EEXIST for directory/file/symlink/hardlink; never reuse.
  // Preserve a failed partial write for diagnosis; never delete a path whose ownership may have changed.
  fs.writeFileSync(path.join(output,'tokens.css'),result.css,{flag:'wx',mode:0o600});
  fs.writeFileSync(path.join(output,'plan.json'),JSON.stringify({plan,output:{...result,css:undefined}},null,2)+'\n',{flag:'wx',mode:0o600});
  return {...result,outputDirectory:options.outputDirectory,files:['tokens.css','plan.json']};
}
