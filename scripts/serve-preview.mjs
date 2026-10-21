import http from 'node:http';
import {readFile} from 'node:fs/promises';

const page=new URL('../dist_single/index.html',import.meta.url);
http.createServer(async(request,response)=>{
  const path=new URL(request.url,'http://127.0.0.1').pathname;
  if(path!=='/'&&path!=='/index.html'){response.writeHead(404);response.end('Not found');return;}
  try{
    const content=await readFile(page);
    response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    response.end(content);
  }catch{
    response.writeHead(503);response.end('Rebuilding the games collection. Please refresh shortly.');
  }
}).listen(5182,'127.0.0.1',()=>console.log('Tiltu’s Games ready at http://127.0.0.1:5182/'));
