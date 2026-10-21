import itertools
crit="ABCDEFGHIJ"
S={
"C01 Abandoned":      [4,2,2,2,5,4,4,4,4,3],
"C02 TrendDetective": [4,3,3,3,5,5,3,4,5,3],
"C03 JuniorTrainer":  [4,1,1,3,5,5,4,4,5,3],
"C04 CLPS":           [4,3,2,3,2,4,3,4,5,3],
"C05 Health":         [4,2,3,2,4,2,3,2,4,3],
"C06 SARs":           [4,3,4,3,2,2,3,3,4,3],
"C07 FieldShift":     [4,2,2,4,4,4,3,3,5,3],
"C08 Flame":          [4,3,2,2,2,2,3,3,5,3],
"C09 MODIS-VIIRS":    [5,3,2,4,3,3,4,4,5,4],
"C10 Analogs":        [4,3,2,3,3,4,4,3,5,3],
"C11 MartianMap":     [5,2,1,2,4,5,3,3,3,3],
"C12 SPHEREx":        [4,1,1,2,2,4,4,3,5,4],
"C13 MissionGame":    [4,2,2,3,4,5,3,4,5,3],
"C14 Jukebox":        [4,3,3,4,4,4,3,3,4,4],
}
W={
"base (justificado)":   [8,12,15,12,12,8,10,10,5,8],
"pesos iguales":        [10]*10,
"demo/presentación":    [8,8,10,8,14,8,18,6,5,15],
"rigor/ciencia":        [8,12,12,10,10,10,8,20,5,5],
"competencia dura":     [8,15,25,10,10,6,8,8,5,5],
"sin C (ignora rivales)":[10,14,0,14,14,10,12,12,6,8],
}
def score(v,w): return sum(a*b for a,b in zip(v,w))/sum(w)*20  # 0-100
res={}
for wn,w in W.items():
    r=sorted(((score(v,w),k) for k,v in S.items()),reverse=True)
    res[wn]=r
    print(f"\n== {wn} {w}")
    for i,(s,k) in enumerate(r,1): print(f"{i:2d} {k:20s} {s:5.1f}")
print("\n== rangos por escenario")
names=list(S)
print("desafio".ljust(20),*[w[:10].ljust(10) for w in W])
for k in names:
    print(k.ljust(20),*[str([n for _,n in res[w]].index(k)+1).ljust(10) for w in W])
# perturbacion +-1 en un criterio aleatorio: robustez top5 base
import random
random.seed(1)
cnt={k:0 for k in names}
for _ in range(5000):
    S2={k:[min(5,max(1,x+random.choice([-1,0,0,0,1]))) for x in v] for k,v in S.items()}
    r=sorted(((score(v,W["base (justificado)"]),k) for k,v in S2.items()),reverse=True)[:5]
    for _,k in r: cnt[k]+=1
print("\n== % de simulaciones (ruido ±1 en 40% de celdas) en top-5, pesos base")
for k,c in sorted(cnt.items(),key=lambda x:-x[1]): print(k.ljust(20),f"{c/50:5.1f}%")
