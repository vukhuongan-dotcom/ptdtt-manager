from color import *
STEPS=[50,100,200,300,400,500,600,700,800,900,950]
LT={50:0.975,100:0.945,200:0.895,300:0.82,400:0.725,500:0.635,600:0.545,700:0.47,800:0.39,900:0.30,950:0.225}
def scale(H,Cmax,anchor=None,cshape=None, hshift=None):
    out={}
    for s in STEPS:
        L=LT[s]
        f={50:0.12,100:0.22,200:0.40,300:0.62,400:0.85,500:1,600:1,700:0.95,800:0.85,900:0.75,950:0.6}[s] if cshape is None else cshape[s]
        h=H+(hshift(s) if hshift else 0)
        out[s]=from_oklch(L,Cmax*f,h)
    if anchor:
        s,hexv=anchor; out[s]=hexv
    return out
P={}
P['navy']=scale(273.9,0.14,anchor=(900,'#1D2357'))
P['ocean']=scale(243,0.13,anchor=(600,'#1878B4'))
P['leaf']=scale(139.4,0.17,anchor=(500,'#54A83C'),cshape={50:0.12,100:0.22,200:0.40,300:0.62,400:0.85,500:1,600:0.80,700:0.72,800:0.66,900:0.58,950:0.5})
P['lime']=scale(127.4,0.17,anchor=(400,'#90C03C'))
P['slate']=scale(268,0.035,cshape={50:0.25,100:0.35,200:0.45,300:0.55,400:0.65,500:0.75,600:0.85,700:0.95,800:1,900:1,950:1})
P['amber']=scale(70,0.16)
P['red']=scale(25,0.20)
P['rose']=scale(10,0.21)
P['violet']=scale(295,0.20)
P['green']=scale(150,0.15)
if __name__=='__main__':
    for k,v in P.items():
        print(k.ljust(7),' '.join(f'{s}:{v[s]}' for s in STEPS))
        print(' '*7,' '.join(f'{s}:{cr(v[s],"#FFFFFF"):.2f}' for s in STEPS))
