from palette import P, STEPS
from color import cr, from_oklch
N,O,L,LI,S,A,R,RO,V,G=[P[k] for k in ('navy','ocean','leaf','lime','slate','amber','red','rose','violet','green')]
DARK={'bg':'#0C1022','surface':'#141A30','surface3':'#1D2440','hover':'#262F4F'}
light={
 # surfaces
 '--surface-1':'#FFFFFF','--surface-2':S[50],'--surface-3':S[100],'--surface-card':'#FFFFFF',
 # text
 '--text-primary':S[900],'--text-heading':N[900],'--text-secondary':S[700],'--text-muted':S[600],'--text-link':O[700],'--text-on-brand':'#FFFFFF',
 # brand
 '--brand':N[900],'--brand-fill':N[900],'--brand-hover':N[800],'--brand-soft':N[50],'--brand-soft-strong':N[100],
 '--brand-accent':O[700],'--brand-leaf':L[500],'--brand-lime':LI[400],
 '--gradient-brand':f'linear-gradient(135deg, {O[600]} 0%, {L[500]} 100%)',
 # borders
 '--border-default':S[200],'--border-subtle':S[100],'--border-strong':S[500],'--focus-ring':O[600],
 # states (text-safe) + soft bg
 '--state-success':L[700],'--state-success-bg':L[50],'--state-warning':A[700],'--state-warning-fill':A[500],'--state-warning-bg':A[50],
 '--state-danger':R[600],'--state-danger-bg':R[50],'--state-info':O[700],'--state-info-bg':O[50],
 # surgery approach (fill, white text)
 '--surgery-mo':RO[700],'--surgery-noisoi':G[500],'--surgery-nsth':V[600],'--surgery-robot':N[800],
 '--surgery-mo-on':'#FFFFFF','--surgery-noisoi-on':N[950],'--surgery-nsth-on':'#FFFFFF','--surgery-robot-on':'#FFFFFF',
 '--surgery-mo-bg':RO[100],'--surgery-mo-fg':RO[800],'--surgery-noisoi-bg':G[100],'--surgery-noisoi-fg':G[800],
 '--surgery-nsth-bg':V[100],'--surgery-nsth-fg':V[800],'--surgery-robot-bg':N[100],'--surgery-robot-fg':N[800],
 # surgery type (loại mổ)
 '--stype-chuongtrinh':O[600],'--stype-yeucau':'#FFC107','--stype-bankhan':R[700],'--stype-robot':N[800],
 '--stype-chuongtrinh-on':'#FFFFFF','--stype-yeucau-on':N[950],'--stype-bankhan-on':'#FFFFFF','--stype-robot-on':'#FFFFFF',
 # charts
 '--chart-1':N[800],'--chart-2':O[500],'--chart-3':L[600],'--chart-4':A[800],'--chart-5':RO[500],'--chart-6':S[500],
}
dark={
 '--surface-1':DARK['surface'],'--surface-2':DARK['bg'],'--surface-3':DARK['surface3'],'--surface-card':DARK['surface'],
 '--text-primary':'#EEF1FB','--text-heading':'#FFFFFF','--text-secondary':'#C3C9DA','--text-muted':'#97A0B7','--text-link':O[300],'--text-on-brand':'#FFFFFF',
 '--brand':N[600],'--brand-fill':N[600],'--brand-hover':N[700],'--brand-soft':'#1E2547','--brand-soft-strong':'#28315E',
 '--brand-accent':O[300],'--brand-leaf':L[400],'--brand-lime':LI[400],
 '--gradient-brand':f'linear-gradient(135deg, {O[500]} 0%, {L[500]} 100%)',
 '--border-default':'#2A3250','--border-subtle':'#1D2440','--border-strong':'#6C7593','--focus-ring':O[300],
 '--state-success':L[300],'--state-success-bg':'#13261A','--state-warning':A[300],'--state-warning-fill':A[400],'--state-warning-bg':'#2B200F',
 '--state-danger':R[300],'--state-danger-bg':'#33141A','--state-info':O[300],'--state-info-bg':'#0F2236',
 '--surgery-mo':RO[600],'--surgery-noisoi':G[500],'--surgery-nsth':V[600],'--surgery-robot':N[300],
 '--surgery-mo-on':'#FFFFFF','--surgery-noisoi-on':N[950],'--surgery-nsth-on':'#FFFFFF','--surgery-robot-on':N[950],
 '--surgery-mo-bg':'#3A1424','--surgery-mo-fg':RO[300],'--surgery-noisoi-bg':'#10291A','--surgery-noisoi-fg':G[300],
 '--surgery-nsth-bg':'#271A47','--surgery-nsth-fg':V[300],'--surgery-robot-bg':'#1E2547','--surgery-robot-fg':N[300],
 '--stype-chuongtrinh':O[600],'--stype-yeucau':'#FFC107','--stype-bankhan':R[600],'--stype-robot':N[300],
 '--stype-chuongtrinh-on':'#FFFFFF','--stype-yeucau-on':N[950],'--stype-bankhan-on':'#FFFFFF','--stype-robot-on':N[950],
 '--chart-1':N[500],'--chart-2':O[300],'--chart-3':L[200],'--chart-4':A[500],'--chart-5':RO[400],'--chart-6':S[400],
}
import json
json.dump({'light':light,'dark':dark,'palette':P},open('tokens.json','w'),indent=1)
# contrast checks: (fg,bg,label,min)
def checks(t,mode):
    bgp=t['--surface-2']; card=t['--surface-1']
    C=[]
    for fg in ['--text-primary','--text-heading','--text-secondary','--text-muted','--text-link','--state-success','--state-warning','--state-danger','--state-info']:
        C.append((fg,'--surface-1',4.5)); C.append((fg,'--surface-2',4.5))
    for s in ['success','warning','danger','info']: C.append((f'--state-{s}',f'--state-{s}-bg',4.5))
    C.append(('--text-on-brand','--brand',4.5)); C.append(('--text-on-brand','--brand-hover',4.5))
    C.append(('--text-primary','--brand-soft',4.5)) ; C.append(('--brand-accent','--surface-1',4.5))
    C.append(('--border-strong','--surface-1',3.0)); C.append(('--focus-ring','--surface-1',3.0)); C.append(('--focus-ring','--surface-2',3.0))
    for k in ['mo','noisoi','nsth','robot']:
        C.append((f'--surgery-{k}','--surface-1',3.0))
        C.append((f'--surgery-{k}-on',f'--surgery-{k}',4.5)); C.append((f'--surgery-{k}-fg',f'--surgery-{k}-bg',4.5))
    for k in ['chuongtrinh','yeucau','bankhan','robot']:
        C.append((f'--stype-{k}-on',f'--stype-{k}',4.5)); C.append((f'--stype-{k}',f'--surface-1',3.0))
    for i in range(1,7): C.append((f'--chart-{i}','--surface-1',3.0))
    out=[]
    for fg,bg,mn in C:
        f=t.get(fg,fg); b=t.get(bg,bg); r=cr(f,b); out.append((mode,fg,f,bg,b,r,mn,r>=mn))
    return out
res=checks(light,'light')+checks(dark,'dark')
fails=[r for r in res if not r[7]]
for r in res: print('%-5s %-24s %s on %-20s %s  %.2f  %s'%(r[0],r[1],r[2],r[3],r[4],r[5],'OK' if r[7] else 'FAIL<%.1f'%r[6]))
print('FAILS',len(fails),'/',len(res))
json.dump(res,open('contrast.json','w'))
