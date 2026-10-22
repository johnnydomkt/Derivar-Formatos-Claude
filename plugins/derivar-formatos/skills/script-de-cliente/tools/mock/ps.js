// Photoshop simulado (DOM + ActionManager mínimos) para testar o script sem o Photoshop.
// Camada de preenchimento sem máscara ("infinite"), camadas travadas e de ajuste recusam
// "Transformar", como no Photoshop real.
const fs=require('fs');
let ID=1;
const LK={NORMAL:1,TEXT:2,SMARTOBJECT:3,SOLIDFILL:4,GRADIENTFILL:5,PATTERNFILL:6,CURVES:20,LEVELS:21,BRIGHTNESSCONTRAST:22,VIBRANCE:23,COLORBALANCE:24,SELECTIVECOLOR:25,HUESATURATION:26};
global.LayerKind=LK;
global.Units={PIXELS:'px'}; global.DialogModes={NO:3}; global.SaveOptions={DONOTSAVECHANGES:2}; global.Extension={LOWERCASE:1};
global.AnchorPosition={TOPLEFT:1,MIDDLECENTER:5};
global.UnitValue=function(v,u){return {value:v, as:()=>v};};
function UV(v){return {value:v,as:()=>v};}
class Layer{
  constructor(o,parent){Object.assign(this,{visible:true,grouped:false,kind:LK.NORMAL,allLocked:false,positionLocked:false,pixelsLocked:false,transparentPixelsLocked:false},o);this.id=ID++;this.parent=parent;
    if(o.children){this.typename='LayerSet';this.layers=o.children.map(c=>new Layer(c,this));delete this.children;} else this.typename='ArtLayer';
    if(this.typename=='ArtLayer'){ this.b=o.b.slice(); this.b0=o.b.slice(); } }
  get bounds(){return this._bb().map(UV);} get boundsNoEffects(){return this.bounds;}
  _bb(){ if(this.typename=='ArtLayer') return this.b; let u=null; for(const c of this.layers){ if(!c.visible) continue; const b=c._bb(); if(b[2]-b[0]<=0) continue; u=u?[Math.min(u[0],b[0]),Math.min(u[1],b[1]),Math.max(u[2],b[2]),Math.max(u[3],b[3])]:b.slice(); } return u||[0,0,0,0]; }
  translate(dx,dy){ dx=dx.value!==undefined?dx.value:dx; dy=dy.value!==undefined?dy.value:dy; if(this.allLocked||this.positionLocked) throw new Error('locked'); this._mv(dx,dy); }
  _mv(dx,dy){ if(this.artboard){ /* artboard: moves content */ } if(this.typename=='ArtLayer'){this.b=[this.b[0]+dx,this.b[1]+dy,this.b[2]+dx,this.b[3]+dy];} else this.layers.forEach(c=>c._mv(dx,dy)); }
  _sc(x,y,s){ if(this.typename=='ArtLayer'){ if(this.kind>=20) return; const b=this.b; this.b=[x+(b[0]-x)*s,y+(b[1]-y)*s,x+(b[2]-x)*s,y+(b[3]-y)*s]; if(this.font) this.font*=s; } else this.layers.forEach(c=>c._sc(x,y,s)); }
  _infDeep(){ if(this.infinite) return true; return this.typename=='LayerSet' && this.layers.some(c=>c._infDeep()); }
  _lockedDeep(){ if(this.allLocked) return true; return this.typename=='LayerSet' && this.layers.some(c=>c._lockedDeep()); }
  resize(){throw new Error('resize not mocked');}
  get isBackgroundLayer(){return false;} set isBackgroundLayer(v){}
  get textItem(){return {contents:this.text||''};}
}
class Doc{
  constructor(spec){this.spec=spec; this.name=spec.name; this.width=UV(spec.w); this.height=UV(spec.h); this.resolution=72; this.layers=spec.layers.map(l=>new Layer(JSON.parse(JSON.stringify(l)),this)); this.path='/tmp/x';}
  duplicate(name){ const d=Object.create(Doc.prototype); d.spec=this.spec; d.name=name; d.width=this.width; d.height=this.height; d.resolution=72; d.path=this.path;
     d.layers=clone(this.layers,d); global.app.documents.push(d); global.app.activeDocument=d; return d; }
  resizeCanvas(w,h){this.width=UV(w.value);this.height=UV(h.value);}
  saveAs(f){ global.SAVED.push({file:f.name||String(f), doc:this}); }
  close(){ const i=global.app.documents.indexOf(this); if(i>=0) global.app.documents.splice(i,1); }
  set activeLayer(L){this._al=L;} get activeLayer(){return this._al;}
}
function clone(layers,parent){ return layers.map(L=>{ const n=Object.create(Layer.prototype); Object.assign(n,L); n.parent=parent; n.id=ID++; if(L.typename=='LayerSet') n.layers=clone(L.layers,n); else { n.b=L.b.slice(); n.b0=L.b0; } return n; }); }
global.SAVED=[];
global.app={documents:[],preferences:{rulerUnits:'px'},displayDialogs:1,bringToFront(){},open(){throw 0}};
Object.defineProperty(global.app,'activeDocument',{get(){return this._ad;},set(d){this._ad=d;},configurable:true});
global.charIDToTypeID=s=>'c:'+s; global.stringIDToTypeID=s=>'s:'+s;
class AD{constructor(){this.k={};} putReference(k,v){this.k[k]=v;} putEnumerated(k,t,v){this.k[k]=v;} putObject(k,c,v){this.k[k]=v;} putUnitDouble(k,u,v){this.k[k]=v;} putDouble(k,v){this.k[k]=v;} putInteger(k,v){this.k[k]=v;}
  getBoolean(k){return this.k[k];} getObjectValue(k){if(!(k in this.k)) throw new Error('no key '+k); return this.k[k];} getDouble(k){return this.k[k];} hasKey(k){return k in this.k;} getList(k){return this.k[k];} getUnitDoubleValue(k){return this.k[k];}}
global.ActionDescriptor=AD; global.ActionReference=class{putIdentifier(c,id){this.id=id;} putEnumerated(){}};
function findById(id,ls){ for(const L of ls){ if(L.id==id) return L; if(L.layers){const r=findById(id,L.layers); if(r) return r;} } }
global.executeActionGet=function(ref){ const L=findById(ref.id,global.app.activeDocument.layers); const d=new AD();
  d.k['s:artboardEnabled']=!!L.artboard; d.k['s:hasVectorMask']=false; d.k['s:hasUserMask']=!L.infinite;
  if(L.artboard){ const ab=new AD(), r=new AD(); r.k['s:left']=L.artboard[0]; r.k['s:top']=L.artboard[1]; r.k['s:right']=L.artboard[2]; r.k['s:bottom']=L.artboard[3]; ab.k['s:artboardRect']=r; d.k['s:artboard']=ab; }
  if(L.kind==LK.TEXT){ const tk=new AD(); const st=new AD(); st.k['s:impliedFontSize']=L.font; const rng=new AD(); rng.k['s:textStyle']=st; tk.k['s:textStyleRange']={count:1,getObjectValue:()=>rng}; d.k['s:textKey']=tk; }
  return d; };
global.executeAction=function(id,desc){ const L=global.app.activeDocument.activeLayer;
  if(id=='c:Trnf'){ if(L.kind>=20 || L._lockedDeep() || L._infDeep()) throw new Error('Transformar indisponivel'); const p=desc.k['c:Pstn']; const s=desc.k['c:Wdth']/100; L._sc(p.k['c:Hrzn'],p.k['c:Vrtc'],s); return; }
  if(id=='s:editArtboardEvent'){ const r=desc.k['s:artboard'].k['s:artboardRect']; const old=L.artboard; const dx=r.k['s:left']-old[0], dy=r.k['s:top']-old[1];
     L.artboard=[r.k['s:left'],r.k['s:top'],r.k['s:right'],r.k['s:bottom']]; if(global.ARTBOARD_MOVES_CONTENT) L.layers.forEach(c=>c._mv(dx,dy)); return; }
  if(id=='s:scaleEffectsEvent') return;
  throw new Error('AM nao mockado '+id); };
global.File=class{constructor(p){this.name=String(p);this.exists=false;this.parent={exists:true,create(){}};} open(){} read(){return '';} write(){} close(){}};
global.Folder=class{constructor(p){this.p=String(p);this.exists=true;this.fsName=p;} create(){} toString(){return this.p;}};
global.Folder.userData='/tmp'; global.Folder.selectDialog=()=>null;
global.alert=m=>{global.ALERT=m;}; global.confirm=()=>true; global.prompt=()=>null;
global.PhotoshopSaveOptions=class{};
module.exports={Doc,LK};
