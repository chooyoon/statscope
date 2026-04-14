"""
StatScope Reddit Analyst Bot

Posts daily MLB prediction picks as natural-sounding analysis
in r/sportsbook MLB Daily Discussion threads.

Designed to look like a real sports analyst, not a bot:
- Rotates writing styles daily
- Uses casual first-person language
- Tracks pick history for accountability
- No links for first 2 weeks (builds credibility)
- Gradually introduces "my model" / "StatScope"

Usage:
  python reddit_bot.py post          # Post today's picks
  python reddit_bot.py post --dry-run # Preview without posting
  python reddit_bot.py results       # Post yesterday's results
  python reddit_bot.py results --dry-run

Requires env vars:
  REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET,
  REDDIT_USERNAME, REDDIT_PASSWORD
"""

import argparse
import json
import math
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

# ─── Config ────────────────────────────────────────────────

REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")
REDDIT_USERNAME = os.getenv("REDDIT_USERNAME", "")
REDDIT_PASSWORD = os.getenv("REDDIT_PASSWORD", "")
REDDIT_USER_AGENT = f"StatScopeAnalyst/1.0 by /u/{REDDIT_USERNAME}"

SUBREDDIT = "sportsbook"
STATSCOPE_URL = os.getenv("STATSCOPE_URL", "https://statscope-eta.vercel.app")
HISTORY_FILE = Path(__file__).parent / ".reddit_pick_history.json"
MLB = "https://statsapi.mlb.com/api/v1"

# After this many days, start mentioning StatScope
CREDIBILITY_DAYS = 14

# ─── Timezone ──────────────────────────────────────────────

ET = timezone(timedelta(hours=-4))

def now_et():
    return datetime.now(ET)

# ─── Prediction Model v2.2 (same as Bluesky bot) ──────────

LE = 4.0; LW = 0.315; PX = 1.83
K = {"SI":0.0264,"BI":0.0024,"LI":0.064,"PI":0.024,"RW":0.30,"RF":0.22,"HA":0.066}
PKF = {108:0.97,109:1.05,110:1.04,111:1.08,112:1.05,113:1.10,114:0.98,115:1.35,
       116:0.97,117:1.02,118:0.99,119:0.98,120:1.00,121:0.95,133:1.00,134:0.94,
       135:0.94,136:0.96,137:0.93,138:0.98,139:0.95,140:1.00,141:1.04,142:1.01,
       143:1.06,144:1.00,145:1.07,146:0.92,147:1.06,158:1.03}

TEAM_SHORT = {
    108:"LAA",109:"ARI",110:"BAL",111:"BOS",112:"CHC",113:"CIN",114:"CLE",
    115:"COL",116:"DET",117:"HOU",118:"KC",119:"LAD",120:"WSH",121:"NYM",
    133:"OAK",134:"PIT",135:"SD",136:"SEA",137:"SF",138:"STL",139:"TB",
    140:"TEX",141:"TOR",142:"MIN",143:"PHI",144:"ATL",145:"CWS",146:"MIA",
    147:"NYY",158:"MIL"
}

def cl(v,lo,hi): return max(lo,min(hi,v))
def pyth(rs,ra):
    if rs<=0 and ra<=0: return 0.5
    a=pow(max(rs,0),PX); b=pow(max(ra,0),PX)
    return a/(a+b) if a+b>0 else 0.5
def l5(a,b):
    d=a+b-2*a*b; return (a-a*b)/d if d!=0 else 0.5
def mline(p):
    if p>=0.5: return str(round(-(p/(1-p))*100))
    return "+"+str(round(((1-p)/p)*100))


def run_predictions():
    """Run model on today's games, return sorted results."""
    sd = requests.get(f"{MLB}/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason&hydrate=team").json()
    tms = {}
    for rec in sd.get("records",[]):
        for tr in rec.get("teamRecords",[]):
            l10 = next((r for r in tr.get("records",{}).get("splitRecords",[]) if r["type"]=="lastTen"), None)
            tms[tr["team"]["id"]] = {"w":tr["wins"],"l":tr["losses"],"rs":tr["runsScored"],"ra":tr["runsAllowed"],
                "l10w":l10["wins"] if l10 else 5,"l10l":l10["losses"] if l10 else 5,"era":0.0,"woba":0.0}

    for sp in requests.get(f"{MLB}/teams/stats?stats=season&group=pitching&sportId=1&season=2026").json().get("stats",[{}])[0].get("splits",[]):
        if sp["team"]["id"] in tms: tms[sp["team"]["id"]]["era"] = float(sp["stat"].get("era","0") or 0)
    for sp in requests.get(f"{MLB}/teams/stats?stats=season&group=hitting&sportId=1&season=2026").json().get("stats",[{}])[0].get("splits",[]):
        tid=sp["team"]["id"]
        if tid not in tms: continue
        s=sp["stat"]; sin=s.get("hits",0)-s.get("doubles",0)-s.get("triples",0)-s.get("homeRuns",0)
        den=s.get("atBats",0)+s.get("baseOnBalls",0)-s.get("intentionalWalks",0)+s.get("sacFlies",0)+s.get("hitByPitch",0)
        if den>0: tms[tid]["woba"]=(0.69*(s.get("baseOnBalls",0)-s.get("intentionalWalks",0))+0.72*s.get("hitByPitch",0)+0.88*sin+1.27*s.get("doubles",0)+1.62*s.get("triples",0)+2.1*s.get("homeRuns",0))/den

    today = now_et().strftime("%Y-%m-%d")
    gd = requests.get(f"{MLB}/schedule?sportId=1&date={today}&hydrate=probablePitcher,team&gameType=R").json()
    games = []
    for d in gd.get("dates",[]):
        for g in d.get("games",[]):
            if g["status"]["abstractGameState"] != "Preview": continue
            h=g["teams"]["home"]; a=g["teams"]["away"]
            games.append({"an":a["team"]["name"],"hn":h["team"]["name"],"ai":a["team"]["id"],"hi":h["team"]["id"],
                "ap":a.get("probablePitcher",{}).get("fullName","TBD"),"api":a.get("probablePitcher",{}).get("id",0),
                "hp":h.get("probablePitcher",{}).get("fullName","TBD"),"hpi":h.get("probablePitcher",{}).get("id",0)})

    pids=set()
    for g in games:
        if g["api"]: pids.add(g["api"])
        if g["hpi"]: pids.add(g["hpi"])
    ptch={}
    for pid in pids:
        if pid==0: continue
        try:
            pd=requests.get(f"{MLB}/people/{pid}?hydrate=stats(group=[pitching],type=[season],season=2026)").json()
            st=pd["people"][0]["stats"][0]["splits"][0]["stat"]
            ip_raw=float(st.get("inningsPitched","0") or 0)
            ip=int(ip_raw)+round((ip_raw-int(ip_raw))*10)/3
            fip_ip=ip if ip>0 else 1
            fip=(13*st.get("homeRuns",0)+3*(st.get("baseOnBalls",0)+st.get("hitByPitch",0))-2*st.get("strikeOuts",0))/fip_ip+3.1
            ptch[pid]={"era":float(st.get("era","0") or 0),"fip":max(0,round(fip,2)),"ip":round(ip,1)}
        except: pass

    results = []
    for g in games:
        ht=tms.get(g["hi"]); at=tms.get(g["ai"])
        if not ht or not at: continue
        hp=ptch.get(g["hpi"]); ap=ptch.get(g["api"])
        pf=PKF.get(g["hi"],1.0)
        hPy=pyth(ht["rs"],ht["ra"]); aPy=pyth(at["rs"],at["ra"])
        hm=hp["fip"] if hp and hp["fip"]>0 else LE; am=ap["fip"] if ap and ap["fip"]>0 else LE
        hip=hp["ip"] if hp else 0; aip=ap["ip"] if ap else 0
        hSA=(LE-hm)*K["SI"]*min(1,hip/50); aSA=(LE-am)*K["SI"]*min(1,aip/50)
        hB=(LE-ht["era"])*K["BI"] if ht["era"]>0 else 0; aB=(LE-at["era"])*K["BI"] if at["era"]>0 else 0
        hL=((ht["woba"]-LW)/LW)*K["LI"] if ht["woba"]>0 else 0; aL=((at["woba"]-LW)/LW)*K["LI"] if at["woba"]>0 else 0
        hA=cl(hPy+(hSA-aSA)+(hB-aB)+(hL-aL),0.25,0.75); aA=cl(aPy+(aSA-hSA)+(aB-hB)+(aL-hL),0.25,0.75)
        hR=ht["l10w"]/(ht["l10w"]+ht["l10l"]) if (ht["l10w"]+ht["l10l"])>0 else 0.5
        aR=at["l10w"]/(at["l10w"]+at["l10l"]) if (at["l10w"]+at["l10l"])>0 else 0.5
        hBl=hA*(1-K["RW"])+hR*K["RW"]; aBl=aA*(1-K["RW"])+aR*K["RW"]
        prob=l5(hBl,aBl)+K["HA"]
        hW=ht["woba"] or LW; aW=at["woba"] or LW
        prob+=(pf-1.0)*((hW-aW)/LW)*K["PI"]
        prob=prob*(1-K["RF"])+0.5*K["RF"]; prob=cl(prob,0.2,0.8)
        hG=ht["w"]+ht["l"] or 1; aG=at["w"]+at["l"] or 1
        hRn=(ht["rs"]/hG)*(am/LE*0.6+(at["era"]/LE if at["era"]>0 else 1)*0.4)*pf
        aRn=(at["rs"]/aG)*(hm/LE*0.6+(ht["era"]/LE if ht["era"]>0 else 1)*0.4)*pf
        hE=round((hRn*0.85+4.5*0.15)*10)/10; aE=round((aRn*0.85+4.5*0.15)*10)/10
        tot=round((hE+aE)*2)/2; margin=round((hE-aE)*10)/10
        results.append({"an":g["an"],"hn":g["hn"],"ai":g["ai"],"hi":g["hi"],
            "ap":g["ap"],"hp":g["hp"],"hW":round(prob*100,1),"aW":round((1-prob)*100,1),
            "hML":mline(prob),"aML":mline(1-prob),"tot":tot,"hE":hE,"aE":aE,
            "margin":margin,"edge":abs(prob-0.5),"covers":abs(margin)>=1.5,
            "hERA":hp["era"] if hp else 0,"aERA":ap["era"] if ap else 0,
            "hFIP":hp["fip"] if hp else 0,"aFIP":ap["fip"] if ap else 0,
            "hL10":f"{ht['l10w']}-{ht['l10l']}","aL10":f"{at['l10w']}-{at['l10l']}",
            "pf":pf})

    results.sort(key=lambda x: x["edge"], reverse=True)
    return results[:3]


# ─── Pick History ──────────────────────────────────────────

def load_history():
    if HISTORY_FILE.exists():
        return json.loads(HISTORY_FILE.read_text())
    return {"picks": [], "record": {"w": 0, "l": 0}, "start_date": now_et().strftime("%Y-%m-%d")}

def save_history(h):
    HISTORY_FILE.write_text(json.dumps(h, indent=2))

def save_today_picks(picks):
    h = load_history()
    today = now_et().strftime("%Y-%m-%d")
    entry = {"date": today, "picks": [], "checked": False}
    for p in picks:
        fav = p["hn"] if p["hW"] > 50 else p["an"]
        fav_id = p["hi"] if p["hW"] > 50 else p["ai"]
        entry["picks"].append({
            "fav": fav, "fav_id": fav_id,
            "home_id": p["hi"], "away_id": p["ai"],
            "home": p["hn"], "away": p["an"],
            "prob": max(p["hW"], p["aW"]),
            "ml": p["hML"] if p["hW"] > 50 else p["aML"],
            "ou_line": p["tot"], "ou_lean": "over" if (p["hE"]+p["aE"]) > p["tot"] + 0.25 else "under" if (p["hE"]+p["aE"]) < p["tot"] - 0.25 else "push",
            "result": None
        })
    # Remove existing entry for today
    h["picks"] = [e for e in h["picks"] if e["date"] != today]
    h["picks"].append(entry)
    save_history(h)


def check_yesterday_results():
    """Check yesterday's pick results and update record."""
    h = load_history()
    yesterday = (now_et() - timedelta(days=1)).strftime("%Y-%m-%d")
    entry = next((e for e in h["picks"] if e["date"] == yesterday and not e["checked"]), None)
    if not entry:
        return None

    # Fetch yesterday's scores
    sched = requests.get(f"{MLB}/schedule?sportId=1&date={yesterday}&hydrate=linescore&gameType=R").json()
    scores = {}
    for d in sched.get("dates",[]):
        for g in d.get("games",[]):
            if g["status"]["abstractGameState"] != "Final": continue
            hid = g["teams"]["home"]["team"]["id"]
            aid = g["teams"]["away"]["team"]["id"]
            hs = g["teams"]["home"].get("score", 0)
            as_ = g["teams"]["away"].get("score", 0)
            scores[(hid, aid)] = {"home_score": hs, "away_score": as_, "total": hs + as_}

    wins = 0; losses = 0
    for pick in entry["picks"]:
        key = (pick["home_id"], pick["away_id"])
        if key not in scores:
            pick["result"] = "no_result"
            continue
        sc = scores[key]
        home_won = sc["home_score"] > sc["away_score"]
        fav_is_home = pick["fav_id"] == pick["home_id"]
        if (fav_is_home and home_won) or (not fav_is_home and not home_won):
            pick["result"] = "W"
            wins += 1
        else:
            pick["result"] = "L"
            losses += 1
        pick["final_score"] = f"{sc['away_score']}-{sc['home_score']}"

    entry["checked"] = True
    h["record"]["w"] += wins
    h["record"]["l"] += losses
    save_history(h)
    return {"date": yesterday, "picks": entry["picks"], "day_record": f"{wins}-{losses}",
            "season_record": f"{h['record']['w']}-{h['record']['l']}"}


# ─── Natural Language Generation ───────────────────────────

OPENERS = [
    "Ran my numbers this morning, here's what I like on today's slate:",
    "Three spots where I see the most edge today:",
    "Model is showing some clean edges today. Here are my top plays:",
    "Did my homework on tonight's matchups. These three stood out:",
    "Broke down every game today, three plays I feel best about:",
    "Crunched the Pythagorean numbers and pitching matchups. Best bets:",
    "Today's board has a few spots I really like. Top 3 confidence plays:",
    "Spent the morning running FIP-adjusted projections. Locking in these:",
]

def gen_pick_text(p, num):
    """Generate a natural-sounding analysis for one pick."""
    fav = p["hn"] if p["hW"] > 50 else p["an"]
    dog = p["an"] if p["hW"] > 50 else p["hn"]
    fav_short = TEAM_SHORT.get(p["hi"] if p["hW"] > 50 else p["ai"], fav)
    dog_short = TEAM_SHORT.get(p["ai"] if p["hW"] > 50 else p["hi"], dog)
    fav_pct = max(p["hW"], p["aW"])
    fav_ml = p["hML"] if p["hW"] > 50 else p["aML"]
    is_home = p["hW"] > 50
    fav_era = p["hERA"] if is_home else p["aERA"]
    fav_fip = p["hFIP"] if is_home else p["aFIP"]
    dog_era = p["aERA"] if is_home else p["hERA"]
    dog_fip = p["aFIP"] if is_home else p["hFIP"]
    fav_pitcher = p["hp"] if is_home else p["ap"]
    dog_pitcher = p["ap"] if is_home else p["hp"]
    fav_l10 = p["hL10"] if is_home else p["aL10"]
    margin_s = f"+{p['margin']}" if p['margin'] > 0 else str(p['margin'])
    ou = "over" if (p["hE"]+p["aE"]) > p["tot"] + 0.25 else "under" if (p["hE"]+p["aE"]) < p["tot"] - 0.25 else None

    # Vary reasoning style
    templates = []

    # Template A: Pitching matchup focused
    t = f"**{fav_short} ML ({fav_ml})**"
    if fav_era > 0 and fav_era < 3.5:
        t += f" — {fav_pitcher} has been dealing ({fav_era:.2f} ERA, {fav_fip:.2f} FIP)."
    elif dog_era > 5:
        t += f" — Fading {dog_pitcher} here ({dog_era:.2f} ERA, {dog_fip:.2f} FIP). That's ugly."
    else:
        t += f" — {fav_pitcher} ({fav_era:.2f} ERA) vs {dog_pitcher} ({dog_era:.2f} ERA). Clear pitching edge."

    t += f" {fav_short} has been {fav_l10} in last 10."

    if p["covers"]:
        t += f" Like the -1.5 too (projected margin {margin_s})."
    if ou:
        t += f" Leaning {ou} {p['tot']} (projected {round(p['hE']+p['aE'],1)} total runs)."
    if p["pf"] >= 1.08:
        t += " Hitter-friendly park bumps the total."
    elif p["pf"] <= 0.94:
        t += " Pitcher's park keeps this low."

    t += f" Model confidence: {fav_pct:.0f}%."
    templates.append(t)

    return templates[0]


def format_reddit_comment(picks, record_str=None):
    """Format a full Reddit comment with all picks."""
    opener = random.choice(OPENERS)
    lines = [opener, ""]

    for i, p in enumerate(picks):
        lines.append(gen_pick_text(p, i + 1))
        lines.append("")

    # Add record if available
    if record_str:
        lines.append(f"Season record: **{record_str}**")
        lines.append("")

    lines.append("BOL if tailing 🤝")

    # Check if we should mention StatScope (after credibility period)
    h = load_history()
    start = h.get("start_date", now_et().strftime("%Y-%m-%d"))
    days_active = (now_et() - datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=ET)).days
    if days_active >= CREDIBILITY_DAYS:
        lines.append("")
        lines.append(f"*All projections from my model at {STATSCOPE_URL}*")

    return "\n".join(lines)


# ─── Reddit Posting ────────────────────────────────────────

def find_mlb_daily_thread():
    """Find today's MLB Daily Discussion thread in r/sportsbook."""
    import praw

    reddit = praw.Reddit(
        client_id=REDDIT_CLIENT_ID,
        client_secret=REDDIT_CLIENT_SECRET,
        username=REDDIT_USERNAME,
        password=REDDIT_PASSWORD,
        user_agent=REDDIT_USER_AGENT,
    )

    sub = reddit.subreddit(SUBREDDIT)
    today_str = now_et().strftime("%m/%d/%y")
    today_str2 = now_et().strftime("%B %d, %Y")
    today_str3 = now_et().strftime("%m/%d")

    # Search recent hot posts for MLB daily thread
    for post in sub.hot(limit=30):
        title_lower = post.title.lower()
        if "mlb" in title_lower and ("daily" in title_lower or "discussion" in title_lower):
            # Check if it's today's thread
            if today_str in post.title or today_str2 in post.title or today_str3 in post.title:
                return reddit, post

    # Fallback: search by new
    for post in sub.new(limit=50):
        title_lower = post.title.lower()
        if "mlb" in title_lower and ("daily" in title_lower or "discussion" in title_lower):
            if today_str in post.title or today_str2 in post.title or today_str3 in post.title:
                return reddit, post

    return None, None


def post_to_reddit(comment_text, dry_run=False):
    """Post comment to r/sportsbook MLB Daily Discussion."""
    print("-" * 50)
    sys.stdout.buffer.write(comment_text.encode("utf-8", errors="replace"))
    sys.stdout.buffer.write(b"\n")
    sys.stdout.flush()
    print("-" * 50)
    print(f"Length: {len(comment_text)} chars")

    if dry_run:
        print("\n[DRY RUN] Not posted to Reddit.")
        return True

    if not all([REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD]):
        print("\n[ERROR] Reddit credentials not set. Need:")
        print("  REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET,")
        print("  REDDIT_USERNAME, REDDIT_PASSWORD")
        return False

    try:
        reddit, thread = find_mlb_daily_thread()
        if not thread:
            print("\n[WARN] Could not find today's MLB Daily Discussion thread.")
            print("  Will try r/sportsbook daily thread instead...")
            # Try general daily thread
            import praw
            reddit = praw.Reddit(
                client_id=REDDIT_CLIENT_ID,
                client_secret=REDDIT_CLIENT_SECRET,
                username=REDDIT_USERNAME,
                password=REDDIT_PASSWORD,
                user_agent=REDDIT_USER_AGENT,
            )
            sub = reddit.subreddit(SUBREDDIT)
            for post in sub.hot(limit=15):
                if "mlb" in post.title.lower():
                    thread = post
                    break

        if not thread:
            print("[ERROR] No suitable thread found.")
            return False

        comment = thread.reply(comment_text)
        print(f"\n✅ Posted to Reddit!")
        print(f"   Thread: {thread.title}")
        print(f"   URL: https://reddit.com{comment.permalink}")
        return True

    except Exception as e:
        print(f"\n[ERROR] Reddit post failed: {e}")
        import traceback
        traceback.print_exc()
        return False


# ─── Commands ──────────────────────────────────────────────

def cmd_post(dry_run):
    """Generate and post today's picks."""
    print("Running predictions...")
    picks = run_predictions()
    if not picks:
        print("No picks available today.")
        return

    save_today_picks(picks)

    h = load_history()
    rec = f"{h['record']['w']}-{h['record']['l']}" if h["record"]["w"] + h["record"]["l"] > 0 else None

    comment = format_reddit_comment(picks, rec)
    post_to_reddit(comment, dry_run)


def cmd_results(dry_run):
    """Check and optionally post yesterday's results."""
    result = check_yesterday_results()
    if not result:
        print("No unchecked picks from yesterday.")
        return

    lines = [f"Yesterday's picks ({result['date']}): **{result['day_record']}**", ""]
    for p in result["picks"]:
        emoji = "✅" if p["result"] == "W" else "❌" if p["result"] == "L" else "⏳"
        score = f" ({p.get('final_score', 'N/A')})" if p.get("final_score") else ""
        lines.append(f"{emoji} {p['fav']} ML{score}")

    lines.append(f"\nSeason: **{result['season_record']}**")
    text = "\n".join(lines)

    print(text)
    if not dry_run:
        print("\n[INFO] Results tracked. Post manually if desired.")


def main():
    parser = argparse.ArgumentParser(description="StatScope Reddit Analyst Bot")
    parser.add_argument("command", choices=["post", "results"], help="Command")
    parser.add_argument("--dry-run", "-d", action="store_true", help="Preview without posting")
    args = parser.parse_args()

    print(f"=== StatScope Reddit Bot ===")
    print(f"Command: {args.command} {'(dry run)' if args.dry_run else ''}")
    print(f"ET Time: {now_et().strftime('%Y-%m-%d %I:%M %p ET')}\n")

    if args.command == "post":
        cmd_post(args.dry_run)
    elif args.command == "results":
        cmd_results(args.dry_run)


if __name__ == "__main__":
    main()
