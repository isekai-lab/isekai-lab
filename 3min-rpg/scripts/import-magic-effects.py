#!/usr/bin/env python3
import base64, hashlib, io, json, re, sys, zipfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent; OUT=ROOT/'common/vfx/generated'
P={'particlefx_01':('琥珀の護り輪','護り'),'particlefx_02':('灰の輪','煙'),'particlefx_03':('霧の輪','煙'),'particlefx_04':('銀の波紋','水'),'particlefx_05':('石の波紋','土'),'particlefx_06':('太陽の護り輪','光'),'particlefx_07':('氷の波紋','氷'),'particlefx_08':('紫の波紋','秘術'),'particlefx_09':('火の輪','炎'),'particlefx_10':('火柱','炎'),'particlefx_11':('爆炎','炎'),'particlefx_12':('藍の波紋','秘術'),'particlefx_13':('黄金の波紋','光'),'particlefx_14':('青の護り輪','氷'),'air_bubbles_01':('上昇する泡','水'),'air_bubbles_02':('細かな泡','水'),'fire_01':('焚き火','炎'),'fire_01b':('高い炎','炎'),'fire_01c':('広がる炎','炎'),'fire_02':('煙る炎','炎'),'lighter_flame_01':('ろうそくの炎','炎'),'teleporter_01':('転移門','転移'),'teleporter_hit':('転移到着','転移')}
M={'fx1_blue_topEffect':('蒼天の術','秘術'),'fx2_swordFire':('炎剣','炎'),'fx3_fireBall':('火球','炎'),'fx4_sign_of_fire':('炎の印','炎'),'fx5_fire_scissors':('双炎','炎'),'fx6_eaterFire':('喰らう炎','炎'),'fx7_energyBall':('力の球','秘術'),'fx8_lighteningBall':('雷球','雷'),'fx9_rainOnGround':('地を打つ雨','水'),'fx10_blackExplosion':('黒い爆発','闇')}
def h(b): return hashlib.sha256(b).hexdigest()
def key(s): return [int(x) if x.isdigit() else x for x in re.split(r'(\d+)',s)]
def png(im):
 b=io.BytesIO(); im.save(b,'PNG',optimize=True); return b.getvalue()
def sheet(frames):
 rows=(len(frames)+7)//8; out=Image.new('RGBA',(512,rows*64))
 for i,f in enumerate(frames): out.alpha_composite(f,((i%8)*64,(i//8)*64))
 return out,rows
def fit(im):
 im=im.convert('RGBA'); q=64/max(im.size); size=(round(im.width*q),round(im.height*q)); out=Image.new('RGBA',(64,64)); out.alpha_composite(im.resize(size,Image.Resampling.LANCZOS),((64-size[0])//2,(64-size[1])//2)); return out
def record(id,name,cat,src,url,author,files,raws,frames,fps):
 sh,rows=sheet(frames); data=png(sh); mik=author=='Mikodrak'; return {'id':id,'name':name,'category':cat,'duration':len(frames)/fps,'size':64,'source':src,'sourceURL':url,'author':author,'license':'CC0-1.0','sourceFile':files[0] if len(files)==1 else files[0].split('/')[0]+'/','sourceHash':h(raws[0]) if len(raws)==1 else None,'sourceFrameHashes':[] if len(raws)==1 else [h(x) for x in raws],'transformedHash':h(data),'transformation':'long-edge-64px; transparent-square-padding; natural-sort; terminal-hold-excluded' if mik else 'crop-128px-cells; cell-resize-64px; preserves-alpha','sourceFPSOrigin':'bundled GIF 30ms frames; terminal hold excluded' if mik else 'Para sheet specification: 30fps','width':512,'height':rows*64,'columns':8,'rows':rows,'frameCount':len(frames),'fps':fps,'frameWidth':64,'frameHeight':64,'data':'data:image/png;base64,'+base64.b64encode(data).decode()}
def main():
 if len(sys.argv)!=4: raise SystemExit('Usage: ... para1.zip para2.zip mikodrak-fx.zip')
 entries=[]
 for number,(archive,url) in enumerate(zip(sys.argv[1:3],['https://opengameart.org/content/animated-particle-effects-1','https://opengameart.org/content/animated-particle-effects-2']),1):
  with zipfile.ZipFile(archive) as z:
   for f in z.namelist():
    id=Path(f).stem
    if id not in P: continue
    raw=z.read(f); im=Image.open(io.BytesIO(raw)).convert('RGBA')
    if im.size!=(1024,1024): raise ValueError(f)
    frames=[im.crop(((n%8)*128,(n//8)*128,(n%8+1)*128,(n//8+1)*128)).resize((64,64),Image.Resampling.LANCZOS) for n in range(64)]
    entries.append(record(id,*P[id],f'Para / Animated particle effects #{number}',url,'Para',[f],[raw],frames,30))
 with zipfile.ZipFile(sys.argv[3]) as z:
  for id,(name,cat) in M.items():
   files=sorted([f for f in z.namelist() if f.startswith(id+'/') and f.endswith('.png')],key=key); raws=[z.read(f) for f in files]; entries.append(record(id,name,cat,'Mikodrak / 2D Spell Effects','https://opengameart.org/content/2d-spell-effects','Mikodrak',files,raws,[fit(Image.open(io.BytesIO(x))) for x in raws],1000/30))
 entries.sort(key=lambda x:x['id']); assert len(entries)==33
 OUT.mkdir(parents=True,exist_ok=True); (OUT/'magic-effects.manifest.json').write_text(json.dumps([{k:v for k,v in x.items() if k!='data'} for x in entries],ensure_ascii=False,indent=2)+'\n')
 run=[{'id':x['id'],'name':x['name'],'category':x['category'],'duration':x['duration'],'size':x['size'],'source':x['source'],'sourceURL':x['sourceURL'],'author':x['author'],'license':x['license'],'sheet':{k:x[k] for k in ('data','columns','rows','frameCount','fps','frameWidth','frameHeight')}} for x in entries]
 (OUT/'magic-effects.ts').write_text("import type { SpriteSheetOptions } from '../sprite-sheet.ts';\nexport type GeneratedMagicEffect = { id:string; name:string; category:string; duration:number; size:number; source:string; sourceURL:string; author:string; license:'CC0-1.0'; sheet:SpriteSheetOptions };\nexport const GENERATED_MAGIC_EFFECTS: GeneratedMagicEffect[] = "+json.dumps(run,ensure_ascii=False,separators=(',',':'))+';\n')
 print(f'Embedded {len(entries)} effects, {sum(len(x["data"]) for x in entries)//1024} KiB')
if __name__=='__main__': main()
