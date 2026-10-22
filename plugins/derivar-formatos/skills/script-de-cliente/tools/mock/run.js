// Roda o script do cliente num Photoshop simulado.
// uso: node run.js spec.json Derivar_X.jsx formatos.json saida.json [move]
//  formatos.json = [{"label":"Story","w":1080,"h":1920}, ...]
//  "move" simula a versão do Photoshop que leva o conteúdo junto ao mover a prancheta
const path=require('path'); const fs=require('fs');
const {Doc}=require(path.join(__dirname,'ps.js'));
const [specF, jsxF, fmtF, outF, mv]=process.argv.slice(2);
const spec=JSON.parse(fs.readFileSync(specF,'utf8')); global.ARTBOARD_MOVES_CONTENT=(mv=='move');
const src=new Doc(spec); app.documents.push(src); app.activeDocument=src;
let code=fs.readFileSync(jsxF,'utf8').replace(/^﻿/,'').replace(/^#target.*$/m,'');
if(code.indexOf('var cfg = showDialog(presets);')<0) throw new Error('script fora do padrão do motor');
code=code.replace('var cfg = showDialog(presets);','var cfg = TESTCFG;');
global.TESTCFG={formats:JSON.parse(fs.readFileSync(fmtF,'utf8')),layout:'auto',textScale:1,bgAlign:'auto',folderMode:false};
Object.defineProperty(Object.prototype,'toSource',{value:function(){return JSON.stringify(this);},enumerable:false});
global.DEBUG_UNITS=[];
eval(code);
function tree(ls,parentVis){ return ls.map(L=>{ const v=parentVis && L.visible; const n={pid:L.pid,name:L.name,visible:v};
  if(L.typename=='LayerSet'){ n.children=tree(L.layers,v); if(L.artboard) n.artboard=L.artboard.map(x=>Math.round(x*100)/100); }
  else { n.b=L.b.slice(); n.b0=L.b0?L.b0.slice():L.b.slice(); n.kind=L.kind; n.grouped=!!L.grouped; if(L.font) n.font=L.font; }
  return n; }); }
const res={alerta:global.ALERT, unidades:global.DEBUG_UNITS, arquivos:SAVED.map(s=>({arquivo:String(s.file).split('/').pop(), camadas:tree(s.doc.layers,true)}))};
fs.writeFileSync(outF,JSON.stringify(res));
console.log(global.ALERT);
