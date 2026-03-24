"""
StatScope X(Twitter) 자동 포스팅 봇
=====================================
MLB 경기 결과, 선수 통계, 한국 선수 성적을 자동으로 트윗합니다.

사용법:
    python x_bot.py recap          # 오늘 완료된 경기 결과 트윗
    python x_bot.py preview        # 오늘 경기 프리뷰 트윗
    python x_bot.py leaders        # 리그 리더 트윗
    python x_bot.py korean         # 한국 선수 성적 트윗
    python x_bot.py auto           # 시간대에 맞는 트윗 자동 선택
    python x_bot.py --dry-run ...  # 트윗 안 보내고 미리보기만
"""

import argparse
import io
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Windows 콘솔 UTF-8 출력 설정
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import requests

# ─── 설정 ────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

STATSCOPE_URL = os.getenv("STATSCOPE_URL", "https://statscope.vercel.app")
MLB_API = "https://statsapi.mlb.com/api/v1"

# 한국 선수
KOREAN_PLAYERS = {
    "김혜성": {"id": 664285, "team": "MIN", "pos": "2B"},
    "이정후": {"id": 808967, "team": "SF", "pos": "OF"},
    "배지환": {"id": 666166, "team": "PIT", "pos": "IF"},
    "김하성": {"id": 673490, "team": "SD", "pos": "SS"},
}

# 해시태그
BASE_TAGS = "#MLB #StatScope"
KOREAN_TAGS = "#MLB #코리안리거 #StatScope"

# 팀 약칭 → 한글
TEAM_KR = {
    "New York Yankees": "양키스", "New York Mets": "메츠",
    "Los Angeles Dodgers": "다저스", "Los Angeles Angels": "에인절스",
    "San Diego Padres": "파드리스", "San Francisco Giants": "자이언츠",
    "Houston Astros": "애스트로스", "Atlanta Braves": "브레이브스",
    "Philadelphia Phillies": "필리스", "Texas Rangers": "레인저스",
    "Minnesota Twins": "트윈스", "Pittsburgh Pirates": "파이리츠",
    "Boston Red Sox": "레드삭스", "Chicago Cubs": "컵스",
    "Chicago White Sox": "화이트삭스", "Toronto Blue Jays": "블루제이스",
    "Baltimore Orioles": "오리올스", "Tampa Bay Rays": "레이스",
    "Seattle Mariners": "매리너스", "Cleveland Guardians": "가디언스",
    "Detroit Tigers": "타이거스", "Kansas City Royals": "로열스",
    "Oakland Athletics": "애슬레틱스", "Milwaukee Brewers": "브루어스",
    "St. Louis Cardinals": "카디널스", "Cincinnati Reds": "레즈",
    "Arizona Diamondbacks": "다이아몬드백스", "Colorado Rockies": "로키스",
    "Miami Marlins": "말린스", "Washington Nationals": "내셔널스",
}


def kr_team(name: str) -> str:
    return TEAM_KR.get(name, name)


# ─── MLB API ──────────────────────────────────────────────
def fetch_schedule(date_str: str) -> list:
    url = f"{MLB_API}/schedule?date={date_str}&sportId=1&hydrate=team,linescore,decisions,probablePitcher"
    resp = requests.get(url, timeout=10)
    data = resp.json()
    games = []
    for d in data.get("dates", []):
        games.extend(d.get("games", []))
    return games


def fetch_player_stats(player_id: int) -> dict:
    url = f"{MLB_API}/people/{player_id}?hydrate=stats(group=[hitting,pitching],type=season),currentTeam"
    resp = requests.get(url, timeout=10)
    data = resp.json()
    return data["people"][0] if data.get("people") else {}


def fetch_leaders(category: str, limit: int = 3) -> list:
    url = f"{MLB_API}/stats/leaders?leaderCategories={category}&season=2025&limit={limit}"
    resp = requests.get(url, timeout=10)
    data = resp.json()
    for cat in data.get("leagueLeaders", []):
        return cat.get("leaders", [])
    return []


# ─── 트윗 포맷터 ──────────────────────────────────────────
def format_game_recap(game: dict) -> str:
    """경기 결과 트윗 포맷"""
    home = game["teams"]["home"]
    away = game["teams"]["away"]
    home_name = kr_team(home["team"]["name"])
    away_name = kr_team(away["team"]["name"])
    home_score = home.get("score", 0)
    away_score = away.get("score", 0)

    winner = home_name if home_score > away_score else away_name
    loser = away_name if home_score > away_score else home_name
    w_score = max(home_score, away_score)
    l_score = min(home_score, away_score)

    # 결정 투수
    decisions = game.get("decisions", {})
    wp = decisions.get("winner", {}).get("fullName", "")
    lp = decisions.get("loser", {}).get("fullName", "")
    sv = decisions.get("save", {}).get("fullName", "")

    lines = [
        f"⚾ {away_name} vs {home_name}",
        f"",
        f"📊 최종 {away_score} : {home_score}",
        f"🏆 {winner} 승리!",
    ]

    if wp:
        lines.append(f"")
        lines.append(f"승 {wp}")
    if lp:
        lines.append(f"패 {lp}")
    if sv:
        lines.append(f"세 {sv}")

    # 접전일 경우 강조
    diff = abs(home_score - away_score)
    if diff <= 1:
        lines.append(f"")
        lines.append(f"🔥 {diff}점차 접전!")
    elif w_score >= 10:
        lines.append(f"")
        lines.append(f"💣 {winner} 타선 폭발!")

    lines.append(f"")
    lines.append(f"자세한 분석 👉 {STATSCOPE_URL}")
    lines.append(BASE_TAGS)

    return "\n".join(lines)


def format_preview(games: list) -> str:
    """오늘 경기 프리뷰 트윗"""
    today = datetime.now().strftime("%m/%d")
    lines = [
        f"📅 {today} 오늘의 MLB ({len(games)}경기)",
        f"",
    ]

    for game in games[:8]:  # 트윗 길이 제한
        home = kr_team(game["teams"]["home"]["team"]["name"])
        away = kr_team(game["teams"]["away"]["team"]["name"])

        # 선발 투수
        pp_away = game["teams"]["away"].get("probablePitcher", {}).get("fullName", "")
        pp_home = game["teams"]["home"].get("probablePitcher", {}).get("fullName", "")

        matchup = f"▫️ {away} @ {home}"
        if pp_away and pp_home:
            matchup += f" ({pp_away} vs {pp_home})"
        lines.append(matchup)

    if len(games) > 8:
        lines.append(f"  ...외 {len(games) - 8}경기")

    lines.append(f"")
    lines.append(f"매치업 분석 👉 {STATSCOPE_URL}")
    lines.append(BASE_TAGS)

    return "\n".join(lines)


def format_leaders() -> str:
    """리그 리더 트윗"""
    categories = {
        "homeRuns": "홈런",
        "battingAverage": "타율",
        "earnedRunAverage": "ERA",
    }

    lines = [
        f"📈 2025 MLB 리그 리더 업데이트",
        f"",
    ]

    for cat_key, cat_name in categories.items():
        leaders = fetch_leaders(cat_key, limit=3)
        if not leaders:
            continue

        lines.append(f"🏅 {cat_name}")
        for leader in leaders:
            name = leader["person"]["fullName"]
            value = leader["value"]
            rank = leader["rank"]
            medal = {1: "🥇", 2: "🥈", 3: "🥉"}.get(rank, f"{rank}.")
            lines.append(f"  {medal} {name} {value}")
        lines.append("")

    lines.append(f"전체 순위 👉 {STATSCOPE_URL}")
    lines.append(BASE_TAGS)

    return "\n".join(lines)


def format_korean_players() -> str:
    """한국 선수 성적 트윗"""
    lines = [
        f"🇰🇷 MLB 코리안 리거 성적",
        f"",
    ]

    has_data = False
    for name, info in KOREAN_PLAYERS.items():
        try:
            player = fetch_player_stats(info["id"])
            if not player:
                continue

            all_stats = player.get("stats", [])
            for stat_group in all_stats:
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
                    lines.append(f"   AVG {avg} | HR {hr} | RBI {rbi} | OPS {ops}")
                    lines.append("")
                    has_data = True
                    break

                elif group == "pitching":
                    era = stats.get("era", "-")
                    wins = stats.get("wins", 0)
                    losses = stats.get("losses", 0)
                    so = stats.get("strikeOuts", 0)
                    lines.append(f"⚾ {name} ({info['team']})")
                    lines.append(f"   ERA {era} | {wins}W-{losses}L | SO {so}")
                    lines.append("")
                    has_data = True
                    break

        except Exception as e:
            print(f"  [{name}] 데이터 실패: {e}")
            continue

    if not has_data:
        lines.append("(시즌 데이터 없음 — 비시즌)")
        lines.append("")

    lines.append(f"한국 선수 분석 👉 {STATSCOPE_URL}")
    lines.append(KOREAN_TAGS)

    return "\n".join(lines)


# ─── 경기 하이라이트 (특이 기록) ──────────────────────────
def format_highlight_tweet(game: dict) -> str | None:
    """특이 기록이 있는 경기만 하이라이트 트윗"""
    home = game["teams"]["home"]
    away = game["teams"]["away"]
    home_score = home.get("score", 0)
    away_score = away.get("score", 0)
    home_name = kr_team(home["team"]["name"])
    away_name = kr_team(away["team"]["name"])

    diff = abs(home_score - away_score)
    total = home_score + away_score

    # 특이 기록 체크
    if diff == 0:  # 동점 (연장 가능성)
        return None

    highlights = []

    if total >= 20:
        highlights.append(f"💥 두 팀 합산 {total}점! 타격전!")
    if diff >= 10:
        winner = home_name if home_score > away_score else away_name
        highlights.append(f"🌊 {winner}의 {diff}점차 대승!")
    if max(home_score, away_score) >= 15:
        highlights.append(f"🔥 한 팀 {max(home_score, away_score)}점 폭발!")

    # 셧아웃
    if min(home_score, away_score) == 0 and max(home_score, away_score) > 0:
        winner = home_name if home_score > away_score else away_name
        loser = away_name if home_score > away_score else home_name
        highlights.append(f"🚫 {winner}가 {loser}를 셧아웃!")

    # 끝내기
    linescore = game.get("linescore", {})
    innings = linescore.get("innings", [])
    if len(innings) > 9:
        highlights.append(f"⏰ {len(innings)}이닝 연장 혈전!")
    if diff == 1 and len(innings) >= 9:
        last = innings[-1]
        home_last = last.get("home", {}).get("runs", 0)
        if home_last > 0:
            highlights.append(f"🎯 끝내기 승리!")

    if not highlights:
        return None

    lines = [
        f"🚨 하이라이트",
        f"",
        f"{away_name} {away_score} : {home_score} {home_name}",
        f"",
    ]
    lines.extend(highlights)
    lines.append(f"")
    lines.append(f"상세 분석 👉 {STATSCOPE_URL}")
    lines.append(BASE_TAGS)

    return "\n".join(lines)


# ─── X(Twitter) 전송 ──────────────────────────────────────
def send_tweet(text: str, dry_run: bool = False) -> bool:
    """트윗 전송"""
    # 280자(영문) / 140자(한글) 체크 — X는 한글 2바이트 계산
    char_count = sum(2 if ord(c) > 127 else 1 for c in text)
    if char_count > 280:
        print(f"  ⚠️  트윗 길이 초과 ({char_count}/280). 잘라냅니다.")
        # 해시태그 유지하면서 자르기
        while char_count > 275:
            lines = text.split("\n")
            if len(lines) > 4:
                # 중간 내용 줄이기
                mid = len(lines) // 2
                lines.pop(mid)
                text = "\n".join(lines)
                char_count = sum(2 if ord(c) > 127 else 1 for c in text)
            else:
                break

    print(f"\n{'─' * 50}")
    print(f"📝 트윗 내용 ({char_count}자):")
    print(f"{'─' * 50}")
    print(text)
    print(f"{'─' * 50}")

    if dry_run:
        print("🔸 [DRY RUN] 트윗을 보내지 않았습니다.")
        return True

    # API 키 확인
    api_key = os.getenv("X_API_KEY")
    api_secret = os.getenv("X_API_SECRET")
    access_token = os.getenv("X_ACCESS_TOKEN")
    access_secret = os.getenv("X_ACCESS_TOKEN_SECRET")

    if not all([api_key, api_secret, access_token, access_secret]):
        print("\n❌ X API 키가 설정되지 않았습니다.")
        print("   .env 파일에 API 키를 설정하세요.")
        print("   (.env.example 파일을 참고)")
        return False

    try:
        import tweepy

        client = tweepy.Client(
            consumer_key=api_key,
            consumer_secret=api_secret,
            access_token=access_token,
            access_token_secret=access_secret,
        )
        response = client.create_tweet(text=text)
        tweet_id = response.data["id"]
        print(f"\n✅ 트윗 성공! https://x.com/i/status/{tweet_id}")
        return True

    except Exception as e:
        print(f"\n❌ 트윗 실패: {e}")
        return False


# ─── 메인 커맨드 ──────────────────────────────────────────
def cmd_recap(dry_run: bool):
    """완료된 경기 결과 트윗"""
    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    # 오늘 완료된 경기 먼저, 없으면 어제
    for date_str in [today, yesterday]:
        games = fetch_schedule(date_str)
        finished = [g for g in games if g.get("status", {}).get("abstractGameState") == "Final"]

        if not finished:
            continue

        print(f"📅 {date_str} — 완료된 경기 {len(finished)}개")

        count = 0
        for game in finished:
            # 하이라이트 트윗 먼저 시도
            highlight = format_highlight_tweet(game)
            if highlight:
                send_tweet(highlight, dry_run)
                count += 1
            else:
                # 일반 결과 트윗
                tweet = format_game_recap(game)
                send_tweet(tweet, dry_run)
                count += 1

            if count >= 3:  # 한 번에 최대 3개
                break

        return

    print("완료된 경기가 없습니다.")


def cmd_preview(dry_run: bool):
    """오늘 경기 프리뷰"""
    today = datetime.now().strftime("%Y-%m-%d")
    games = fetch_schedule(today)

    scheduled = [g for g in games if g.get("status", {}).get("abstractGameState") != "Final"]

    if not scheduled:
        # 내일 경기 확인
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        games = fetch_schedule(tomorrow)
        scheduled = games

    if not scheduled:
        print("예정된 경기가 없습니다.")
        return

    tweet = format_preview(scheduled)
    send_tweet(tweet, dry_run)


def cmd_leaders(dry_run: bool):
    """리그 리더 트윗"""
    tweet = format_leaders()
    send_tweet(tweet, dry_run)


def cmd_korean(dry_run: bool):
    """한국 선수 성적"""
    tweet = format_korean_players()
    send_tweet(tweet, dry_run)


def cmd_auto(dry_run: bool):
    """시간대에 맞춰 자동 선택"""
    hour = datetime.now().hour

    if 8 <= hour < 12:
        # 오전: 어제 경기 결과
        print("🕐 오전 → 경기 결과 트윗")
        cmd_recap(dry_run)
    elif 12 <= hour < 17:
        # 오후: 오늘 프리뷰 + 리그 리더
        print("🕐 오후 → 경기 프리뷰 트윗")
        cmd_preview(dry_run)
    elif 17 <= hour < 22:
        # 저녁: 한국 선수 + 프리뷰
        print("🕐 저녁 → 한국 선수 성적 트윗")
        cmd_korean(dry_run)
    else:
        # 밤/새벽: 리그 리더
        print("🕐 밤 → 리그 리더 트윗")
        cmd_leaders(dry_run)


def main():
    parser = argparse.ArgumentParser(description="StatScope X(Twitter) 자동 포스팅 봇")
    parser.add_argument(
        "command",
        choices=["recap", "preview", "leaders", "korean", "auto"],
        help="트윗 유형",
    )
    parser.add_argument(
        "--dry-run", "-d",
        action="store_true",
        help="실제 트윗 안 보내고 미리보기만",
    )
    args = parser.parse_args()

    print(f"=== StatScope X Bot ===")
    print(f"명령: {args.command} {'(미리보기)' if args.dry_run else ''}\n")

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
