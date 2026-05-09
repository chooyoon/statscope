"""StatScope Model v2.3 Enhanced - 9-factor model + pybaseball (xFIP, SIERA, SwStr%, Statcast)"""
import json
import math
import urllib.request
from datetime import datetime, timedelta
import sys

def fetch(url):
    """Fetch JSON from MLB Stats API"""
    try:
        with urllib.request.urlopen(url) as res:
            return json.loads(res.read())
    except Exception as e:
        print(f"[WARN] fetch({url[:50]}...) failed: {e}", file=sys.stderr)
        return {}

def base_model(date="2026-04-15", season=2026):
    """
    Encapsulate StatScope Model v2.2 logic.
    Returns dict with 'games' (list of base predictions) and 'teams', 'pitchers' metadata.
    """
    # 1. Standings
    sd = fetch(f"https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season={season}&standingsTypes=regularSeason&hydrate=team")
    teams = {}
    for rec in sd.get("records", []):
        for tr in rec.get("teamRecords", []):
            l10 = next((r for r in tr.get("records", {}).get("splitRecords", []) if r["type"] == "lastTen"), None)
            teams[tr["team"]["id"]] = {
                "w": tr["wins"], "l": tr["losses"],
                "rs": tr["runsScored"], "ra": tr["runsAllowed"],
                "l10w": l10["wins"] if l10 else 5, "l10l": l10["losses"] if l10 else 5,
                "era": 0.0, "woba": 0.0
            }

    # 2. Team stats
    hitting = fetch(f"https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=hitting&sportId=1&season={season}")
    pitching = fetch(f"https://statsapi.mlb.com/api/v1/teams/stats?stats=season&group=pitching&sportId=1&season={season}")
    for sp in pitching.get("stats", [{}])[0].get("splits", []):
        tid = sp["team"]["id"]
        if tid in teams:
            teams[tid]["era"] = float(sp["stat"].get("era", "0") or 0)
    for sp in hitting.get("stats", [{}])[0].get("splits", []):
        tid = sp["team"]["id"]
        if tid not in teams:
            continue
        s = sp["stat"]
        singles = s.get("hits", 0) - s.get("doubles", 0) - s.get("triples", 0) - s.get("homeRuns", 0)
        denom = s.get("atBats", 0) + s.get("baseOnBalls", 0) - s.get("intentionalWalks", 0) + s.get("sacFlies", 0) + s.get("hitByPitch", 0)
        if denom > 0:
            teams[tid]["woba"] = (0.69 * (s.get("baseOnBalls", 0) - s.get("intentionalWalks", 0)) + 0.72 * s.get("hitByPitch", 0) + 0.88 * singles + 1.27 * s.get("doubles", 0) + 1.62 * s.get("triples", 0) + 2.1 * s.get("homeRuns", 0)) / denom

    # 3. Games
    gd = fetch(f"https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={date}&hydrate=probablePitcher,team&gameType=R")
    games = []
    for d in gd.get("dates", []):
        for g in d.get("games", []):
            h = g["teams"]["home"]
            a = g["teams"]["away"]
            games.append({
                "pk": g["gamePk"],
                "an": a["team"]["name"], "hn": h["team"]["name"],
                "ai": a["team"]["id"], "hi": h["team"]["id"],
                "ap": a.get("probablePitcher", {}).get("fullName", "TBD"),
                "api": a.get("probablePitcher", {}).get("id", 0),
                "hp": h.get("probablePitcher", {}).get("fullName", "TBD"),
                "hpi": h.get("probablePitcher", {}).get("id", 0)
            })

    # 4. Pitcher stats
    pids = set()
    for g in games:
        if g["api"]:
            pids.add(g["api"])
        if g["hpi"]:
            pids.add(g["hpi"])
    pitchers = {}
    for pid in pids:
        if pid == 0:
            continue
        try:
            pd = fetch(f"https://statsapi.mlb.com/api/v1/people/{pid}?hydrate=stats(group=[pitching],type=[season],season={season})")
            st = pd["people"][0]["stats"][0]["splits"][0]["stat"]
            ip_raw = float(st.get("inningsPitched", "0") or 0)
            ip = int(ip_raw) + round((ip_raw - int(ip_raw)) * 10) / 3
            fip_ip = ip if ip > 0 else 1
            fip = (13 * st.get("homeRuns", 0) + 3 * (st.get("baseOnBalls", 0) + st.get("hitByPitch", 0)) - 2 * st.get("strikeOuts", 0)) / fip_ip + 3.1
            pitchers[pid] = {
                "era": float(st.get("era", "0") or 0),
                "fip": max(0, round(fip, 2)),
                "whip": float(st.get("whip", "0") or 0),
                "ip": round(ip, 1),
                "name": pd["people"][0].get("fullName", ""),
                "key_mlbam": pd["people"][0].get("id", 0)
            }
        except:
            pass

    # 5. Model v2.2
    C = {"SI": 0.0264, "BI": 0.0024, "LI": 0.064, "PI": 0.024, "RW": 0.30, "RF": 0.22, "HA": 0.066}
    LE = 4.0
    LW = 0.315
    PX = 1.83
    PF = {108: 0.97, 109: 1.05, 110: 1.04, 111: 1.08, 112: 1.05, 113: 1.10, 114: 0.98, 115: 1.35, 116: 0.97, 117: 1.02, 118: 0.99, 119: 0.98, 120: 1.00, 121: 0.95, 133: 1.00, 134: 0.94, 135: 0.94, 136: 0.96, 137: 0.93, 138: 0.98, 139: 0.95, 140: 1.00, 141: 1.04, 142: 1.01, 143: 1.06, 144: 1.00, 145: 1.07, 146: 0.92, 147: 1.06, 158: 1.03}

    def cl(v, lo, hi):
        return max(lo, min(hi, v))

    def py(rs, ra):
        if rs <= 0 and ra <= 0:
            return 0.5
        a = pow(max(rs, 0), PX)
        b = pow(max(ra, 0), PX)
        return a / (a + b) if a + b > 0 else 0.5

    def l5(a, b):
        d = a + b - 2 * a * b
        return (a - a * b) / d if d != 0 else 0.5

    def ml(p):
        if p >= 0.5:
            return str(round(-(p / (1 - p)) * 100))
        return "+" + str(round(((1 - p) / p) * 100))

    results = []
    for g in games:
        ht = teams.get(g["hi"], {})
        at = teams.get(g["ai"], {})
        if not ht or not at:
            continue
        hp = pitchers.get(g["hpi"])
        ap = pitchers.get(g["api"])
        pf = PF.get(g["hi"], 1.0)
        hPy = py(ht["rs"], ht["ra"])
        aPy = py(at["rs"], at["ra"])
        hm = hp["fip"] if hp and hp["fip"] > 0 else LE
        am = ap["fip"] if ap and ap["fip"] > 0 else LE
        hip = hp["ip"] if hp else 0
        aip = ap["ip"] if ap else 0
        hSA = (LE - hm) * C["SI"] * min(1, hip / 50)
        aSA = (LE - am) * C["SI"] * min(1, aip / 50)
        hB = (LE - ht["era"]) * C["BI"] if ht["era"] > 0 else 0
        aB = (LE - at["era"]) * C["BI"] if at["era"] > 0 else 0
        hL = ((ht["woba"] - LW) / LW) * C["LI"] if ht["woba"] > 0 else 0
        aL = ((at["woba"] - LW) / LW) * C["LI"] if at["woba"] > 0 else 0
        hA = cl(hPy + (hSA - aSA) + (hB - aB) + (hL - aL), 0.25, 0.75)
        aA = cl(aPy + (aSA - hSA) + (aB - hB) + (aL - hL), 0.25, 0.75)
        hR = ht["l10w"] / (ht["l10w"] + ht["l10l"]) if (ht["l10w"] + ht["l10l"]) > 0 else 0.5
        aR = at["l10w"] / (at["l10w"] + at["l10l"]) if (at["l10w"] + at["l10l"]) > 0 else 0.5
        hBl = hA * (1 - C["RW"]) + hR * C["RW"]
        aBl = aA * (1 - C["RW"]) + aR * C["RW"]
        prob = l5(hBl, aBl) + C["HA"]
        hW = ht["woba"] or LW
        aW = at["woba"] or LW
        prob += (pf - 1.0) * ((hW - aW) / LW) * C["PI"]
        prob = prob * (1 - C["RF"]) + 0.5 * C["RF"]
        prob = cl(prob, 0.2, 0.8)

        # O/U
        hG = ht["w"] + ht["l"] or 1
        aG = at["w"] + at["l"] or 1
        hRPG = ht["rs"] / hG
        aRPG = at["rs"] / aG
        hOA = am / LE
        aOA = hm / LE
        hBA = at["era"] / LE if at["era"] > 0 else 1
        aBA = ht["era"] / LE if ht["era"] > 0 else 1
        hRn = hRPG * (hOA * 0.6 + hBA * 0.4) * pf
        aRn = aRPG * (aOA * 0.6 + aBA * 0.4) * pf
        hE = round((hRn * 0.85 + 4.5 * 0.15) * 10) / 10
        aE = round((aRn * 0.85 + 4.5 * 0.15) * 10) / 10
        tot = round((hE + aE) * 2) / 2
        margin = round((hE - aE) * 10) / 10
        edge = abs(prob - 0.5)

        results.append({
            "game_id": f"{g['an'][:3].upper()}@{g['hn'][:3].upper()}",
            "pk": g["pk"],
            "an": g["an"], "hn": g["hn"],
            "ai": g["ai"], "hi": g["hi"],
            "ap": g["ap"], "hp": g["hp"],
            "api": g["api"], "hpi": g["hpi"],
            "hW": round(prob * 100, 1), "aW": round((1 - prob) * 100, 1),
            "hML": ml(prob), "aML": ml(1 - prob),
            "tot": tot, "hE": hE, "aE": aE,
            "margin": margin, "edge": edge,
            "hPy": round(hPy * 100, 1), "aPy": round(aPy * 100, 1),
            "hERA": hp["era"] if hp else 0, "aERA": ap["era"] if ap else 0,
            "hFIP": hp["fip"] if hp else 0, "aFIP": ap["fip"] if ap else 0,
            "hL10": f"{ht['l10w']}-{ht['l10l']}", "aL10": f"{at['l10w']}-{at['l10l']}",
            "pf": pf,
            "hRec": f"{ht['w']}-{ht['l']}", "aRec": f"{at['w']}-{at['l']}",
            "covers": abs(margin) >= 1.5
        })

    return {"games": results, "teams": teams, "pitchers": pitchers}

def fetch_fangraphs_pitchers(season=2026):
    """
    Fetch FanGraphs pitcher stats (xFIP, SIERA, SwStr%, GB%) from pybaseball.
    Returns dict keyed by pitcher name with stats, or empty dict if pybaseball unavailable.
    """
    try:
        import pybaseball
        print("[INFO] Fetching FanGraphs data via pybaseball...", file=sys.stderr)

        # Enable cache for faster subsequent runs
        pybaseball.cache.enable()

        # Fetch current season pitching stats (includes xFIP, SIERA, SwStr%, GB%)
        stats_df = pybaseball.pitching_stats(start_season=season, end_season=season)

        result = {}
        if stats_df is not None and not stats_df.empty:
            for _, row in stats_df.iterrows():
                name = row.get("Name", "")
                if name and name != "Name":  # Skip header rows
                    result[name.strip()] = {
                        "xFIP": float(row.get("xFIP", 0)) if row.get("xFIP", 0) else None,
                        "SIERA": float(row.get("SIERA", 0)) if row.get("SIERA", 0) else None,
                        "swstr_pct": float(row.get("SwStr%", 0)) if row.get("SwStr%", 0) else None,
                        "gb_pct": float(row.get("GB%", 0)) if row.get("GB%", 0) else None,
                    }
        print(f"[INFO] Fetched FanGraphs data for {len(result)} pitchers", file=sys.stderr)
        return result
    except ImportError:
        print("[WARN] pybaseball not installed; skipping FanGraphs data", file=sys.stderr)
        return {}
    except Exception as e:
        print(f"[WARN] fetch_fangraphs_pitchers failed: {e}", file=sys.stderr)
        return {}

def fetch_statcast_recent(pitcher_name, season=2026):
    """
    Fetch recent Statcast data for a pitcher (last 3 games).
    Returns dict with avg_ev (exit velocity) and barrel_pct, or empty dict on error.
    """
    try:
        import pybaseball
        print(f"[INFO] Fetching Statcast for {pitcher_name}...", file=sys.stderr)

        pybaseball.cache.enable()

        # Statcast data for pitcher (last N days to get ~3 recent games)
        # end_dt = yesterday to avoid same-day edge cases
        end_dt = datetime.now() - timedelta(days=1)
        start_dt = end_dt - timedelta(days=14)  # 2 weeks back for ~3 games

        sc_df = pybaseball.statcast(
            start_dt=start_dt.strftime("%Y-%m-%d"),
            end_dt=end_dt.strftime("%Y-%m-%d"),
            team=None
        )

        if sc_df is None or sc_df.empty:
            return {}

        # Filter for this pitcher (by name or key_mlbam)
        pitcher_data = sc_df[
            (sc_df["pitcher_name"].str.contains(pitcher_name, case=False, na=False, regex=False)) |
            (sc_df["player_name"].str.contains(pitcher_name, case=False, na=False, regex=False))
        ]

        if pitcher_data.empty:
            return {}

        # Calculate metrics
        exit_velocities = pitcher_data["launch_speed"].dropna()
        barrels = pitcher_data["launch_angle"].fillna(0)

        # Barrel: 95+ mph EV and 26-30° launch angle (simplified)
        barrel_mask = (pitcher_data["launch_speed"] >= 95) & (pitcher_data["launch_angle"].between(26, 30))
        barrel_count = barrel_mask.sum()

        avg_ev = float(exit_velocities.mean()) if len(exit_velocities) > 0 else 0
        barrel_pct = (barrel_count / len(pitcher_data) * 100) if len(pitcher_data) > 0 else 0

        return {
            "avg_ev": round(avg_ev, 1),
            "barrel_pct": round(barrel_pct, 1),
            "pitches_count": len(pitcher_data)
        }
    except ImportError:
        print("[WARN] pybaseball not installed; skipping Statcast data", file=sys.stderr)
        return {}
    except Exception as e:
        print(f"[WARN] fetch_statcast_recent({pitcher_name}) failed: {e}", file=sys.stderr)
        return {}

def quality_bonus(fip, xfip, siera):
    """
    Bonus if xFIP/SIERA suggest pitcher is underperforming (lucky) vs FIP.
    Clamp ±0.025 to prevent over-adjustment.
    """
    if not (fip and xfip and siera):
        return 0.0
    try:
        fip_f = float(fip)
        xfip_f = float(xfip)
        siera_f = float(siera)

        # If xFIP/SIERA >> FIP, pitcher is "lucky" → downward bonus (negative for hitter, positive for pitcher)
        avg_expected = (xfip_f + siera_f) / 2
        divergence = fip_f - avg_expected

        # Clamp to ±0.025
        bonus = max(-0.025, min(0.025, divergence * 0.02))
        return bonus
    except:
        return 0.0

def swstr_bonus(swstr_pct):
    """
    Bonus if SwStr% is above league average (~11%).
    Clamp ±0.03 to prevent over-weighting.
    """
    if swstr_pct is None:
        return 0.0
    try:
        swstr_f = float(swstr_pct)
        league_avg = 11.0

        # Above league avg → positive bonus for pitcher (negative for hitter)
        divergence = (swstr_f - league_avg) / league_avg

        # Clamp to ±0.03
        bonus = max(-0.03, min(0.03, divergence * 0.05))
        return bonus
    except:
        return 0.0

def form_bonus(recent_stats):
    """
    Bonus based on recent Statcast form (exit velocity, barrel rate).
    Compares to league averages.
    """
    if not recent_stats or recent_stats.get("pitches_count", 0) < 10:
        return 0.0
    try:
        avg_ev = recent_stats.get("avg_ev", 0)
        barrel_pct = recent_stats.get("barrel_pct", 0)

        # League avg EV allowed ~87 mph, barrel% ~8%
        ev_league_avg = 87.0
        barrel_league_avg = 8.0

        # Lower EV allowed is better for pitcher
        ev_bonus = (ev_league_avg - avg_ev) / ev_league_avg * 0.01
        barrel_bonus = (barrel_league_avg - barrel_pct) / barrel_league_avg * 0.02

        form = ev_bonus + barrel_bonus

        # Clamp to ±0.025
        return max(-0.025, min(0.025, form))
    except:
        return 0.0

def apply_enhancements(base_results, fangraphs_data, statcast_cache, season=2026):
    """
    Apply pybaseball enhancements to base model results.
    Adds quality_bonus, swstr_bonus, form_bonus to pitcher evaluations.
    Clamps total adjustments to ±0.05 per pitcher.
    """
    if not base_results or not base_results.get("games"):
        return {"games": [], "pybaseball_available": False}

    pitchers = base_results.get("pitchers", {})
    enhanced_games = []

    for game in base_results["games"]:
        hpi = game.get("hpi", 0)
        api = game.get("api", 0)
        hp = pitchers.get(hpi, {})
        ap = pitchers.get(api, {})

        # Home pitcher enhancements
        h_fg = fangraphs_data.get(hp.get("name", ""), {})
        h_sc = statcast_cache.get(hpi, {})
        h_quality = quality_bonus(hp.get("fip"), h_fg.get("xFIP"), h_fg.get("SIERA"))
        h_swstr = swstr_bonus(h_fg.get("swstr_pct"))
        h_form = form_bonus(h_sc)
        h_total_adj = max(-0.05, min(0.05, h_quality + h_swstr + h_form))

        # Away pitcher enhancements
        a_fg = fangraphs_data.get(ap.get("name", ""), {})
        a_sc = statcast_cache.get(api, {})
        a_quality = quality_bonus(ap.get("fip"), a_fg.get("xFIP"), a_fg.get("SIERA"))
        a_swstr = swstr_bonus(a_fg.get("swstr_pct"))
        a_form = form_bonus(a_sc)
        a_total_adj = max(-0.05, min(0.05, a_quality + a_swstr + a_form))

        # Apply adjustments (positive adjustment favors home pitcher)
        base_prob = game["hW"] / 100.0
        adjusted_prob = cl(base_prob + (h_total_adj - a_total_adj), 0.2, 0.8)

        enhanced_game = dict(game)
        enhanced_game["enhanced"] = {
            "hW": round(adjusted_prob * 100, 1),
            "aW": round((1 - adjusted_prob) * 100, 1),
            "delta": round((adjusted_prob - base_prob) * 100, 1),
            "confidence": "high" if statcast_cache else "medium"
        }
        enhanced_game["pybaseball"] = {
            "home_pitcher": {
                "xFIP": h_fg.get("xFIP"),
                "SIERA": h_fg.get("SIERA"),
                "swstr_pct": h_fg.get("swstr_pct"),
                "quality_bonus": round(h_quality, 4),
                "swstr_bonus": round(h_swstr, 4),
                "form_bonus": round(h_form, 4),
                "recent": h_sc
            },
            "away_pitcher": {
                "xFIP": a_fg.get("xFIP"),
                "SIERA": a_fg.get("SIERA"),
                "swstr_pct": a_fg.get("swstr_pct"),
                "quality_bonus": round(a_quality, 4),
                "swstr_bonus": round(a_swstr, 4),
                "form_bonus": round(a_form, 4),
                "recent": a_sc
            }
        }

        enhanced_games.append(enhanced_game)

    return {"games": enhanced_games, "pybaseball_available": bool(fangraphs_data)}

def cl(v, lo, hi):
    """Clamp value between lo and hi"""
    return max(lo, min(hi, v))

def save_enhanced_picks(enhanced_data, date="2026-04-15", output_file="public/data/enhanced-picks.json"):
    """Save enhanced picks to JSON file"""
    try:
        import os
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        output = {
            "schema_version": 1,
            "model_version": "2.3-enhanced",
            "generated_at": datetime.now().isoformat(),
            "date": date,
            "pybaseball_available": enhanced_data.get("pybaseball_available", False),
            "games": enhanced_data.get("games", [])
        }

        with open(output_file, "w") as f:
            json.dump(output, f, indent=2)

        print(f"[INFO] Saved {len(output['games'])} enhanced picks to {output_file}", file=sys.stderr)
        return output_file
    except Exception as e:
        print(f"[ERROR] Failed to save enhanced picks: {e}", file=sys.stderr)
        return None

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="StatScope Model v2.3 Enhanced")
    parser.add_argument("--date", default="2026-04-15", help="Game date (YYYY-MM-DD)")
    parser.add_argument("--season", type=int, default=2026, help="MLB season")
    parser.add_argument("--output", default="public/data/enhanced-picks.json", help="Output JSON file")
    args = parser.parse_args()

    print(f"[INFO] Running StatScope v2.3 Enhanced for {args.date}...", file=sys.stderr)

    # Step 1: Run base model
    print("[INFO] Running base model (v2.2)...", file=sys.stderr)
    base = base_model(date=args.date, season=args.season)

    # Step 2: Fetch pybaseball data (with fallback)
    print("[INFO] Fetching pybaseball enhancements...", file=sys.stderr)
    fangraphs = fetch_fangraphs_pitchers(season=args.season)

    # Step 3: Fetch Statcast recent data
    statcast_cache = {}
    if fangraphs:
        for pid, pitcher in base.get("pitchers", {}).items():
            name = pitcher.get("name", "")
            if name:
                statcast_cache[pid] = fetch_statcast_recent(name, season=args.season)

    # Step 4: Apply enhancements
    enhanced = apply_enhancements(base, fangraphs, statcast_cache, season=args.season)

    # Step 5: Save results
    output_path = save_enhanced_picks(enhanced, date=args.date, output_file=args.output)

    if output_path:
        print(f"[SUCCESS] Enhanced picks saved to {output_path}", file=sys.stderr)
        sys.exit(0)
    else:
        print("[ERROR] Failed to save enhanced picks", file=sys.stderr)
        sys.exit(1)
