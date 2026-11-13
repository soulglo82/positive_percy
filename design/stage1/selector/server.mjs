import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const current = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(current,'../../..');
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'};
const map=(pathname)=>{
 if(pathname==='/'||pathname==='/index.html')return path.join(current,'index.html');
 if(pathname==='/app.js')return path.join(current,'app.js');
 if(pathname==='/styles.css')return path.join(current,'styles.css');
 if(pathname==='/sources')return path.join(root,'design/stage1/ASSET_REGISTRY.json');
 const dataset={'/data/candidate-plan.json':'design/stage1/candidate-plan.json','/data/rewards-candidates.json':'design/stage1/rewards-candidates.json','/data/illustration-element-candidates.json':'design/stage1/illustration-element-candidates.json','/data/ASSET_REGISTRY.json':'design/stage1/ASSET_REGISTRY.json'};
 if(dataset[pathname])return path.join(root,dataset[pathname]);
 if(/^\/assets\/(phosphor|streamline)\/[a-z0-9-\/]+\.svg$/.test(pathname)){const resolved=path.resolve(root,'design'+pathname);const allowed=path.join(root,'design/assets/');if(resolved.startsWith(allowed))return resolved;}
 return null;
};
const server=http.createServer(async(req,res)=>{
 const send=(code,body,type='text/plain; charset=utf-8')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(body)};
 if(req.method!=='GET'&&req.method!=='HEAD')return send(405,'Method not allowed');
 const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/health')return send(200,'ok');
 const file=map(pathname);if(!file)return send(404,'Asset not found');
 try{const data=await fs.readFile(file);const type=MIME[path.extname(file)]||'application/octet-stream';send(200,req.method==='HEAD'?'':data,type);}catch(e){send(e.code==='ENOENT'?404:500,'Asset not found')}
});
server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('Percy design-only selector listening'));
