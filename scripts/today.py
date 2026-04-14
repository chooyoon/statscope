"""Analyze today's games with StatScope Model v2.2"""
import json, math, urllib.request

def fetch(url):
    with urllib.request.urlopen(url) as res:
        return json.loads(res.read())

# 1. Standings
sd = fetch("https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason&hydrate=team")
teams = {}
for rec in sd.get("records", []):
    for tr in rec.get("teamRecords", []):
        l10 = next((r for r in tr.get("records",{}).get("splitRecords",[]) if r["type"]=="lastTen"), None)
        teams[tr["team"]["id"]] = {
            "w": tr["wins"], "l": tr["losses"],
            "rs": tr["runsScored"], "ra": tr["runsAllowed"],
            "l10w": l10["wins"] if l10 else 5, "l10l": l10["losses"] if l10 else 5,
            "era": 0.0, "woba": 0.0
        }

# 2. Team stats
hitting = fetch("https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=hitting&sportId=1&season=2026")
pitching = fetch("https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=pitching&sportId=1&season=2026")
for sp in pitching.get("stats",[{}])[0].get("splits",[]):
    tid = sp["team"]["id"]
    if tid in teams: teams[tid]["era"] = float(sp["stat"].get("era","0") or 0)
for sp in hitting.get("stats",[{}])[0].get("splits",[]):
    tid = sp["team"]["id"]
    if tid not in teams: continue
    s = sp["stat"]
    singles = s.get("hits",0) - s.get("doubles",0) - s.get("triples",0) - s.get("homeRuns",0)
    denom = s.get("atBats",0) + s.get("baseOnBalls",0) - s.get("intentionalWalks",0) + s.get("sacFlies",0) + s.get("hitByPitch",0)
    if denom > 0:
        teams[tid]["woba"] = (0.69*(s.get("baseOnBalls",0)-s.get("intentionalWalks",0)) + 0.72*s.get("hitByPitch",0) + 0.88*singles + 1.27*s.get("doubles",0) + 1.62*s.get("triples",0) + 2.1*s.get("homeRuns",0)) / denom

# 3. Games
gd = fetch("https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-04-15&hydrate=probablePitcher,team&gameType=R")
games = []
for d in gd.get("dates",[]):
    for g in d.get("games",[]):
        h = g["teams"]["home"]; a = g["teams"]["away"]
        games.append({"pk":g["gamePk"],"an":a["team"]["name"],"hn":h["team"]["name"],
            "ai":a["team"]["id"],"hi":h["team"]["id"],
            "ap":a.get("probablePitcher",{}).get("fullName","TBD"),
            "api":a.get("probablePitcher",{}).get("id",0),
            "hp":h.get("probablePitcher",{}).get("fullName","TBD"),
            "hpi":h.get("probablePitcher",{}).get("id",0)})

# 4. Pitcher stats
pids = set()
for g in games:
    if g["api"]: pids.add(g["api"])
    if g["hpi"]: pids.add(g["hpi"])
pitchers = {}
for pid in pids:
    if pid == 0: continue
    try:
        pd = fetch(f"https://statsapi.mlb.com/api/v1/people/{pid}?hydrate=stats(group=[pitching],type=[season],season=2026)")
        st = pd["people"][0]["stats"][0]["splits"][0]["stat"]
        ip_raw = float(st.get("inningsPitched","0") or 0)
        ip = int(ip_raw) + round((ip_raw-int(ip_raw))*10)/3
        fip_ip = ip if ip > 0 else 1
        fip = (13*st.get("homeRuns",0)+3*(st.get("baseOnBalls",0)+st.get("hitByPitch",0))-2*st.get("strikeOuts",0))/fip_ip+3.1
        pitchers[pid] = {"era":float(st.get("era","0") or 0),"fip":max(0,round(fip,2)),"whip":float(st.get("whip","0") or 0),"ip":round(ip,1)}
    except: pass

# 5. Model v2.2
C = {"SI":0.0264,"BI":0.0024,"LI":0.064,"PI":0.024,"RW":0.30,"RF":0.22,"HA":0.066}
LE = 4.0; LW = 0.315; PX = 1.83
PF = {108:0.97,109:1.05,110:1.04,111:1.08,112:1.05,113:1.10,114:0.98,115:1.35,116:0.97,117:1.02,118:0.99,119:0.98,120:1.00,121:0.95,133:1.00,134:0.94,135:0.94,136:0.96,137:0.93,138:0.98,139:0.95,140:1.00,141:1.04,142:1.01,143:1.06,144:1.00,145:1.07,146:0.92,147:1.06,158:1.03}

def cl(v,lo,hi): return max(lo,min(hi,v))
def py(rs,ra):
    if rs<=0 and ra<=0: return 0.5
    a=pow(max(rs,0),PX); b=pow(max(ra,0),PX)
    return a/(a+b) if a+b>0 else 0.5
def l5(a,b):
    d=a+b-2*a*b; return (a-a*b)/d if d!=0 else 0.5
def ml(p):
    if p>=0.5: return str(round(-(p/(1-p))*100))
    return "+"+str(round(((1-p)/p)*100))

results = []
for g in games:
    ht=teams.get(g["hi"],{}); at=teams.get(g["ai"],{})
    if not ht or not at: continue
    hp=pitchers.get(g["hpi"]); ap=pitchers.get(g["api"])
    pf=PF.get(g["hi"],1.0)
    hPy=py(ht["rs"],ht["ra"]); aPy=py(at["rs"],at["ra"])
    hm=hp["fip"] if hp and hp["fip"]>0 else LE
    am=ap["fip"] if ap and ap["fip"]>0 else LE
    hip=hp["ip"] if hp else 0; aip=ap["ip"] if ap else 0
    hSA=(LE-hm)*C["SI"]*min(1,hip/50); aSA=(LE-am)*C["SI"]*min(1,aip/50)
    hB=(LE-ht["era"])*C["BI"] if ht["era"]>0 else 0
    aB=(LE-at["era"])*C["BI"] if at["era"]>0 else 0
    hL=((ht["woba"]-LW)/LW)*C["LI"] if ht["woba"]>0 else 0
    aL=((at["woba"]-LW)/LW)*C["LI"] if at["woba"]>0 else 0
    hA=cl(hPy+(hSA-aSA)+(hB-aB)+(hL-aL),0.25,0.75)
    aA=cl(aPy+(aSA-hSA)+(aB-hB)+(aL-hL),0.25,0.75)
    hR=ht["l10w"]/(ht["l10w"]+ht["l10l"]) if (ht["l10w"]+ht["l10l"])>0 else 0.5
    aR=at["l10w"]/(at["l10w"]+at["l10l"]) if (at["l10w"]+at["l10l"])>0 else 0.5
    hBl=hA*(1-C["RW"])+hR*C["RW"]; aBl=aA*(1-C["RW"])+aR*C["RW"]
    prob=l5(hBl,aBl)+C["HA"]
    hW=ht["woba"] or LW; aW=at["woba"] or LW
    prob+=(pf-1.0)*((hW-aW)/LW)*C["PI"]
    prob=prob*(1-C["RF"])+0.5*C["RF"]
    prob=cl(prob,0.2,0.8)
    # O/U
    hG=ht["w"]+ht["l"] or 1; aG=at["w"]+at["l"] or 1
    hRPG=ht["rs"]/hG; aRPG=at["rs"]/aG
    hOA=am/LE; aOA=hm/LE
    hBA=at["era"]/LE if at["era"]>0 else 1; aBA=ht["era"]/LE if ht["era"]>0 else 1
    hRn=hRPG*(hOA*0.6+hBA*0.4)*pf; aRn=aRPG*(aOA*0.6+aBA*0.4)*pf
    hE=round((hRn*0.85+4.5*0.15)*10)/10; aE=round((aRn*0.85+4.5*0.15)*10)/10
    tot=round((hE+aE)*2)/2
    margin=round((hE-aE)*10)/10
    edge=abs(prob-0.5)
    results.append({"an":g["an"],"hn":g["hn"],"ap":g["ap"],"hp":g["hp"],
        "hW":round(prob*100,1),"aW":round((1-prob)*100,1),
        "hML":ml(prob),"aML":ml(1-prob),"tot":tot,"hE":hE,"aE":aE,
        "margin":margin,"edge":edge,"hPy":round(hPy*100,1),"aPy":round(aPy*100,1),
        "hERA":hp["era"] if hp else 0,"aERA":ap["era"] if ap else 0,
        "hFIP":hp["fip"] if hp else 0,"aFIP":ap["fip"] if ap else 0,
        "hL10":f"{ht['l10w']}-{ht['l10l']}","aL10":f"{at['l10w']}-{at['l10l']}",
        "pf":pf,"hRec":f"{ht['w']}-{ht['l']}","aRec":f"{at['w']}-{at['l']}",
        "covers":abs(margin)>=1.5})

results.sort(key=lambda x: x["edge"], reverse=True)
for i,r in enumerate(results[:5]):
    fav=r["hn"] if r["hW"]>50 else r["an"]
    ud=r["an"] if r["hW"]>50 else r["hn"]
    print(f"\n{'='*60}")
    print(f"#{i+1}  {r['an']} @ {r['hn']}")
    print(f"  Record: {r['aRec']} vs {r['hRec']}")
    print(f"  Starters: {r['ap']} (ERA {r['aERA']}, FIP {r['aFIP']}) vs {r['hp']} (ERA {r['hERA']}, FIP {r['hFIP']})")
    print(f"  Win%: {r['an']} {r['aW']}% | {r['hn']} {r['hW']}%")
    print(f"  Moneyline: {r['an']} {r['aML']} | {r['hn']} {r['hML']}")
    print(f"  O/U: {r['tot']} (exp {r['aE']}+{r['hE']}={round(r['aE']+r['hE'],1)})")
    rl_sign = "+" if r["margin"]>0 else ""
    print(f"  Run Line: {fav} -1.5 (exp margin {rl_sign}{r['margin']}) {'COVERS' if r['covers'] else 'TIGHT'}")
    print(f"  Last 10: {r['aL10']} vs {r['hL10']}  |  Park: {r['pf']}")
    print(f"  Model Edge: {round(r['edge']*100,1)}%")
