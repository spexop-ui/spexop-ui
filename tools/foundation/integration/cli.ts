import { pathToFileURL } from 'node:url';
import { reviewFoundation, formatIntegrationReview } from './index.js';
import { renderCanonicalCSS, writeCanonicalCSS } from '../css-export/index.js';

const usage = `Usage: pnpm foundation:review <project> [--css relative.css ...] [--json | --preview | --write NEW-directory] [--allow-partial] [--theme-literals | --native-context]
Default is read-only review. --preview writes CSS to stdout only; --write explicitly creates a NEW directory.
Partial CSS needs --allow-partial for preview/write. Preserve original stylesheets. --theme-literals is an explicit context transformation.
Exit: 0 = review/operation completed within scope; 2 = blocked or partial output not accepted; 1 = invalid input/IO failure. Review exit 0 is NOT application acceptance.\n`;
export function runIntegrationCLI(args: string[], io: {out:(s:string)=>void;err:(s:string)=>void}): number {
  if(args.length===1 && args[0]==='--help'){io.out(usage);return 0;}
  try {
    const [projectRoot,...rest]=args;
    if(!projectRoot||projectRoot.startsWith('--'))throw Error(usage);
    const cssFiles:string[]=[];let mode='review',outputDirectory='',allowPartial=false,themeLiterals=false,nativeContext=false;
    const seen=new Set<string>();
    for(let i=0;i<rest.length;i++){
      const flag=rest[i];
      if(flag!=='--css'&&seen.has(flag))throw Error(`Repeated option: ${flag}`);
      seen.add(flag);
      if(flag==='--css'||flag==='--write'){
        const value=rest[++i];if(!value||value.startsWith('--'))throw Error(`Missing value for ${flag}`);
        if(flag==='--css')cssFiles.push(value);
        else {if(mode!=='review')throw Error('Choose only one of --json, --preview, --write');mode='write';outputDirectory=value;}
      }else if(flag==='--json'||flag==='--preview'){
        if(mode!=='review')throw Error('Choose only one of --json, --preview, --write');mode=flag.slice(2);
      }else if(flag==='--allow-partial')allowPartial=true;
      else if(flag==='--theme-literals')themeLiterals=true;
      else if(flag==='--native-context')nativeContext=true;
      else throw Error(`Unknown option: ${flag}`);
    }
    const captureOptions={projectRoot,...(nativeContext?{cssContext:true}:{}),...(cssFiles.length?{cssFiles}:{})};
    if(nativeContext&&themeLiterals)throw Error('Native CSS and Tailwind literal materialization are separate modes');
    const planOptions=nativeContext?{preserveNativeContext:true}:themeLiterals?{themeLiterals:'materialize' as const}:{};
    const {review,plan}=reviewFoundation(captureOptions,planOptions);
    if(mode==='review'||mode==='json'){
      io.out(mode==='json'?JSON.stringify({review,plan},null,2)+'\n':formatIntegrationReview(review));
      return plan.status==='blocked'?2:0;
    }
    if(plan.status==='blocked'||(plan.status==='partial'&&!allowPartial)){
      io.err(formatIntegrationReview(review));io.err(plan.status==='blocked'?'No output written. Export is BLOCKED; --allow-partial cannot override blockers or zero exportable declarations. Keep source CSS unchanged.\n':'No output written. Inspect exclusions; partial output requires --allow-partial.\n');return 2;
    }
    if(mode==='preview')io.out(renderCanonicalCSS(plan,{allowPartial}).css);
    else {
      const result=writeCanonicalCSS(captureOptions,{...planOptions,outputDirectory,allowPartial});
      io.out(JSON.stringify({...result,css:undefined,applicationSafety:'not-evaluated',next:'Keep all source CSS. Manually review import order in a disposable copy; compare computed styles before accepting.'},null,2)+'\n');
    }
    return 0;
  }catch(error){io.err((error instanceof Error?error.message:String(error)).replace(/[\u0000-\u001f\u007f-\u009f]/g,' ')+'\n');return 1;}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=runIntegrationCLI(process.argv.slice(2),{out:s=>process.stdout.write(s),err:s=>process.stderr.write(s)});
