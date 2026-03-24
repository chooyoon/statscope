"""
StatScope YouTube Shorts 자동 생성기
====================================
MLB API에서 데이터를 가져와 세로(9:16) 쇼츠 영상을 자동 생성합니다.

사용법:
    python generate_short.py                    # 어제 경기 하이라이트
    python generate_short.py --type today       # 오늘 경기 프리뷰
    python generate_short.py --type player      # 랜덤 선수 팩트
    python generate_short.py --type korean      # 한국 선수 트래커
"""

import argparse
import asyncio
import json
import os
import sys
import textwrap
from datetime import datetime, timedelta
from pathlib import Path

import edge_tts
import numpy as np
import requests
from moviepy import (
    AudioFileClip,
    ColorClip,
    CompositeVideoClip,
    ImageClip,
    TextClip,
    concatenate_videoclips,
)
from PIL import Image, ImageDraw, ImageFont

# ─── 설정 ────────────────────────────────────────────────
WIDTH, HEIGHT = 1080, 1920  # 9:16 세로
FPS = 30
FONT_PATH = "C:/Windows/Fonts/malgunbd.ttf"
FONT_PATH_REGULAR = "C:/Windows/Fonts/malgun.ttf"
OUTPUT_DIR = Path(__file__).parent / "output"
ASSETS_DIR = Path(__file__).parent / "assets"
OUTPUT_DIR.mkdir(exist_ok=True)

# 색상 테마
COLORS = {
    "bg_dark": (15, 23, 42),       # 남색 배경
    "bg_card": (30, 41, 59),       # 카드 배경
    "accent": (59, 130, 246),      # 파란색 강조
    "accent2": (139, 92, 246),     # 보라색
    "text_white": (255, 255, 255),
    "text_gray": (148, 163, 184),
    "stat_green": (34, 197, 94),
    "stat_red": (239, 68, 68),
    "gold": (250, 204, 21),
}

TTS_VOICE = "ko-KR-SunHiNeural"

# MLB API
MLB_API = "https://statsapi.mlb.com/api/v1"

# 한국 선수 목록 (2025-2026 시즌)
KOREAN_PLAYERS = {
    "김혜성": 664285,
    "이정후": 808967,
    "배지환": 666166,
    "김하성": 673490,
    "류현진": 547943,
    "오승환": 493286,
}


# ─── MLB API 헬퍼 ─────────────────────────────────────────
def fetch_schedule(date_str: str) -> list:
    """특정 날짜의 경기 목록을 가져옴"""
    url = f"{MLB_API}/schedule?date={date_str}&sportId=1&hydrate=team,linescore,decisions"
    resp = requests.get(url, timeout=10)
    data = resp.json()
    games = []
    for date_entry in data.get("dates", []):
        for game in date_entry.get("games", []):
            games.append(game)
    return games


def fetch_standings() -> list:
    """현재 시즌 순위"""
    url = f"{MLB_API}/standings?leagueId=103,104&season=2025&standingsTypes=regularSeason"
    resp = requests.get(url, timeout=10)
    data = resp.json()
    teams = []
    for record in data.get("records", []):
        for team_record in record.get("teamRecords", []):
            teams.append(team_record)
    teams.sort(key=lambda t: float(t.get("winningPercentage", "0")), reverse=True)
    return teams


def fetch_player_stats(player_id: int) -> dict:
    """선수 시즌 스탯"""
    url = f"{MLB_API}/people/{player_id}?hydrate=stats(group=[hitting,pitching],type=season)"
    resp = requests.get(url, timeout=10)
    data = resp.json()
    if data.get("people"):
        return data["people"][0]
    return {}


# ─── 이미지 프레임 생성 (Pillow) ──────────────────────────
def create_frame_image(
    texts: list[dict],
    bg_color=COLORS["bg_dark"],
    show_logo=True,
    show_watermark=True,
) -> np.ndarray:
    """
    Pillow로 한 프레임 이미지를 생성.
    texts: [{"text": str, "y": int, "size": int, "color": tuple, "bold": bool, "center": bool}]
    """
    img = Image.new("RGB", (WIDTH, HEIGHT), bg_color)
    draw = ImageDraw.Draw(img)

    # 배경 그라데이션 효과
    for y in range(HEIGHT):
        ratio = y / HEIGHT
        r = int(bg_color[0] * (1 - ratio * 0.3))
        g = int(bg_color[1] * (1 - ratio * 0.3))
        b = int(bg_color[2] * (1 - ratio * 0.2))
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

    # StatScope 로고 (상단)
    if show_logo:
        logo_font = ImageFont.truetype(FONT_PATH, 42)
        draw.text((WIDTH // 2, 120), "StatScope", fill=COLORS["accent"], font=logo_font, anchor="mm")
        # 로고 아래 작은 라인
        draw.line([(WIDTH // 2 - 80, 150), (WIDTH // 2 + 80, 150)], fill=COLORS["accent"], width=3)

    # 텍스트 렌더링
    for item in texts:
        text = item["text"]
        y_pos = item.get("y", HEIGHT // 2)
        size = item.get("size", 48)
        color = item.get("color", COLORS["text_white"])
        bold = item.get("bold", False)
        center = item.get("center", True)

        font_file = FONT_PATH if bold else FONT_PATH_REGULAR
        font = ImageFont.truetype(font_file, size)

        if center:
            # 긴 텍스트 자동 줄바꿈
            max_chars = max(10, (WIDTH - 120) // (size // 2))
            lines = textwrap.wrap(text, width=max_chars)
            for i, line in enumerate(lines):
                line_y = y_pos + i * (size + 12)
                draw.text((WIDTH // 2, line_y), line, fill=color, font=font, anchor="mm")
        else:
            draw.text((80, y_pos), text, fill=color, font=font)

    # 워터마크 (하단)
    if show_watermark:
        wm_font = ImageFont.truetype(FONT_PATH_REGULAR, 30)
        draw.text(
            (WIDTH // 2, HEIGHT - 100),
            "statscope.vercel.app",
            fill=COLORS["text_gray"],
            font=wm_font,
            anchor="mm",
        )

    return np.array(img)


def create_stat_card_frame(
    title: str,
    stats: list[dict],
    subtitle: str = "",
) -> np.ndarray:
    """통계 카드 스타일 프레임 생성"""
    img = Image.new("RGB", (WIDTH, HEIGHT), COLORS["bg_dark"])
    draw = ImageDraw.Draw(img)

    # 배경 그라데이션
    for y in range(HEIGHT):
        ratio = y / HEIGHT
        r = int(COLORS["bg_dark"][0] * (1 - ratio * 0.3))
        g = int(COLORS["bg_dark"][1] * (1 - ratio * 0.3))
        b = int(COLORS["bg_dark"][2] * (1 - ratio * 0.2))
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

    # StatScope 로고
    logo_font = ImageFont.truetype(FONT_PATH, 42)
    draw.text((WIDTH // 2, 120), "StatScope", fill=COLORS["accent"], font=logo_font, anchor="mm")

    # 제목
    title_font = ImageFont.truetype(FONT_PATH, 56)
    draw.text((WIDTH // 2, 260), title, fill=COLORS["text_white"], font=title_font, anchor="mm")

    if subtitle:
        sub_font = ImageFont.truetype(FONT_PATH_REGULAR, 36)
        draw.text((WIDTH // 2, 330), subtitle, fill=COLORS["text_gray"], font=sub_font, anchor="mm")

    # 통계 카드들
    card_start_y = 420
    card_height = 160
    card_margin = 20
    card_padding = 40

    for i, stat in enumerate(stats[:6]):
        y = card_start_y + i * (card_height + card_margin)

        # 카드 배경 (둥근 사각형)
        card_rect = [60, y, WIDTH - 60, y + card_height]
        draw.rounded_rectangle(card_rect, radius=20, fill=COLORS["bg_card"])

        # 왼쪽 강조선
        accent_color = stat.get("accent_color", COLORS["accent"])
        draw.rounded_rectangle([60, y, 68, y + card_height], radius=4, fill=accent_color)

        # 스탯 이름
        name_font = ImageFont.truetype(FONT_PATH_REGULAR, 34)
        draw.text((100 + card_padding, y + 35), stat["label"], fill=COLORS["text_gray"], font=name_font)

        # 스탯 값
        value_font = ImageFont.truetype(FONT_PATH, 52)
        value_color = stat.get("value_color", COLORS["text_white"])
        draw.text((WIDTH - 100 - card_padding, y + card_height // 2), str(stat["value"]),
                  fill=value_color, font=value_font, anchor="rm")

    # 워터마크
    wm_font = ImageFont.truetype(FONT_PATH_REGULAR, 30)
    draw.text((WIDTH // 2, HEIGHT - 100), "statscope.vercel.app",
              fill=COLORS["text_gray"], font=wm_font, anchor="mm")

    return np.array(img)


# ─── TTS 생성 ─────────────────────────────────────────────
async def generate_tts(text: str, output_path: str) -> str:
    """Edge TTS로 한국어 음성 생성"""
    communicate = edge_tts.Communicate(text, TTS_VOICE, rate="+10%")
    await communicate.save(output_path)
    return output_path


# ─── 영상 조립 ─────────────────────────────────────────────
def build_video(frames_data: list[dict], tts_text: str, output_name: str) -> str:
    """
    프레임 이미지들 + TTS 나레이션을 조합해 최종 영상 생성.
    frames_data: [{"image": np.ndarray, "duration": float}]
    """
    output_path = str(OUTPUT_DIR / f"{output_name}.mp4")
    tts_path = str(OUTPUT_DIR / f"{output_name}_tts.mp3")

    # TTS 생성
    print("[1/3] TTS 나레이션 생성 중...")
    asyncio.run(generate_tts(tts_text, tts_path))
    audio = AudioFileClip(tts_path)

    # 총 오디오 길이에 맞춰 프레임 duration 조정
    total_audio = audio.duration
    total_frames = len(frames_data)

    # 기본 duration 합계 계산
    base_total = sum(f["duration"] for f in frames_data)
    scale = total_audio / base_total if base_total > 0 else 1

    print("[2/3] 프레임 조립 중...")
    clips = []
    for frame in frames_data:
        duration = frame["duration"] * scale
        duration = max(1.5, min(duration, 10))  # 1.5~10초 범위
        clip = ImageClip(frame["image"]).with_duration(duration)
        clips.append(clip)

    video = concatenate_videoclips(clips, method="compose")

    # 영상 길이를 오디오에 맞춤 (최대 59초)
    final_duration = min(total_audio + 0.5, 59)
    video = video.with_duration(min(video.duration, final_duration))
    video = video.with_audio(audio.subclipped(0, min(audio.duration, video.duration)))

    print("[3/3] 영상 렌더링 중...")
    video.write_videofile(
        output_path,
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        threads=4,
        logger="bar",
    )

    # TTS 임시 파일 정리
    if os.path.exists(tts_path):
        os.remove(tts_path)

    print(f"\n영상 생성 완료: {output_path}")
    return output_path


# ─── 콘텐츠 타입별 생성 ───────────────────────────────────
def generate_game_recap() -> str:
    """어제 경기 결과 요약 쇼츠"""
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    games = fetch_schedule(yesterday)

    if not games:
        print("어제 경기가 없습니다.")
        return ""

    # 가장 점수차가 적은 (접전) 경기 선택
    finished = [g for g in games if g.get("status", {}).get("abstractGameState") == "Final"]
    if not finished:
        print("완료된 경기가 없습니다.")
        return ""

    finished.sort(key=lambda g: abs(
        g.get("teams", {}).get("home", {}).get("score", 0) -
        g.get("teams", {}).get("away", {}).get("score", 0)
    ))

    game = finished[0]
    home = game["teams"]["home"]
    away = game["teams"]["away"]
    home_name = home["team"]["name"]
    away_name = away["team"]["name"]
    home_score = home.get("score", 0)
    away_score = away.get("score", 0)
    winner = home_name if home_score > away_score else away_name

    # 프레임 생성
    frames = []

    # 프레임 1: 인트로
    frames.append({
        "image": create_frame_image([
            {"text": "어제의 빅매치", "y": 500, "size": 52, "color": COLORS["text_gray"]},
            {"text": f"{away_name}", "y": 650, "size": 64, "bold": True},
            {"text": "VS", "y": 780, "size": 80, "color": COLORS["accent"], "bold": True},
            {"text": f"{home_name}", "y": 910, "size": 64, "bold": True},
        ]),
        "duration": 4,
    })

    # 프레임 2: 스코어
    score_color = COLORS["stat_green"] if home_score > away_score else COLORS["stat_red"]
    frames.append({
        "image": create_frame_image([
            {"text": "최종 스코어", "y": 450, "size": 48, "color": COLORS["text_gray"]},
            {"text": f"{away_score}  :  {home_score}", "y": 650, "size": 120, "bold": True, "color": COLORS["gold"]},
            {"text": f"{away_name}  vs  {home_name}", "y": 820, "size": 40, "color": COLORS["text_gray"]},
            {"text": f"{winner} 승리!", "y": 1000, "size": 60, "bold": True, "color": COLORS["stat_green"]},
        ]),
        "duration": 5,
    })

    # 프레임 3: 라인스코어 (이닝별)
    linescore = game.get("linescore", {})
    innings = linescore.get("innings", [])
    if innings:
        inning_texts = []
        inning_texts.append({"text": "이닝별 스코어", "y": 400, "size": 48, "color": COLORS["text_gray"]})
        for idx, inn in enumerate(innings[:9]):
            away_r = inn.get("away", {}).get("runs", 0)
            home_r = inn.get("home", {}).get("runs", 0)
            inning_texts.append({
                "text": f"{idx+1}이닝:  {away_r} - {home_r}",
                "y": 520 + idx * 90,
                "size": 44,
                "color": COLORS["text_white"],
            })
        frames.append({"image": create_frame_image(inning_texts), "duration": 6})

    # 프레임 4: 아웃트로
    frames.append({
        "image": create_frame_image([
            {"text": "더 자세한 분석은", "y": 700, "size": 48, "color": COLORS["text_gray"]},
            {"text": "StatScope", "y": 850, "size": 80, "bold": True, "color": COLORS["accent"]},
            {"text": "에서 확인하세요!", "y": 960, "size": 48, "color": COLORS["text_gray"]},
        ]),
        "duration": 3,
    })

    # TTS 스크립트
    tts = (
        f"어제 열린 {away_name}과 {home_name}의 경기 결과입니다. "
        f"최종 스코어 {away_score} 대 {home_score}. "
        f"{winner}가 승리했습니다. "
        f"더 자세한 세이버메트릭스 분석은 스탯스코프에서 확인하세요."
    )

    date_tag = yesterday.replace("-", "")
    return build_video(frames, tts, f"recap_{date_tag}")


def generate_today_preview() -> str:
    """오늘 경기 프리뷰 쇼츠"""
    today = datetime.now().strftime("%Y-%m-%d")
    games = fetch_schedule(today)

    if not games:
        print("오늘 예정된 경기가 없습니다.")
        return ""

    frames = []

    # 프레임 1: 인트로
    frames.append({
        "image": create_frame_image([
            {"text": f"{today}", "y": 500, "size": 44, "color": COLORS["text_gray"]},
            {"text": "오늘의 MLB", "y": 650, "size": 80, "bold": True},
            {"text": f"총 {len(games)}경기", "y": 800, "size": 56, "color": COLORS["accent"]},
        ]),
        "duration": 3,
    })

    # 프레임 2~: 경기별 매치업
    tts_parts = [f"오늘 MLB에서는 총 {len(games)}경기가 열립니다."]

    for i, game in enumerate(games[:5]):  # 최대 5경기
        home = game["teams"]["home"]["team"]["name"]
        away = game["teams"]["away"]["team"]["name"]
        game_time = game.get("gameDate", "")

        frames.append({
            "image": create_frame_image([
                {"text": f"Game {i + 1}", "y": 450, "size": 40, "color": COLORS["accent"]},
                {"text": away, "y": 650, "size": 60, "bold": True},
                {"text": "@", "y": 770, "size": 50, "color": COLORS["text_gray"]},
                {"text": home, "y": 890, "size": 60, "bold": True},
            ]),
            "duration": 3,
        })
        tts_parts.append(f"{away}가 {home} 원정 경기를 치릅니다.")

    # 아웃트로
    frames.append({
        "image": create_frame_image([
            {"text": "경기 프리뷰와 분석", "y": 700, "size": 48, "color": COLORS["text_gray"]},
            {"text": "StatScope", "y": 850, "size": 80, "bold": True, "color": COLORS["accent"]},
        ]),
        "duration": 3,
    })
    tts_parts.append("각 경기의 상세 프리뷰와 세이버메트릭스 분석은 스탯스코프에서 확인하세요.")

    return build_video(frames, " ".join(tts_parts), f"preview_{today.replace('-', '')}")


def generate_player_fact() -> str:
    """랜덤 선수 팩트 쇼츠"""
    # 리그 리더 가져오기
    url = f"{MLB_API}/stats/leaders?leaderCategories=homeRuns,battingAverage,earnedRunAverage&season=2025&limit=5"
    resp = requests.get(url, timeout=10)
    data = resp.json()

    categories = data.get("leagueLeaders", [])
    if not categories:
        print("리더보드 데이터를 가져올 수 없습니다.")
        return ""

    frames = []
    tts_parts = ["MLB 리그 리더 업데이트!"]

    # 인트로
    frames.append({
        "image": create_frame_image([
            {"text": "2025 MLB", "y": 550, "size": 52, "color": COLORS["text_gray"]},
            {"text": "리그 리더", "y": 700, "size": 80, "bold": True, "color": COLORS["gold"]},
        ]),
        "duration": 3,
    })

    category_names = {"homeRuns": "홈런", "battingAverage": "타율", "earnedRunAverage": "평균자책점"}

    for cat in categories[:3]:
        cat_name = category_names.get(cat.get("leaderCategory"), cat.get("leaderCategory", ""))
        leaders = cat.get("leaders", [])[:5]

        if not leaders:
            continue

        stats_list = []
        for leader in leaders:
            name = leader.get("person", {}).get("fullName", "Unknown")
            value = leader.get("value", "-")
            rank = leader.get("rank", 0)
            stats_list.append({
                "label": f"{rank}. {name}",
                "value": value,
                "accent_color": COLORS["gold"] if rank == 1 else COLORS["accent"],
                "value_color": COLORS["gold"] if rank == 1 else COLORS["text_white"],
            })

        frames.append({
            "image": create_stat_card_frame(
                title=f"{cat_name} TOP 5",
                stats=stats_list,
                subtitle="2025 시즌",
            ),
            "duration": 5,
        })

        top = leaders[0]
        tts_parts.append(
            f"{cat_name} 부문 1위는 {top['person']['fullName']}, {top['value']}입니다."
        )

    # 아웃트로
    frames.append({
        "image": create_frame_image([
            {"text": "실시간 순위와 통계", "y": 700, "size": 48, "color": COLORS["text_gray"]},
            {"text": "StatScope", "y": 850, "size": 80, "bold": True, "color": COLORS["accent"]},
        ]),
        "duration": 3,
    })
    tts_parts.append("더 많은 세이버메트릭스 분석은 스탯스코프에서 확인하세요.")

    return build_video(frames, " ".join(tts_parts), f"leaders_{datetime.now().strftime('%Y%m%d')}")


def generate_korean_tracker() -> str:
    """한국 선수 성적 트래커 쇼츠"""
    frames = []
    tts_parts = ["MLB에서 뛰고 있는 한국 선수들의 최신 성적입니다."]

    # 인트로
    frames.append({
        "image": create_frame_image([
            {"text": "MLB 코리안 리거", "y": 550, "size": 52, "color": COLORS["text_gray"]},
            {"text": "오늘의 성적", "y": 700, "size": 72, "bold": True, "color": COLORS["gold"]},
        ]),
        "duration": 3,
    })

    for name, player_id in KOREAN_PLAYERS.items():
        try:
            player = fetch_player_stats(player_id)
            if not player:
                continue

            full_name = player.get("fullName", name)
            team = player.get("currentTeam", {}).get("name", "")
            position = player.get("primaryPosition", {}).get("abbreviation", "")

            # 스탯 추출
            all_stats = player.get("stats", [])
            stats_list = []

            for stat_group in all_stats:
                splits = stat_group.get("splits", [])
                if splits:
                    season_stats = splits[-1].get("stat", {})

                    if stat_group.get("group", {}).get("displayName") == "hitting":
                        avg = season_stats.get("avg", "-")
                        hr = season_stats.get("homeRuns", "-")
                        rbi = season_stats.get("rbi", "-")
                        ops = season_stats.get("ops", "-")
                        stats_list = [
                            {"label": "타율 (AVG)", "value": avg, "accent_color": COLORS["accent"]},
                            {"label": "홈런 (HR)", "value": str(hr), "accent_color": COLORS["stat_green"]},
                            {"label": "타점 (RBI)", "value": str(rbi), "accent_color": COLORS["accent2"]},
                            {"label": "OPS", "value": ops, "accent_color": COLORS["gold"]},
                        ]
                        tts_parts.append(
                            f"{name}은 현재 타율 {avg}, 홈런 {hr}개, 타점 {rbi}를 기록하고 있습니다."
                        )
                        break

                    elif stat_group.get("group", {}).get("displayName") == "pitching":
                        era = season_stats.get("era", "-")
                        wins = season_stats.get("wins", "-")
                        so = season_stats.get("strikeOuts", "-")
                        whip = season_stats.get("whip", "-")
                        stats_list = [
                            {"label": "평균자책점 (ERA)", "value": era, "accent_color": COLORS["accent"]},
                            {"label": "승수 (W)", "value": str(wins), "accent_color": COLORS["stat_green"]},
                            {"label": "탈삼진 (SO)", "value": str(so), "accent_color": COLORS["accent2"]},
                            {"label": "WHIP", "value": whip, "accent_color": COLORS["gold"]},
                        ]
                        tts_parts.append(
                            f"{name}은 현재 평균자책점 {era}, {wins}승을 기록하고 있습니다."
                        )
                        break

            if stats_list:
                frames.append({
                    "image": create_stat_card_frame(
                        title=name,
                        stats=stats_list,
                        subtitle=f"{team} | {position}",
                    ),
                    "duration": 5,
                })

        except Exception as e:
            print(f"  {name} 데이터 가져오기 실패: {e}")
            continue

    if len(frames) < 2:
        print("한국 선수 데이터를 가져올 수 없습니다 (비시즌일 수 있음).")
        return ""

    # 아웃트로
    frames.append({
        "image": create_frame_image([
            {"text": "한국 선수 실시간 트래킹", "y": 700, "size": 44, "color": COLORS["text_gray"]},
            {"text": "StatScope", "y": 850, "size": 80, "bold": True, "color": COLORS["accent"]},
        ]),
        "duration": 3,
    })
    tts_parts.append("한국 선수들의 더 자세한 분석은 스탯스코프에서 확인하세요.")

    return build_video(frames, " ".join(tts_parts), f"korean_{datetime.now().strftime('%Y%m%d')}")


# ─── 메인 ──────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="StatScope YouTube Shorts 자동 생성기")
    parser.add_argument(
        "--type", "-t",
        choices=["recap", "today", "player", "korean"],
        default="recap",
        help="콘텐츠 유형: recap(어제 경기), today(오늘 프리뷰), player(리그 리더), korean(한국 선수)",
    )
    args = parser.parse_args()

    print(f"=== StatScope Shorts Generator ===")
    print(f"콘텐츠 유형: {args.type}\n")

    generators = {
        "recap": generate_game_recap,
        "today": generate_today_preview,
        "player": generate_player_fact,
        "korean": generate_korean_tracker,
    }

    result = generators[args.type]()
    if result:
        print(f"\n완료! 영상 파일: {result}")
        print("유튜브 쇼츠에 업로드하세요.")
    else:
        print("\n영상 생성에 실패했습니다.")


if __name__ == "__main__":
    main()
