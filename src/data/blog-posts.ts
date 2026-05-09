export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  readTime: string;
  sections: {
    heading: string;
    paragraphs: string[];
  }[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "model-picks-week3-recap",
    title: "StatScope Model Recap: April 14 Picks — What the Numbers Got Right",
    date: "2026-04-21",
    summary:
      "We posted three picks on April 14 targeting a combined 76% win probability. Here's what the model got right, what went wrong, and why process beats results.",
    tags: ["Picks", "Recap", "Model Performance"],
    readTime: "5 min",
    sections: [
      {
        heading: "The Picks",
        paragraphs: [
          "On April 14, StatScope identified three games with meaningful edges according to our 9-factor model. The Los Angeles Dodgers carried a 79% projected win probability at home against the New York Mets, supported by a dominant lineup wOBA and superior starting pitcher quality. The Pittsburgh Pirates checked in at 74.7% against the Washington Nationals, driven by recent form and home-field advantage. Finally, the Milwaukee Brewers graded out at 72.1% against the Toronto Blue Jays, anchored by bullpen strength and schedule positioning.",
          "Combined, the three picks represented an expected value scenario: if you could replicate these exact matchups 100 times, our model suggested you would win approximately 76% of the bets by betting the favorite on each. But baseball, of course, does not repeat. Each game is singular.",
        ],
      },
      {
        heading: "What Went Right: The Dodgers Win",
        paragraphs: [
          "The Dodgers delivery was textbook. Los Angeles' lineup wOBA of .325 (well above the league average of .315) paired with a Mets offense in decline created the offensive mismatch our model weighted heavily. The starting pitcher advantage—Dodgers starter FIP of 2.85 versus Mets' 3.90—gave Los Angeles the early-inning edge. Home-field advantage (modeled at +6.6 percentage points) provided the final tilt.",
          "Result: Dodgers won 2-1 in a tight game. This was a correct pick driven by correct reasoning: the process was sound, the outcome confirmed it. This is what we want to see in the track record—not every pick winning, but wins clustering around high-probability scenarios and losses clustering around lower ones.",
        ],
      },
      {
        heading: "What Went Wrong: The Pirates and Brewers",
        paragraphs: [
          "The Pirates loss to Washington (5-4) illustrates baseball's inherent variance. Our model weighted the Pirates' recent 10-game form (scoring 5.2 runs/game, allowed 3.8) and home advantage heavily—both genuine statistical edges. Yet a single game is not a large sample. Bullpen collapse, one bad inning, a couple of timely hits—these are noise in the model's inputs but are how games are actually decided.",
          "Similarly, the Brewers fell to Toronto 9-7 despite favorable fundamentals. Strong bullpen depth and recent offensive form suggested Milwaukee should win more often than not. Yet Toronto's lineup connected early, and the Brewers could not mount enough of a counterattack. The model's inputs remained correct; the outcome did not follow.",
        ],
      },
      {
        heading: "The Bigger Picture",
        paragraphs: [
          "This mixed result—one win, two losses on three picks with a combined 76% edge—is exactly what a calibrated model should produce. Over a large sample (50+games), picks with 75% average probability should win approximately 75% of the time. Over three games, we expect noise. Some weeks the model hits 3-for-3; others 1-for-3 or 0-for-3. That volatility is expected.",
          "What matters is whether the model's probabilities are honest. If we claim 75% confidence and win 75% of the time over a full season, the model is calibrated. If we claim 75% and win 60%, we are overconfident. Our /track page logs every pick and tracks calibration continuously, so you can verify these claims yourself.",
          "The process—weighting recent form, starter quality, lineup strength, park factors, and regression to mean—is designed to be correct more often than not. But baseball remains fundamentally uncertain. Process beats results in the long run, but in any given week, results can deceive.",
        ],
      },
    ],
  },

  {
    slug: "park-factors-explained",
    title: "Park Factors Explained: Why Coors Field Changes Everything",
    date: "2026-04-07",
    summary:
      "Not all ballparks are created equal. Learn how elevation, dimensions, and climate inflate or suppress run scoring—and why adjusted stats matter for every analysis.",
    tags: ["Park Factors", "Analytics", "Ballparks"],
    readTime: "6 min",
    sections: [
      {
        heading: "What Is a Park Factor?",
        paragraphs: [
          "A park factor is a multiplier that quantifies how much a ballpark inflates or suppresses run scoring compared to league average. A park factor of 1.10 means the venue produces 10% more runs than a neutral park. A factor of 0.92 means 8% fewer runs. Over many seasons, these differences accumulate and matter significantly.",
          "Park factors are calculated by comparing the average number of runs scored (for both home and visiting teams) in a given park to the league-wide average. The math accounts for the era (deadball vs. steroid era) and controls for the strength of teams playing there. A park's factor remains relatively stable year-to-year because the physical dimensions, elevation, and climate do not change.",
        ],
      },
      {
        heading: "Coors Field: The Extreme Example",
        paragraphs: [
          "Coors Field in Denver sits at 5,280 feet above sea level. The thin air means less air density, which allows balls to travel farther and faster. A ball hit 430 feet in Denver might travel only 420 feet at sea level. Compounding this, Denver's low humidity and warm summers further amplify the ball's carry distance. The result: Coors Field has a run-scoring park factor of approximately 1.15, meaning games there produce roughly 15% more runs than league average.",
          "This inflation affects everything. A hitter at Coors Field will post inflated batting average, home runs, and slugging percentage compared to his true talent. Pitchers give up more hits and more long balls. A team's home ERA at Coors (with visiting pitchers on the road benefiting from the thin air) will appear worse than their true pitching ability. This is why adjusted stats (wRC+, ERA+) are essential for fair player comparison.",
        ],
      },
      {
        heading: "Hitter-Friendly Parks",
        paragraphs: [
          "Beyond Coors, several parks favor offense. Globe Life Field in Arlington (factor ~1.08) plays hot due to warm Texas temperatures. Fenway Park (factor ~1.06) has a short left field wall (the 'Green Monster') that turns potential long flyouts into home runs. Great American Ball Park in Cincinnati (factor ~1.05) also tends to inflate batting lines. When a star hitter plays most games in one of these parks, their raw stats overstate their true talent level.",
        ],
      },
      {
        heading: "Pitcher-Friendly Parks",
        paragraphs: [
          "On the flip side, some parks suppress offense. Oracle Park in San Francisco (factor ~0.92) combines dense marine air with deep outfield dimensions, making home runs rare. Petco Park in San Diego (factor ~0.94) has similar properties: chilly coastal air and spacious gaps. Kauffman Stadium in Kansas City (factor ~0.95) is another pitcher's refuge. Pitchers thriving in these environments appear better than their true talent; those relocated elsewhere see ERA rise.",
        ],
      },
      {
        heading: "Why This Matters for Your Analysis",
        paragraphs: [
          "Park factors directly impact totals (over/under) and moneylines. If two teams play a game at Coors, expect higher scoring and higher totals lines. If the same matchup occurs at Petco, scoring drops. A lineup posting a .320 wOBA at home in Coors Field might project to only .310 wOBA at Petco due to park factor differences. This creates an edge for bettors and analysts who account for it.",
          "StatScope's model includes park factor adjustment in its win-probability calculation. When a high-offensive-power team plays at Coors, we expect more runs and higher scoring. When a dominant pitching staff works in a pitcher-friendly park, we suppress expected offense. Failing to account for park factors is a systematic error that impacts every statistical conclusion.",
        ],
      },
      {
        heading: "Adjusted Stats: The Solution",
        paragraphs: [
          "This is why adjusted stats (wRC+, OPS+, ERA+) exist. They remove park factor bias by normalizing to 100 as league average. A player with a .320 wOBA at Coors might post a wRC+ of 130 (30% above league average after park adjustment). The same player at Petco might have wRC+ of 135 despite a lower raw wOBA, because the park factor makes hits harder to come by. When comparing players across teams, always prefer adjusted stats. When analyzing totals, always factor in the venue.",
        ],
      },
    ],
  },

  {
    slug: "how-to-read-win-probability",
    title: "How to Read a Baseball Win Probability Model",
    date: "2026-04-14",
    summary:
      "What does 75% win probability actually mean? Learn how StatScope builds its model, what the number represents, and how to use it responsibly.",
    tags: ["Analytics", "Model", "Guide"],
    readTime: "7 min",
    sections: [
      {
        heading: "What Does Win Probability Mean?",
        paragraphs: [
          "A win probability of 75% does not mean the favorite will win 75% of the time in this specific game. Baseball games are single events: there is no 75% outcome. Instead, win probability represents a calibrated estimate. If you could observe 100 games where both teams have a 75% vs. 25% projected probability, the 75% team should win approximately 75 times. Probability is about long-run frequency, not individual outcomes.",
          "This distinction matters. A 75% favorite can lose tonight. Probability does not guarantee results; it measures confidence relative to a large sample. The higher the probability assigned to a team, the more statistical edge our model found. But edge does not guarantee victory.",
        ],
      },
      {
        heading: "The Nine Inputs: How StatScope Builds Confidence",
        paragraphs: [
          "StatScope's win-probability model (v2.2) blends nine factors, each weighted by its historical predictive power. First, Pythagorean expectation: a team's run differential, transformed into expected win percentage using the formula (Runs^1.83) / (Runs^1.83 + AllowedRuns^1.83). This provides the baseline.",
          "Second, starter FIP (Fielding Independent Pitching). FIP predicts future ERA better than past ERA, so we weight the starting pitchers' FIP more heavily than their ERA. Third, bullpen ERA: a team's relief staff performance. Fourth, lineup wOBA (Weighted On-Base Average): how effectively the batting order reaches base and advance runners. Fifth, recent form: last-10-game record and run differential, blended with season average.",
          "Sixth, Log5 method: Bill James' formula for head-to-head matchup probability, combining season win percentages in a way that corrects for quality. Seventh, home-field advantage: +6.6 percentage points for the home team, consistent with historical data. Eighth, park factor: whether the venue inflates or suppresses run scoring, weighted by the home team's run-production advantage. Ninth, regression to mean: a 22% pull toward 50%, reflecting baseball's inherent unpredictability.",
        ],
      },
      {
        heading: "Interpreting the Numbers: High, Medium, Low Confidence",
        paragraphs: [
          "The model outputs a win probability (say, 72%), but also a confidence badge. High confidence (probability ≥ 70%) typically means both starters have thrown ≥ 30 innings, both teams have ≥ 40 games played, and underlying stats (team ERA, wOBA) are stable. Moderate confidence (60–70%) suggests some stability but smaller sample sizes or pitcher workload concerns. Low confidence (< 60%) indicates thin data or one-sided starting pitcher advantage.",
          "A 75% pick with high confidence should make you more comfortable than a 65% pick with low confidence. The probability is the model's best estimate, but the confidence badge reflects how much you should trust that estimate.",
        ],
      },
      {
        heading: "What the Model Cannot Do",
        paragraphs: [
          "The model operates on season-to-date data: ERA, wOBA, recent form, and pitcher workload. It does not account for weather, field conditions, or day-of-game roster scratches. It does not see lineup announcement; it uses the team's batting order as currently constructed. It cannot predict an unexpected bullpen meltdown or a surprise hot streak. These are inherent limitations of any pre-game model.",
          "The model is best used as a starting point. Use it to identify mismatches (games where the favorite is undervalued or the underdog is overvalued according to betting markets), but combine it with your own research and the eye test. Model output + human judgment = better decisions than either alone.",
        ],
      },
      {
        heading: "How to Verify the Model Works: The /track Page",
        paragraphs: [
          "Every pick StatScope posts publicly is logged on the /track page, along with actual results, moneyline odds, and whether the pick won. You can see the cumulative record (wins-losses), win rate percentage, ROI (return on a flat $100-per-pick betting strategy), and a calibration curve.",
          "The calibration curve plots our predicted win probability (x-axis) versus actual win rate (y-axis). If the model is calibrated, the curve should follow a diagonal line: picks we said were 60% likely should win ~60%, picks we said were 80% should win ~80%. Deviations indicate the model is over- or under-confident. This transparency allows you to judge for yourself whether the model is trustworthy.",
        ],
      },
      {
        heading: "Final Thoughts",
        paragraphs: [
          "Win probability models are tools, not crystal balls. They summarize complex information into a single number, but they cannot eliminate baseball's fundamental randomness. A 70% favorite loses roughly 30% of the time, and that is not a failure—it is expected. Use the model to find edges and make informed decisions, but always respect the uncertainty inherent in sports.",
        ],
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function sortedBlogPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
