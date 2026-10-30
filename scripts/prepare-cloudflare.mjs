import {readdir,stat,readFile,mkdir,mkdtemp,copyFile,writeFile} from 'node:fs/promises';
import {resolve,join,relative,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function prepareCloudflare(root){
 root=resolve(root);const source=join(root,'dist'),files=[];
 async function scan(directory){
  for(const item of await readdir(directory,{withFileTypes:true})){
   const file=join(directory,item.name),name=relative(source,file).replaceAll('\\','/');
   if(item.isSymbolicLink()||name.split('/').some(p=>p.startsWith('.')))throw Error('Asset não permitido: '+name);
   if(item.isDirectory()){
    if(!['assets','downloads'].includes(name)&&!name.startsWith('assets/'))throw Error('Diretório não permitido: '+name);
    await scan(file);continue;
   }
   if(!item.isFile()||name.startsWith('downloads/')&&name!=='downloads/forma-guia-desktop.md'||(!['.html','.js','.css','.svg','.png','.jpg','.jpeg','.webp','.ico','.woff','.woff2','.ttf'].includes(extname(name))&&name!=='downloads/forma-guia-desktop.md'))throw Error('Asset não permitido: '+name);
   const size=(await stat(file)).size;if(size>25*1024*1024)throw Error('Asset excede 25 MiB: '+name);files.push({file,name,size});
  }
 }
 await scan(source);if(!files.some(f=>f.name==='index.html'))throw Error('Compile o site antes de preparar o Cloudflare.');
 const template=JSON.parse(await readFile(join(root,'apps/edge/wrangler.jsonc'),'utf8'));
 const base=join(root,'release/cloudflare');await mkdir(base,{recursive:true});const folder=await mkdtemp(join(base,'candidate-'));
 const site=join(folder,'site');await mkdir(site);
 for(const file of files){const output=join(site,file.name);await mkdir(dirname(output),{recursive:true});await copyFile(file.file,output);}
 const config={...template,$schema:relative(folder,join(root,'node_modules/wrangler/config-schema.json')).replaceAll('\\','/'),main:relative(folder,join(root,'apps/edge/worker.ts')).replaceAll('\\','/'),assets:{...template.assets,directory:'./site'}};
 const configPath=join(folder,'wrangler.json');await writeFile(configPath,JSON.stringify(config,null,2));
 const report={published:false,files:files.length,bytes:files.reduce((n,f)=>n+f.size,0),config:configPath,site};
 await writeFile(join(folder,'report.json'),JSON.stringify(report,null,2));return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 prepareCloudflare(resolve(dirname(fileURLToPath(import.meta.url)),'..')).then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
