"""
StatScope Bluesky Auto-Posting Bot
====================================
Automatically posts MLB game previews, recaps, and stats to Bluesky.
Optimized for US audience with ET timezone scheduling.

Usage:
    python x_bot.py preview        # Today's game previews with analysis
    python x_bot.py recap          # Game results & highlights
    python x_bot.py leaders        # League leaders
    python x_bot.py korean         # Korean player tracker
    python x_bot.py auto           # Auto-select based on ET time
    python x_bot.py --dry-run ...  # Preview without posting
"""

import argparse
import hashlib
import io
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import requests
import textwrap

# ─── Config ───────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

STATSCOPE_URL = os.getenv("STATSCOPE_URL", "https://statscope-eta.vercel.app")
MLB_API = "https://statsapi.mlb.com/api/v1"

BLUESKY_HANDLE = os.getenv("BLUESKY_HANDLE", "")
BLUESKY_PASSWORD = os.getenv("BLUESKY_PASSWORD", "")

# US Eastern Time (UTC-4 during DST, UTC-5 otherwise)
ET = timezone(timedelta(hours=-4))  # EDT (March-November)

BASE_TAGS = "#MLB #Baseball #StatScope"

# Popular teams get priority in analysis posts (ordered by fanbase/engagement)
POPULAR_TEAMS = {
    "NYY", "LAD", "BOS", "CHC", "ATL",
    "HOU", "PHI", "NYM", "SF", "STL",
    "SD", "SEA", "TEX", "DET", "BAL",
}


def game_popularity(game: dict) -> int:
    """Score a game by how popular the teams are. Higher = more popular."""
    home = abbr(game["teams"]["home"]["team"]["name"])
    away = abbr(game["teams"]["away"]["team"]["name"])
    score = 0
    if home in POPULAR_TEAMS:
        score += 2
    if away in POPULAR_TEAMS:
        score += 2
    # Bonus if both are popular (marquee matchup)
    if home in POPULAR_TEAMS and away in POPULAR_TEAMS:
        score += 3
    return score


# Team hashtags for better discoverability
TEAM_HASHTAGS = {
    "NYY": "#Yankees", "NYM": "#Mets",
    "LAD": "#Dodgers", "LAA": "#Angels",
    "SD": "#Padres", "SF": "#Giants",
    "HOU": "#Astros", "ATL": "#Braves",
    "PHI": "#Phillies", "TEX": "#Rangers",
    "MIN": "#Twins", "PIT": "#Pirates",
    "BOS": "#RedSox", "CHC": "#Cubs",
    "CWS": "#WhiteSox", "TOR": "#BlueJays",
    "BAL": "#Orioles", "TB": "#Rays",
    "SEA": "#Mariners", "CLE": "#Guardians",
    "DET": "#Tigers", "KC": "#Royals",
    "OAK": "#Athletics", "MIL": "#Brewers",
    "STL": "#Cardinals", "CIN": "#Reds",
    "ARI": "#Dbacks", "COL": "#Rockies",
    "MIA": "#Marlins", "WSH": "#Nationals",
}


def team_tags(*team_abbrs: str) -> str:
    """Generate hashtag string with team-specific tags"""
    tags = [TEAM_HASHTAGS.get(t, "") for t in team_abbrs]
    extra = " ".join(t for t in tags if t)
    return f"{BASE_TAGS} {extra}".strip() if extra else BASE_TAGS

# Korean players
KOREAN_PLAYERS = {
    "Hye-seong Kim": {"id": 664285, "team": "MIN", "pos": "2B", "kr": "김혜성"},
    "Jung Hoo Lee": {"id": 808967, "team": "SF", "pos": "OF", "kr": "이정후"},
    "Ji Hwan Bae": {"id": 666166, "team": "PIT", "pos": "IF", "kr": "배지환"},
    "Ha-Seong Kim": {"id": 673490, "team": "SD", "pos": "SS", "kr": "김하성"},
}

# Team abbreviations
TEAM_ABBR = {
    "New York Yankees": "NYY", "New York Mets": "NYM",
    "Los Angeles Dodgers": "LAD", "Los Angeles Angels": "LAA",
    "San Diego Padres": "SD", "San Francisco Giants": "SF",
    "Houston Astros": "HOU", "Atlanta Braves": "ATL",
    "Philadelphia Phillies": "PHI", "Texas Rangers": "TEX",
    "Minnesota Twins": "MIN", "Pittsburgh Pirates": "PIT",
    "Boston Red Sox": "BOS", "Chicago Cubs": "CHC",
    "Chicago White Sox": "CWS", "Toronto Blue Jays": "TOR",
    "Baltimore Orioles": "BAL", "Tampa Bay Rays": "TB",
    "Seattle Mariners": "SEA", "Cleveland Guardians": "CLE",
    "Detroit Tigers": "DET", "Kansas City Royals": "KC",
    "Oakland Athletics": "OAK", "Milwaukee Brewers": "MIL",
    "St. Louis Cardinals": "STL", "Cincinnati Reds": "CIN",
    "Arizona Diamondbacks": "ARI", "Colorado Rockies": "COL",
    "Miami Marlins": "MIA", "Washington Nationals": "WSH",
}


def abbr(name: str) -> str:
    return TEAM_ABBR.get(name, name)


def now_et() -> datetime:
    return datetime.now(ET)


# ─── MLB API ──────────────────────────────────────────────
def fetch_schedule(date_str: str) -> list:
    url = f"{MLB_API}/schedule?date={date_str}&sportId=1&hydrate=team,linescore,decisions,probablePitcher,stats"
    resp = requests.get(url, timeout=10)
    data = resp.json()
    games = []
    for d in data.get("dates", []):
        games.extend(d.get("games", []))
    return games


def fetch_team_record(team_id: int) -> dict:
    url = f"{MLB_API}/teams/{team_id}/stats?stats=season&group=overall&season=2025"
    resp = requests.get(url, timeout=10)
    return resp.json()


def fetch_pitcher_stats(player_id: int) -> dict:
    url = f"{MLB_API}/people/{player_id}?hydrate=stats(group=[pitching],type=season)"
    resp = requests.get(url, timeout=10)
    data = resp.json()
    return data["people"][0] if data.get("people") else {}


def fetch_player_stats(player_id: int) -> dict:
    url = f"{MLB_API}/people/{player_id}?hydrate=stats(group=[hitting,pitching],type=season),currentTeam"
    resp = requests.get(url, timeout=10)
    data = resp.json()
    return data["people"][0] if data.get("people") else {}


def fetch_leaders(category: str, limit: int = 5) -> list:
    url = f"{MLB_API}/stats/leaders?leaderCategories={category}&season=2025&limit={limit}"
    resp = requests.get(url, timeout=10)
    data = resp.json()
    for cat in data.get("leagueLeaders", []):
        return cat.get("leaders", [])
    return []


def fetch_team_standings() -> dict:
    """Get team W-L records"""
    url = f"{MLB_API}/standings?leagueId=103,104&season=2025&standingsTypes=regularSeason"
    resp = requests.get(url, timeout=10)
    data = resp.json()
    records = {}
    for rec in data.get("records", []):
        for team_rec in rec.get("teamRecords", []):
            tid = team_rec["team"]["id"]
            w = team_rec.get("wins", 0)
            l = team_rec.get("losses", 0)
            pct = team_rec.get("winningPercentage", ".000")
            streak = team_rec.get("streak", {}).get("streakCode", "")
            records[tid] = {"w": w, "l": l, "pct": pct, "streak": streak}
    return records


def get_pitcher_line(pitcher: dict) -> str:
    """Get pitcher's season stats one-liner"""
    if not pitcher:
        return ""
    pid = pitcher.get("id")
    name = pitcher.get("fullName", "TBD")
    if not pid:
        return name

    try:
        p = fetch_pitcher_stats(pid)
        for sg in p.get("stats", []):
            splits = sg.get("splits", [])
            if not splits:
                continue
            s = splits[-1].get("stat", {})
            era = s.get("era", "-")
            w = s.get("wins", 0)
            l = s.get("losses", 0)
            so = s.get("strikeOuts", 0)
            whip = s.get("whip", "-")
            return f"{name} ({w}-{l}, {era} ERA, {whip} WHIP)"
    except Exception:
        pass
    return name


# ─── Post Formatters ─────────────────────────────────────
def format_single_preview(game: dict, standings: dict) -> str:
    """Detailed single game preview with analysis"""
    home = game["teams"]["home"]
    away = game["teams"]["away"]
    home_name = home["team"]["name"]
    away_name = away["team"]["name"]
    home_id = home["team"]["id"]
    away_id = away["team"]["id"]

    # Records
    hr = standings.get(home_id, {})
    ar = standings.get(away_id, {})
    home_rec = f"{hr.get('w', 0)}-{hr.get('l', 0)}" if hr else ""
    away_rec = f"{ar.get('w', 0)}-{ar.get('l', 0)}" if ar else ""
    home_streak = hr.get("streak", "") if hr else ""
    away_streak = ar.get("streak", "") if ar else ""

    # Probable pitchers
    pp_away = away.get("probablePitcher", {})
    pp_home = home.get("probablePitcher", {})
    away_sp = get_pitcher_line(pp_away)
    home_sp = get_pitcher_line(pp_home)

    # Game time
    game_date = game.get("gameDate", "")
    try:
        gt = datetime.fromisoformat(game_date.replace("Z", "+00:00"))
        et_time = gt.astimezone(ET).strftime("%-I:%M %p ET")
    except Exception:
        et_time = "TBD"

    lines = [
        f"🔎 GAME PREVIEW",
        f"",
        f"{abbr(away_name)} ({away_rec}) @ {abbr(home_name)} ({home_rec})",
        f"⏰ {et_time}",
    ]

    if away_streak or home_streak:
        lines.append(f"")
        if away_streak:
            lines.append(f"{abbr(away_name)}: {away_streak}")
        if home_streak:
            lines.append(f"{abbr(home_name)}: {home_streak}")

    lines.append(f"")
    lines.append(f"⚾ Pitching Matchup:")
    if away_sp:
        lines.append(f"  {abbr(away_name)}: {away_sp}")
    if home_sp:
        lines.append(f"  {abbr(home_name)}: {home_sp}")

    lines.append(f"")
    lines.append(f"Full analysis 👉 {STATSCOPE_URL}")
    lines.append(team_tags(abbr(away_name), abbr(home_name)))

    return "\n".join(lines)


def format_daily_slate(games: list, standings: dict) -> str:
    """Today's full slate overview (popular teams listed first)"""
    games = sorted(games, key=game_popularity, reverse=True)
    et = now_et()
    date_str = et.strftime("%B %d")
    lines = [
        f"📅 MLB Schedule — {date_str}",
        f"{len(games)} game{'s' if len(games) != 1 else ''} today",
        f"",
    ]

    for game in games[:10]:
        home = game["teams"]["home"]
        away = game["teams"]["away"]
        home_name = abbr(home["team"]["name"])
        away_name = abbr(away["team"]["name"])

        # Game time
        game_date = game.get("gameDate", "")
        try:
            gt = datetime.fromisoformat(game_date.replace("Z", "+00:00"))
            et_time = gt.astimezone(ET).strftime("%-I:%M")
        except Exception:
            et_time = "TBD"

        pp_away = away.get("probablePitcher", {}).get("fullName", "TBD")
        pp_home = home.get("probablePitcher", {}).get("fullName", "TBD")

        lines.append(f"▫️ {away_name} @ {home_name} — {et_time}")
        lines.append(f"   {pp_away} vs {pp_home}")

    if len(games) > 10:
        lines.append(f"  ...+{len(games) - 10} more")

    lines.append(f"")
    lines.append(f"Previews 👉 {STATSCOPE_URL}")
    lines.append(BASE_TAGS)  # daily slate uses generic tags (too many teams)

    return "\n".join(lines)


def format_game_recap(game: dict) -> str:
    """Game result with highlights"""
    home = game["teams"]["home"]
    away = game["teams"]["away"]
    home_name = abbr(home["team"]["name"])
    away_name = abbr(away["team"]["name"])
    home_score = home.get("score", 0)
    away_score = away.get("score", 0)

    winner = home_name if home_score > away_score else away_name
    loser = away_name if home_score > away_score else home_name

    decisions = game.get("decisions", {})
    wp = decisions.get("winner", {}).get("fullName", "")
    lp = decisions.get("loser", {}).get("fullName", "")
    sv = decisions.get("save", {}).get("fullName", "")

    diff = abs(home_score - away_score)
    total = home_score + away_score

    lines = [f"⚾ FINAL: {away_name} {away_score}, {home_name} {home_score}"]

    # Highlights
    linescore = game.get("linescore", {})
    innings = linescore.get("innings", [])

    if len(innings) > 9:
        lines[0] = f"⚾ FINAL ({len(innings)}): {away_name} {away_score}, {home_name} {home_score}"

    if diff <= 1:
        lines.append(f"🔥 Nail-biter!")
    elif diff >= 10:
        lines.append(f"💣 {winner} blowout!")
    elif total >= 20:
        lines.append(f"💥 Slugfest! {total} combined runs")

    if min(home_score, away_score) == 0:
        lines.append(f"🚫 Shutout by {winner}!")

    lines.append(f"")
    if wp:
        lines.append(f"W: {wp}")
    if lp:
        lines.append(f"L: {lp}")
    if sv:
        lines.append(f"SV: {sv}")

    lines.append(f"")
    lines.append(f"Box score & stats 👉 {STATSCOPE_URL}")
    lines.append(team_tags(home_name, away_name))

    return "\n".join(lines)


def format_leaders() -> str:
    """League leaders"""
    categories = {
        "homeRuns": "HR",
        "battingAverage": "AVG",
        "earnedRunAverage": "ERA",
    }

    lines = [
        f"📊 2025 MLB Leaders",
        f"",
    ]

    for cat_key, cat_name in categories.items():
        leaders = fetch_leaders(cat_key, limit=3)
        if not leaders:
            continue

        lines.append(f"🏆 {cat_name}")
        for leader in leaders:
            name = leader["person"]["fullName"]
            value = leader["value"]
            rank = leader["rank"]
            medal = {1: "1.", 2: "2.", 3: "3."}.get(rank, f"{rank}.")
            lines.append(f"  {medal} {name} — {value}")
        lines.append("")

    lines.append(f"Full leaderboard 👉 {STATSCOPE_URL}")
    lines.append(BASE_TAGS)

    return "\n".join(lines)


def format_korean_tracker() -> str:
    """Korean player performance tracker"""
    lines = [
        f"🇰🇷 Korean Players in MLB — Daily Update",
        f"",
    ]

    has_data = False
    for name, info in KOREAN_PLAYERS.items():
        try:
            player = fetch_player_stats(info["id"])
            if not player:
                continue

            for stat_group in player.get("stats", []):
                splits = stat_group.get("splits", [])
                if not splits:
                    continue

                stats = splits[-1].get("stat", {})
                group = stat_group.get("group", {}).get("displayName", "")

                if group == "hitting":
                    avg = stats.get("avg", "-")
                    hr = stats.get("homeRuns", 0)
                    rbi = stats.get("rbi", 0)
                    ops = stats.get("ops", "-")
                    lines.append(f"⚾ {name} ({info['team']})")
                    lines.append(f"   .{avg.lstrip('.')} AVG | {hr} HR | {rbi} RBI | {ops} OPS")
                    lines.append("")
                    has_data = True
                    break

                elif group == "pitching":
                    era = stats.get("era", "-")
                    w = stats.get("wins", 0)
                    l = stats.get("losses", 0)
                    so = stats.get("strikeOuts", 0)
                    lines.append(f"⚾ {name} ({info['team']})")
                    lines.append(f"   {era} ERA | {w}-{l} W-L | {so} K")
                    lines.append("")
                    has_data = True
                    break

        except Exception as e:
            print(f"  [{name}] fetch failed: {e}")
            continue

    if not has_data:
        lines.append("No season data available (offseason)")
        lines.append("")

    lines.append(f"Full stats 👉 {STATSCOPE_URL}")
    lines.append(f"#MLB #KoreanBaseball #StatScope")

    return "\n".join(lines)


# ─── Duplicate Prevention ─────────────────────────────────
HISTORY_FILE = Path(__file__).parent / ".post_history.json"

# Public picks history — served to the /track page on the website.
# Path: <repo_root>/public/data/picks-history.json
PICKS_HISTORY_FILE = Path(__file__).parent.parent / "public" / "data" / "picks-history.json"


def _load_picks_history() -> dict:
    """Load the canonical, append-only picks history consumed by /track."""
    if PICKS_HISTORY_FILE.exists():
        try:
            return json.loads(PICKS_HISTORY_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {
        "schema_version": 1,
        "start_date": now_et().strftime("%Y-%m-%d"),
        "record": {"w": 0, "l": 0},
        "picks": [],
    }


def _save_picks_history(h: dict) -> None:
    PICKS_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    PICKS_HISTORY_FILE.write_text(
        json.dumps(h, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _moneyline_from_prob(p: float) -> str:
    """Convert a 0-1 win probability to an American moneyline string."""
    if p >= 0.5:
        return str(round(-(p / (1 - p)) * 100))
    return "+" + str(round(((1 - p) / p) * 100))


def save_top3_picks_to_history(top3: list) -> None:
    """Append today's top-3 picks to public/data/picks-history.json.

    `top3` is the list of dicts produced inside cmd_picks with keys like
    an, hn, ai, hi, hW, aW, hML, aML, tot, hE, aE, etc.
    Idempotent: re-running for the same date replaces that day's entry.
    """
    h = _load_picks_history()
    today = now_et().strftime("%Y-%m-%d")
    entry = {"date": today, "checked": False, "picks": []}
    for r in top3:
        fav_is_home = r["hW"] > 50
        fav = r["hn"] if fav_is_home else r["an"]
        fav_id = r["hi"] if fav_is_home else r["ai"]
        prob = max(r["hW"], r["aW"])
        ml = r["hML"] if fav_is_home else r["aML"]
        projected_total = r["hE"] + r["aE"]
        if projected_total > r["tot"] + 0.25:
            lean = "over"
        elif projected_total < r["tot"] - 0.25:
            lean = "under"
        else:
            lean = "push"
        entry["picks"].append({
            "fav": fav,
            "fav_id": fav_id,
            "home_id": r["hi"],
            "away_id": r["ai"],
            "home": r["hn"],
            "away": r["an"],
            "prob": prob,
            "ml": ml,
            "ou_line": r["tot"],
            "ou_lean": lean,
            "result": None,
        })
    h["picks"] = [e for e in h["picks"] if e["date"] != today]
    h["picks"].append(entry)
    h["picks"].sort(key=lambda e: e["date"])
    _save_picks_history(h)
    print(f"  [picks] Saved {len(entry['picks'])} picks for {today} to picks-history.json")


def check_and_update_results() -> dict:
    """Resolve result field for any unchecked day in the picks history.

    Pulls MLB final scores for each unchecked date and stamps each pick
    with result (W/L/no_result), final_score, and bumps the cumulative
    record. Safe to run repeatedly.
    """
    h = _load_picks_history()
    updated_days = 0
    updated_picks = 0

    for entry in h["picks"]:
        if entry.get("checked"):
            continue
        date = entry["date"]
        try:
            sched = requests.get(
                f"{MLB_API}/schedule?sportId=1&date={date}&hydrate=linescore&gameType=R",
                timeout=20,
            ).json()
        except Exception as e:
            print(f"  [check] Failed to fetch schedule for {date}: {e}")
            continue

        scores = {}
        for d in sched.get("dates", []):
            for g in d.get("games", []):
                if g["status"]["abstractGameState"] != "Final":
                    continue
                hid = g["teams"]["home"]["team"]["id"]
                aid = g["teams"]["away"]["team"]["id"]
                hs = g["teams"]["home"].get("score", 0)
                as_ = g["teams"]["away"].get("score", 0)
                scores[(hid, aid)] = {"home_score": hs, "away_score": as_}

        all_resolved = True
        day_w = 0
        day_l = 0
        for pick in entry["picks"]:
            if pick.get("result") in ("W", "L"):
                continue
            key = (pick["home_id"], pick["away_id"])
            if key not in scores:
                pick["result"] = "no_result"
                all_resolved = False
                continue
            sc = scores[key]
            home_won = sc["home_score"] > sc["away_score"]
            fav_is_home = pick["fav_id"] == pick["home_id"]
            if (fav_is_home and home_won) or (not fav_is_home and not home_won):
                pick["result"] = "W"
                day_w += 1
            else:
                pick["result"] = "L"
                day_l += 1
            pick["final_score"] = f"{sc['away_score']}-{sc['home_score']}"
            updated_picks += 1

        if all_resolved and entry["picks"]:
            entry["checked"] = True
            updated_days += 1
        h["record"]["w"] += day_w
        h["record"]["l"] += day_l

    _save_picks_history(h)
    print(
        f"  [check] Updated {updated_picks} pick result(s) across {updated_days} finalized day(s)."
    )
    return {"updated_picks": updated_picks, "updated_days": updated_days}


def cmd_check_results(dry_run: bool):
    """Resolve W/L for any unchecked days in picks-history.json."""
    _ = dry_run  # no external side-effects; dry_run is a no-op
    check_and_update_results()


def _load_history() -> dict:
    if HISTORY_FILE.exists():
        try:
            data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
            # Keep only last 7 days
            cutoff = (now_et() - timedelta(days=7)).isoformat()
            return {k: v for k, v in data.items() if v.get("time", "") > cutoff}
        except Exception:
            return {}
    return {}


def _save_history(history: dict):
    HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")


def _content_hash(text: str) -> str:
    """Hash the core content (ignore timestamps, exact stats that change)"""
    # Strip whitespace and normalize for comparison
    normalized = text.strip()
    return hashlib.md5(normalized.encode("utf-8")).hexdigest()[:12]


def is_duplicate(text: str) -> bool:
    """Check if this post was already sent recently"""
    history = _load_history()
    h = _content_hash(text)
    if h in history:
        prev_time = history[h].get("time", "unknown")
        print(f"  [SKIP] Duplicate post detected (previously posted at {prev_time})")
        return True
    return False


def record_post(text: str):
    """Record a posted message to history"""
    history = _load_history()
    h = _content_hash(text)
    history[h] = {"time": now_et().isoformat(), "preview": text[:80]}
    _save_history(history)


# ─── Bluesky Post ─────────────────────────────────────────
def send_post(text: str, dry_run: bool = False) -> bool:
    """Send post to Bluesky"""
    if len(text) > 300:
        print(f"  [!] Post too long ({len(text)}/300). Trimming...")
        while len(text) > 295:
            lines = text.split("\n")
            if len(lines) > 4:
                mid = len(lines) // 2
                lines.pop(mid)
                text = "\n".join(lines)
            else:
                break

    # Duplicate check (after trimming so hash is consistent)
    if not dry_run and is_duplicate(text):
        return False

    print(f"\n{'─' * 50}")
    print(f"Post ({len(text)} chars):")
    print(f"{'─' * 50}")
    print(text)
    print(f"{'─' * 50}")

    if dry_run:
        print("[DRY RUN] Not posted.")
        return True

    if not BLUESKY_HANDLE or not BLUESKY_PASSWORD:
        print("\n[ERROR] Bluesky credentials not set. Check .env file.")
        return False

    try:
        from atproto import Client

        client = Client()
        client.login(BLUESKY_HANDLE, BLUESKY_PASSWORD)

        # Build facets for clickable links and hashtags
        facets = []
        url_start = text.find(STATSCOPE_URL)
        if url_start != -1:
            bs = len(text[:url_start].encode("utf-8"))
            be = bs + len(STATSCOPE_URL.encode("utf-8"))
            facets.append({
                "index": {"byteStart": bs, "byteEnd": be},
                "features": [{
                    "$type": "app.bsky.richtext.facet#link",
                    "uri": STATSCOPE_URL,
                }],
            })

        for word in text.split():
            if word.startswith("#"):
                tag = word[1:]
                tag_start = text.find(word)
                if tag_start != -1:
                    bs = len(text[:tag_start].encode("utf-8"))
                    be = bs + len(word.encode("utf-8"))
                    facets.append({
                        "index": {"byteStart": bs, "byteEnd": be},
                        "features": [{
                            "$type": "app.bsky.richtext.facet#tag",
                            "tag": tag,
                        }],
                    })

        post = client.send_post(text=text, facets=facets if facets else None)
        record_post(text)
        print(f"\n✅ Posted!")
        print(f"   https://bsky.app/profile/{BLUESKY_HANDLE}/post/{post.uri.split('/')[-1]}")
        return True

    except Exception as e:
        print(f"\n[ERROR] Post failed: {e}")
        return False


# ─── Commands ─────────────────────────────────────────────
def cmd_preview(dry_run: bool):
    """Game previews with pitching matchup analysis"""
    et = now_et()
    today = et.strftime("%Y-%m-%d")
    games = fetch_schedule(today)

    scheduled = [g for g in games if g.get("status", {}).get("abstractGameState") != "Final"]

    if not scheduled:
        tomorrow = (et + timedelta(days=1)).strftime("%Y-%m-%d")
        games = fetch_schedule(tomorrow)
        scheduled = games

    if not scheduled:
        print("No scheduled games found.")
        return

    standings = fetch_team_standings()

    # Post 1: Daily slate overview
    slate = format_daily_slate(scheduled, standings)
    send_post(slate, dry_run)

    # Post 2-3: Top matchup detailed previews (prioritize popular teams)
    featured = [g for g in scheduled
                if g["teams"]["away"].get("probablePitcher") and g["teams"]["home"].get("probablePitcher")]

    if not featured:
        featured = scheduled

    featured.sort(key=game_popularity, reverse=True)

    for game in featured[:2]:
        preview = format_single_preview(game, standings)
        send_post(preview, dry_run)


def cmd_recap(dry_run: bool):
    """Game results"""
    et = now_et()
    today = et.strftime("%Y-%m-%d")
    yesterday = (et - timedelta(days=1)).strftime("%Y-%m-%d")

    for date_str in [today, yesterday]:
        games = fetch_schedule(date_str)
        finished = [g for g in games if g.get("status", {}).get("abstractGameState") == "Final"]

        if not finished:
            continue

        # Prioritize popular teams
        finished.sort(key=game_popularity, reverse=True)
        print(f"[{date_str}] {len(finished)} finished games")

        count = 0
        for game in finished:
            post = format_game_recap(game)
            send_post(post, dry_run)
            count += 1
            if count >= 3:
                break
        return

    print("No finished games found.")


def cmd_leaders(dry_run: bool):
    """League leaders"""
    post = format_leaders()
    # Try to send with image card
    card_lines = []
    for cat_key, cat_name in {"homeRuns": "HR", "battingAverage": "AVG", "earnedRunAverage": "ERA"}.items():
        leaders = fetch_leaders(cat_key, limit=3)
        for leader in leaders:
            card_lines.append(f"{cat_name}  {leader['rank']}. {leader['person']['fullName']} — {leader['value']}")
    if card_lines:
        send_post_with_card(post, "2025 MLB Leaders", card_lines, dry_run)
    else:
        send_post(post, dry_run)


def cmd_korean(dry_run: bool):
    """Korean player tracker"""
    post = format_korean_tracker()
    send_post(post, dry_run)


def cmd_auto(dry_run: bool):
    """Auto-select based on ET timezone"""
    hour = now_et().hour

    if 9 <= hour < 13:
        # Morning ET: Yesterday's recaps
        print(f"[{now_et().strftime('%I:%M %p ET')}] Morning → Game recaps")
        cmd_recap(dry_run)
    elif 13 <= hour < 17:
        # Afternoon ET: Today's previews (before games start)
        print(f"[{now_et().strftime('%I:%M %p ET')}] Afternoon → Game previews")
        cmd_preview(dry_run)
    elif 17 <= hour < 20:
        # Early evening: Preview
        print(f"[{now_et().strftime('%I:%M %p ET')}] Evening → Game previews")
        cmd_preview(dry_run)
    elif 20 <= hour <= 23:
        # Night: Live game results as they finish
        print(f"[{now_et().strftime('%I:%M %p ET')}] Night → Game results")
        cmd_recap(dry_run)
    else:
        # Late night/early morning: Leaders
        print(f"[{now_et().strftime('%I:%M %p ET')}] Off-hours → League leaders")
        cmd_leaders(dry_run)


# ─── Image Card Generation ───────────────────────────────
def generate_stat_card_svg(title: str, lines: list[str], accent_color: str = "#2563eb") -> str:
    """Generate an SVG stat card for embedding in posts"""
    line_items = ""
    for i, line in enumerate(lines[:8]):
        escaped = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        y = 90 + i * 32
        line_items += f'<text x="30" y="{y}" font-size="18" fill="#e2e8f0" font-family="monospace">{escaped}</text>\n'

    height = 90 + len(lines[:8]) * 32 + 40
    escaped_title = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="600" height="{height}" viewBox="0 0 600 {height}">
  <rect width="600" height="{height}" rx="16" fill="#1e293b"/>
  <rect x="0" y="0" width="600" height="56" rx="16" fill="{accent_color}"/>
  <rect x="0" y="40" width="600" height="16" fill="{accent_color}"/>
  <text x="30" y="38" font-size="22" font-weight="bold" fill="white" font-family="sans-serif">{escaped_title}</text>
  {line_items}
  <text x="570" y="{height - 15}" font-size="12" fill="#64748b" text-anchor="end" font-family="sans-serif">statscope-eta.vercel.app</text>
</svg>"""
    return svg


def upload_image_blob(client, svg_content: str) -> dict | None:
    """Convert SVG to PNG (if possible) and upload as blob, or return None"""
    try:
        # Try to use cairosvg for SVG->PNG conversion
        import cairosvg
        png_data = cairosvg.svg2png(bytestring=svg_content.encode("utf-8"), output_width=600)
        resp = client.upload_blob(png_data, timeout=30)
        return {
            "$type": "blob",
            "ref": resp.blob.ref,
            "mimeType": "image/png",
            "size": len(png_data),
        }
    except ImportError:
        # cairosvg not available, skip image
        print("  [INFO] cairosvg not installed — skipping image card (pip install cairosvg)")
        return None
    except Exception as e:
        print(f"  [WARN] Image upload failed: {e}")
        return None


def send_post_with_card(text: str, card_title: str, card_lines: list[str], dry_run: bool = False) -> bool:
    """Send post with an optional stat card image"""
    if dry_run:
        return send_post(text, dry_run)

    if not BLUESKY_HANDLE or not BLUESKY_PASSWORD:
        return send_post(text, dry_run)

    try:
        from atproto import Client

        client = Client()
        client.login(BLUESKY_HANDLE, BLUESKY_PASSWORD)

        svg = generate_stat_card_svg(card_title, card_lines)
        blob = upload_image_blob(client, svg)

        if blob:
            # Build embed with image
            embed = {
                "$type": "app.bsky.embed.images",
                "images": [{
                    "alt": card_title,
                    "image": blob,
                }],
            }

            # Build facets
            facets = []
            url_start = text.find(STATSCOPE_URL)
            if url_start != -1:
                bs = len(text[:url_start].encode("utf-8"))
                be = bs + len(STATSCOPE_URL.encode("utf-8"))
                facets.append({
                    "index": {"byteStart": bs, "byteEnd": be},
                    "features": [{
                        "$type": "app.bsky.richtext.facet#link",
                        "uri": STATSCOPE_URL,
                    }],
                })

            if is_duplicate(text):
                return False

            post = client.send_post(text=text, facets=facets if facets else None, embed=embed)
            record_post(text)
            print(f"\n✅ Posted with image card!")
            print(f"   https://bsky.app/profile/{BLUESKY_HANDLE}/post/{post.uri.split('/')[-1]}")
            return True
        else:
            return send_post(text, dry_run)

    except Exception as e:
        print(f"  [WARN] Card post failed, falling back to text: {e}")
        return send_post(text, dry_run)


# ─── Follower Interaction ─────────────────────────────────
def cmd_interact(dry_run: bool):
    """Reply to mentions and follow-backs"""
    if not BLUESKY_HANDLE or not BLUESKY_PASSWORD:
        print("[ERROR] Bluesky credentials not set.")
        return

    if dry_run:
        print("[DRY RUN] Would check notifications and interact.")
        return

    try:
        from atproto import Client

        client = Client()
        client.login(BLUESKY_HANDLE, BLUESKY_PASSWORD)

        # Fetch recent notifications
        notifs = client.app.bsky.notification.list_notifications({"limit": 20})

        replied_count = 0
        followed_count = 0

        for notif in notifs.notifications:
            # Auto-follow back
            if notif.reason == "follow" and not notif.is_read:
                try:
                    client.follow(notif.author.did)
                    followed_count += 1
                    print(f"  Followed back: @{notif.author.handle}")
                except Exception:
                    pass

            # Reply to mentions with a friendly response
            if notif.reason == "mention" and not notif.is_read:
                try:
                    reply_text = (
                        f"Thanks for the mention! Check out the full stats at {STATSCOPE_URL} "
                        f"{BASE_TAGS}"
                    )
                    # Build reply reference
                    root = notif.record
                    parent_ref = {
                        "uri": notif.uri,
                        "cid": notif.cid,
                    }
                    root_ref = parent_ref
                    if hasattr(root, "reply") and root.reply:
                        root_ref = {
                            "uri": root.reply.root.uri,
                            "cid": root.reply.root.cid,
                        }

                    client.send_post(
                        text=reply_text,
                        reply_to={
                            "root": root_ref,
                            "parent": parent_ref,
                        },
                    )
                    replied_count += 1
                    print(f"  Replied to: @{notif.author.handle}")
                except Exception as e:
                    print(f"  [WARN] Reply failed: {e}")

        # Mark notifications as read
        try:
            client.app.bsky.notification.update_seen(
                {"seenAt": datetime.now(timezone.utc).isoformat()}
            )
        except Exception:
            pass

        print(f"\nInteraction summary: {followed_count} follow-backs, {replied_count} replies")

    except Exception as e:
        print(f"[ERROR] Interaction failed: {e}")


def cmd_picks(dry_run: bool):
    """Daily prediction picks from StatScope Model v2.2"""
    import math

    MLB = "https://statsapi.mlb.com/api/v1"
    LE = 4.0; LW = 0.315; PX = 1.83
    K = {"SI":0.0264,"BI":0.0024,"LI":0.064,"PI":0.024,"RW":0.30,"RF":0.22,"HA":0.066}
    PKF = {108:0.97,109:1.05,110:1.04,111:1.08,112:1.05,113:1.10,114:0.98,115:1.35,
           116:0.97,117:1.02,118:0.99,119:0.98,120:1.00,121:0.95,133:1.00,134:0.94,
           135:0.94,136:0.96,137:0.93,138:0.98,139:0.95,140:1.00,141:1.04,142:1.01,
           143:1.06,144:1.00,145:1.07,146:0.92,147:1.06,158:1.03}
    TEAM_TAGS = {108:"Angels",109:"Dbacks",110:"Orioles",111:"RedSox",112:"Cubs",
        113:"Reds",114:"Guardians",115:"Rockies",116:"Tigers",117:"Astros",
        118:"Royals",119:"Dodgers",120:"Nationals",121:"Mets",133:"Athletics",
        134:"Pirates",135:"Padres",136:"Mariners",137:"Giants",138:"Cardinals",
        139:"Rays",140:"Rangers",141:"BlueJays",142:"Twins",143:"Phillies",
        144:"Braves",145:"WhiteSox",146:"Marlins",147:"Yankees",158:"Brewers"}

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

    try:
        # Fetch standings
        sd = requests.get(f"{MLB}/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason&hydrate=team").json()
        tms = {}
        for rec in sd.get("records",[]):
            for tr in rec.get("teamRecords",[]):
                l10 = next((r for r in tr.get("records",{}).get("splitRecords",[]) if r["type"]=="lastTen"), None)
                tms[tr["team"]["id"]] = {"w":tr["wins"],"l":tr["losses"],"rs":tr["runsScored"],"ra":tr["runsAllowed"],
                    "l10w":l10["wins"] if l10 else 5,"l10l":l10["losses"] if l10 else 5,"era":0.0,"woba":0.0}

        # Team stats
        for sp in requests.get(f"{MLB}/teams/stats?stats=season&group=pitching&sportId=1&season=2026").json().get("stats",[{}])[0].get("splits",[]):
            if sp["team"]["id"] in tms: tms[sp["team"]["id"]]["era"] = float(sp["stat"].get("era","0") or 0)
        for sp in requests.get(f"{MLB}/teams/stats?stats=season&group=hitting&sportId=1&season=2026").json().get("stats",[{}])[0].get("splits",[]):
            tid=sp["team"]["id"]
            if tid not in tms: continue
            s=sp["stat"]; sin=s.get("hits",0)-s.get("doubles",0)-s.get("triples",0)-s.get("homeRuns",0)
            den=s.get("atBats",0)+s.get("baseOnBalls",0)-s.get("intentionalWalks",0)+s.get("sacFlies",0)+s.get("hitByPitch",0)
            if den>0: tms[tid]["woba"]=(0.69*(s.get("baseOnBalls",0)-s.get("intentionalWalks",0))+0.72*s.get("hitByPitch",0)+0.88*sin+1.27*s.get("doubles",0)+1.62*s.get("triples",0)+2.1*s.get("homeRuns",0))/den

        # Today's games
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

        if not games:
            print("No upcoming games found.")
            return

        # Pitcher stats
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

        # Run model on each game
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
            # O/U
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
                "hL10":f"{ht['l10w']}-{ht['l10l']}","aL10":f"{at['l10w']}-{at['l10l']}"})

        results.sort(key=lambda x: x["edge"], reverse=True)
        top3 = results[:3]
        if not top3:
            print("No predictions available.")
            return

        # Persist picks to the public track-record file before posting,
        # so /track reflects today's slate even if Bluesky posting fails.
        if not dry_run:
            try:
                save_top3_picks_to_history(top3)
            except Exception as e:
                print(f"  [picks] Failed to save picks history: {e}")

        # Post 1: Header
        header = f"🎯 StatScope Picks — {now_et().strftime('%b %d')}\n\n"
        header += f"Top 3 picks from my personal 9-factor prediction model\n(backtested on 246 games)\n\n"
        header += f"Full analysis 👉 {STATSCOPE_URL}\n"
        header += "#MLB #BaseballPicks #StatScope"
        send_post(header, dry_run)

        import time
        time.sleep(2)

        # Post each pick
        for i, r in enumerate(top3):
            fav = r["hn"] if r["hW"] > 50 else r["an"]
            fav_pct = r["hW"] if r["hW"] > 50 else r["aW"]
            fav_ml = r["hML"] if r["hW"] > 50 else r["aML"]
            fav_id = r["hi"] if r["hW"] > 50 else r["ai"]
            ou = "OVER" if (r["hE"]+r["aE"]) > r["tot"] + 0.25 else "UNDER" if (r["hE"]+r["aE"]) < r["tot"] - 0.25 else "PUSH"
            rl = "COVERS" if r["covers"] else "TIGHT"
            margin_s = f"+{r['margin']}" if r['margin'] > 0 else str(r['margin'])

            tag = TEAM_TAGS.get(fav_id, "")
            post = f"{'🔥' if i==0 else '📊'} #{i+1} {r['an']} @ {r['hn']}\n\n"
            post += f"✅ {fav} WIN {fav_pct}%\n"
            post += f"💰 ML: {fav} {fav_ml}\n"
            post += f"📊 -1.5 Run Line: {rl} ({margin_s})\n"
            post += f"{'📈' if ou=='OVER' else '📉'} O/U {r['tot']}: {ou}\n\n"
            post += f"#{tag} #MLB #StatScope" if tag else "#MLB #StatScope"

            time.sleep(2)
            send_post(post, dry_run)

        print(f"\n✅ Posted {len(top3)+1} picks posts.")

        # Generate Reddit-ready analysis (copy-paste for r/sportsbook)
        _save_reddit_text(top3)

    except Exception as e:
        print(f"[ERROR] Picks failed: {e}")
        import traceback
        traceback.print_exc()


def _save_reddit_text(picks):
    """Save Reddit-ready analysis to file for manual copy-paste."""
    import random
    openers = [
        "Ran my numbers this morning, here's what I like on today's slate:",
        "Three spots where I see the most edge today:",
        "Model showing some clean edges today. Top plays:",
        "Broke down every game today, three plays I feel best about:",
        "Crunched the FIP-adjusted projections. Locking in these:",
        "Today's board has a few spots I really like. Top 3 confidence plays:",
    ]
    SHORT = {108:"LAA",109:"ARI",110:"BAL",111:"BOS",112:"CHC",113:"CIN",114:"CLE",
        115:"COL",116:"DET",117:"HOU",118:"KC",119:"LAD",120:"WSH",121:"NYM",
        133:"OAK",134:"PIT",135:"SD",136:"SEA",137:"SF",138:"STL",139:"TB",
        140:"TEX",141:"TOR",142:"MIN",143:"PHI",144:"ATL",145:"CWS",146:"MIA",
        147:"NYY",158:"MIL"}

    lines = [random.choice(openers), ""]
    for p in picks:
        is_home = p["hW"] > 50
        fav_s = SHORT.get(p["hi"] if is_home else p["ai"], "???")
        dog_s = SHORT.get(p["ai"] if is_home else p["hi"], "???")
        fav_ml = p["hML"] if is_home else p["aML"]
        fav_pct = p["hW"] if is_home else p["aW"]
        fav_era = p.get("hERA",0) if is_home else p.get("aERA",0)
        fav_fip = p.get("hFIP",0) if is_home else p.get("aFIP",0)
        dog_era = p.get("aERA",0) if is_home else p.get("hERA",0)
        fav_p = p["hp"] if is_home else p["ap"]
        dog_p = p["ap"] if is_home else p["hp"]
        fav_l10 = p.get("hL10","") if is_home else p.get("aL10","")
        margin_s = f"+{p['margin']}" if p['margin'] > 0 else str(p['margin'])
        ou_exp = round(p["hE"] + p["aE"], 1)
        ou = "over" if ou_exp > p["tot"] + 0.25 else "under" if ou_exp < p["tot"] - 0.25 else None

        fip_str = f", {fav_fip:.2f} FIP" if fav_fip > 0 else ""
        t = f"**{fav_s} ML ({fav_ml})**"
        if fav_era > 0 and fav_era < 3.5:
            t += f" - {fav_p} has been dealing ({fav_era:.2f} ERA{fip_str})."
        elif dog_era > 5:
            t += f" - Fading {dog_p} here ({dog_era:.2f} ERA). That's rough."
        else:
            t += f" - {fav_p} ({fav_era:.2f} ERA{fip_str}) vs {dog_p} ({dog_era:.2f} ERA). Pitching edge."
        if fav_l10:
            t += f" {fav_s} {fav_l10} last 10."
        if p["covers"]:
            t += f" Like -1.5 too (margin {margin_s})."
        if ou:
            t += f" Leaning {ou} {p['tot']} (proj {ou_exp})."
        t += f" Confidence: {fav_pct:.0f}%."
        lines.append(t)
        lines.append("")

    lines.append("All picks from my personal prediction model (9-factor, backtested on 246 games)")
    lines.append("")
    lines.append("BOL if tailing")

    reddit_file = Path(__file__).parent / "reddit_post.txt"
    reddit_file.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n📋 Reddit text saved to: {reddit_file}")
    print("   Copy-paste to r/sportsbook MLB Daily Discussion\n")


def main():
    parser = argparse.ArgumentParser(description="StatScope Bluesky Bot")
    parser.add_argument(
        "command",
        choices=[
            "recap",
            "preview",
            "leaders",
            "korean",
            "auto",
            "interact",
            "picks",
            "check-results",
        ],
        help="Post type",
    )
    parser.add_argument(
        "--dry-run", "-d",
        action="store_true",
        help="Preview without posting",
    )
    args = parser.parse_args()

    print(f"=== StatScope Bluesky Bot ===")
    print(f"Command: {args.command} {'(dry run)' if args.dry_run else ''}")
    print(f"ET Time: {now_et().strftime('%Y-%m-%d %I:%M %p ET')}\n")

    commands = {
        "recap": cmd_recap,
        "preview": cmd_preview,
        "leaders": cmd_leaders,
        "korean": cmd_korean,
        "auto": cmd_auto,
        "interact": cmd_interact,
        "picks": cmd_picks,
        "check-results": cmd_check_results,
    }

    commands[args.command](args.dry_run)


if __name__ == "__main__":
    main()
