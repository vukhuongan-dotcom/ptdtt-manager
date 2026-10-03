import json, numpy as np, math
from color import hex2rgb, srgb_to_lin, lin_to_srgb, to_oklch
M={'deutan':np.array([[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]]),
   'protan':np.array([[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]])}
def sim(h,m):
    lin=np.array([srgb_to_lin(c) for c in hex2rgb(h)]); o=np.clip(M[m]@lin,0,1)
    return '#%02X%02X%02X'%tuple(int(round(max(0,min(1,lin_to_srgb(x)))*255)) for x in o)
def de(a,b):
    la,ca,ha=to_oklch(a); lb,cb,hb=to_oklch(b)
    return 100*math.dist((la,ca*math.cos(math.radians(ha)),ca*math.sin(math.radians(ha))),(lb,cb*math.cos(math.radians(hb)),cb*math.sin(math.radians(hb))))
def main():
 T=json.load(open('tokens.json'))
 for th in ['light','dark']:
   t=T[th]
   for name,grp in [('Cách mổ',['--surgery-mo','--surgery-noisoi','--surgery-nsth','--surgery-robot']),('Loại mổ',['--stype-chuongtrinh','--stype-yeucau','--stype-bankhan','--stype-robot']),('Biểu đồ',[f'--chart-{i}' for i in range(1,7)])]:
     cols=[t[k] for k in grp]; r=[]
     for mode in ['normal','deutan','protan']:
         cs=cols if mode=='normal' else [sim(c,mode) for c in cols]
         mn=min((de(cs[i],cs[j]),grp[i][2:],grp[j][2:]) for i in range(len(cs)) for j in range(i+1,len(cs)))
         r.append('%s ΔE %.1f (%s/%s)'%(mode,*mn))
     print(th,name,' | '.join(r))

if __name__=='__main__': main()