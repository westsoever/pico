# Vivino deep research (adversarially verified run)

Run 2026-11-14, workflow `wf_91005b2d-a05`: 5 search angles, 22 sources fetched, 72 claims extracted, top 25 verified by 3 votes each (9 confirmed, 16 refuted). Companion to `research/vivino.md`, which is broader but less strictly verified. Where the two disagree, this note is the stricter one; see "Conflicts with vivino.md".

## Verdict

The verified evidence is thin and mostly first-party (Vivino's own pages, Untappd's own pages, one competitor's blog). It supports Vivino's UX loop. It does not support a full acquisition playbook, and it says nothing about coffee apps. Confidence is stated per finding. Pico implications are inferences, not verified results.

## Verified findings

1. **Taste loop (medium).** Log and rate wines, build a taste profile, see a percentage "Match for You". Vivino's pages say the score appears after about 5 rated wines. Basic matching is free; fuller personalization looks like Premium (inferred from the comparison table). The home-page Taste Profile widget needs "enough" shared taste, threshold unstated. Sources: [complete guide](https://www.vivino.com/en/wine-news/the-complete-guide-to-the-vivino-experience), [home page post](https://www.vivino.com/en/wine-news/the-vivinos-app-home-page-got-more-personal). All first-party marketing.
2. **Rating is kept cheap (medium).** The home page shows a stack of recently scanned wines, a thumbs up or down on unrated ones, and rating plus favoriting on liked ones, so history stays current without searching again. The post is undated and the UI may have changed (a 2026 App Store release mentions a new Wine page and an AI sommelier). Source: [home page post](https://www.vivino.com/en/wine-news/the-vivinos-app-home-page-got-more-personal).
3. **Early-2016 scale, company-reported (medium).** About 14.5M users (13M at end of 2015), 25M goal for end of 2016 (apparently missed; about 21M in late 2016), 8.3M wines, 40.7M ratings, 13M reviews, about 208,000 wineries. Ratings grew far faster than the catalog (2016 to 2018: wines 8.3M to 9.7M, ratings 40.7M to 103.7M). Source: [diginomica, Feb 2016](https://diginomica.com/2016/02/26/uncorking-wine-information-with-ocr-technology-at-vivino/).
4. **Unmatched labels are structural (medium).** A database-matching scan can only match a wine the app already knows, and obscure small-producer bottles miss first. No scanner publishes a verifiable accuracy figure. The only company figure found is a 2013 press release (match rate 48% to 86%, no method, stale). Pico's OCR reads text and does not need a prior match, so its version of the problem is "read but not in the catalog". Other apps fall back to user submission or manual add. Source: [InVintory comparison](https://invintory.com/blog/wine-label-scanner-apps-compared-accuracy-edge-cases-and-best-picks/) (a competitor's blog).
5. **Untappd Local badges (medium, design intent only).** One of three badge types (Sponsored, Local, Core). A Local badge is tied to one venue and works like a loyalty program: venue-bought reward tiers, a map pin, a "Nearby Local Badges" placement on the homepage, nudges near the next level. No verified evidence it raises visits or retention. The one academic study ([Molléri et al., Jan 2026](https://arxiv.org/html/2601.04841v1)) measures no engagement outcomes because Untappd publishes no platform-wide data. Source for the design: [Untappd Lounge, Mar 2023](https://lounge.untappd.com/everything-you-need-to-know-about-untappd-badges/).

## Not established (failed verification, not necessarily false)

- Acquisition channels: SEO, viral loops, retailer partnerships, marketplace economics, paywall mechanics.
- Database bootstrapping: the 5,000-photo start, the corkscrew incentive, 250,000 photos a day, the 50 contractors (these were sourced to Wikipedia and refuted 0-3).
- Growth timeline after 2016, including the often-cited 61M users.
- Vivino Market launch in 2017, 30-day auto-trial, points-then-stars history.
- Image-matching vs OCR as the core of scanning (Vuforia claim, UC Davis blog).
- Untappd "50 to 100 percent more check-ins" (self-reported, no data) and the Flying Saucer case study (no ROI figures).
- Coffee analogues: Beanconqueror, Bean Hunter and Delectable were not covered by any surviving claim.
- Unverified lead: a search snippet from the Creandum investor post says organic growth took off once about 70% of scans succeeded. The page failed to fetch, so treat it as a lead only.

## Conflicts with vivino.md

`research/vivino.md` (earlier session) states the 2011 contest-and-corkscrew start, 2013 to 2021 funding rounds, user numbers up to 78M, and the 99% coverage quote, with sources. This run could not verify the Wikipedia-sourced versions of the same facts. Prefer `vivino.md` where it cites TechCrunch, VentureBeat, Wine Anorak or vivino.com/about directly; prefer this note for anything it marks as confirmed.

## Pico implications (inferences)

1. Make rating or journaling nearly free right after a scan.
2. Show a taste profile and a match score early. Vivino needs about 5 ratings across millions of wines; Pico's threshold with 20 to 100 coffees is unknown.
3. Treat an unmatched bag as the normal case and keep manual add easy.
4. Treat cafe or venue features as a hypothesis to test, not a proven loop.

## Open questions

- What actually drove Vivino's acquisition: scan word of mouth, SEO and wine pages, retailer partnerships, or paid channels? Needs primary sources (founder interviews, Vivino and Creandum blogs, press releases).
- How many logged coffees does Pico need before a taste profile and recommendations feel useful?
- What do real users of coffee apps (Beanconqueror, Bean Hunter, Untappd, Delectable) praise, complain about and keep using, and what gets them to visit a cafe? Needs interviews with Danish specialty-coffee drinkers and roasters.
- Who curates the growing catalog without accounts or a backend, and what happens to a bag the OCR reads but the catalog lacks: private journal entry, community submission, or roaster-supplied data?

## Method and limits

Agent logs: `~/.claude/projects/-Users-lyo-git-westsoever-pico/b9a02e9b-6e6e-4a27-9e12-765a26c1a398/subagents/workflows/wf_91005b2d-a05/journal.jsonl`. Verification was strict, so absence here means "not verified", not "false". Scale figures are company-stated and dated. 8 claims were dropped for budget before verification.
