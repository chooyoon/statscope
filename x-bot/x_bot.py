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
import io
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import requests

# ─── Config ───────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

STATSCOPE_URL = os.getenv("STATSCOPE_URL", "https://statscope.vercel.app")
MLB_API = "https://statsapi.mlb.com/api/v1"

BLUESKY_HANDLE = os.getenv("BLUESKY_HANDLE", "")
BLUESKY_PASSWORD = os.getenv("BLUESKY_PASSWORD", "")

# US Eastern Time (UTC-4 during DST, UTC-5 otherwise)
ET = timezone(timedelta(hours=-4))  # EDT (March-November)

BASE_TAGS = "#MLB #Baseball #StatScope"

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
    lines.append(BASE_TAGS)

    return "\n".join(lines)


def format_daily_slate(games: list, standings: dict) -> str:
    """Today's full slate overview"""
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
    lines.append(BASE_TAGS)

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
    lines.append(BASE_TAGS)

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

    # Post 2-3: Top matchup detailed previews (pick games with both SP announced)
    featured = [g for g in scheduled
                if g["teams"]["away"].get("probablePitcher") and g["teams"]["home"].get("probablePitcher")]

    if not featured:
        featured = scheduled

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
        # Early evening: Korean player update + preview
        print(f"[{now_et().strftime('%I:%M %p ET')}] Evening → Korean players + Preview")
        cmd_korean(dry_run)
        cmd_preview(dry_run)
    elif 20 <= hour <= 23:
        # Night: Live game results as they finish
        print(f"[{now_et().strftime('%I:%M %p ET')}] Night → Game results")
        cmd_recap(dry_run)
    else:
        # Late night/early morning: Leaders
        print(f"[{now_et().strftime('%I:%M %p ET')}] Off-hours → League leaders")
        cmd_leaders(dry_run)


def main():
    parser = argparse.ArgumentParser(description="StatScope Bluesky Bot")
    parser.add_argument(
        "command",
        choices=["recap", "preview", "leaders", "korean", "auto"],
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
    }

    commands[args.command](args.dry_run)


if __name__ == "__main__":
    main()
