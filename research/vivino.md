# Vivino: why it worked and what Pico should copy

Researched 2026-11-14. Numbers carry their date and source. Unverified points are marked.

## In short

Vivino made one cheap action, photographing a label, return a rating and reviews right away. Over about 15 years those scans built a huge label and ratings database, and a shop was added on top. Commerce came 6–7 years after launch, once there were millions of users.

## Interface and core loop

- **Scan the label** is the main action. Later came a shelf scanner and a restaurant wine-list scanner ([App Store](https://apps.apple.com/us/app/vivino-buy-the-right-wine/id414461255), 2026).
- **Misses go to people.** According to a third party ([Symphony Solutions](https://symphony-solutions.com/insights/vivino-app-a-digital-wine-experience)), labels the app doesn't recognise go to a data team that adds the wine by hand. A 2014 figure of 50 contractors processing 25,000 photos a day is unverified.
- **Coverage claim:** in 2021 the founder said "we can rate 99% of the wines", with 100,000 ratings a day ([Wine Anorak](https://wineanorak.com/2021/11/13/vivino-heini-zacchariassen-on-how-his-app-has-changed-the-world-of-wine/)).
- **Wine page:** community average, number of ratings, taste scales per wine type, flavour mentions, food pairing, price, and where to buy.
- **Match for You:** shown after you rate 5 wines. 70% or more means "likely 4 stars or higher" ([Vivino](https://www.vivino.com/wine-news/introducing-match-for-you)).
- **Needs a user base:** community averages, rating counts, aggregated flavour words, the feed, and probably the match model.
- **Works for one user:** scan, journal, cellar, own taste profile.

## Growth

| Date | Event |
|---|---|
| 2010 | Founded in Copenhagen by Heini Zachariassen and Theis Søndergaard. |
| 2011 | A contest app collected label photos (the prize was a corkscrew), and the iPhone app followed. The founder says it took 12 months to reach 1,000 downloads and 30 months to reach 1 million. They shipped weekly. |
| 2013 | 1 million wines in the database. Raised $10.3M (Balderton, Creandum). Secondary source. |
| 2016 | Raised $25M (SCP Neptune). Secondary source. |
| 2018 | Raised $20M. Users grew from 13M to 29M in two years ([VentureBeat](https://venturebeat.com/business/wine-discovery-app-vivino-raises-20-million-as-its-ecommerce-business-takes-off/)). |
| 2021 | Raised $155M led by Kinnevik, $221M in total. 50M users and 1.5B label photos ([TechCrunch](https://techcrunch.com/2021/02/03/vivino-raises-155-million-for-wine-recommendation-and-marketplace-app/)). The founder called the data "10 years of work". |
| 2026 | 78M+ users, 3.53B scans, 20.5M wines ([vivino.com/about](https://www.vivino.com/about)). |

## Business model

- **Habit first.** The app started as a research tool to build habit and learn about users. Retail partnerships came in 2016 and the marketplace in 2017 ([Modern Retail](https://www.modernretail.co/retailers/this-is-a-land-grab-vivino-ceo-heini-zachariassen-on-the-growing-wine-e-commerce-market/), 2021).
- **Revenue sources:** commission from 500+ third-party merchants, plus data and advertising. The commission rate is not published.
- **Sales size:** about $250–265M of sales in 2020, up from $131M in 2019. It is unclear whether this is revenue or total sales value. Profit was not disclosed.
- **Premium:** launched December 2017 as a free-shipping plan. In 2026 it offers free shipping, an AI sommelier and a wine-list scanner, for about $4.99 a month or $47.90 a year. Subscriber counts are unverified.

## Lessons for Pico

- **What transfers:** scan-first entry, turning every miss into a catalog submission, roasters as the supply side (the counterpart of wineries), and a taste profile built from your own ratings.
- **What doesn't transfer:**
  - Coffee bags change every few weeks, so key coffees on roaster + name + origin.
  - The Copenhagen market is small, so community averages stay thin for a long time.
  - Pico has no backend yet.

**Build next, in order:**
1. Capture misses as submissions.
2. Seed the catalog with roasters.
3. Anonymous shared rating counts.
4. "Match for you" after 5 ratings.
5. Buy links with click tracking.

Skip the feed and premium for now.

## Coffee apps that tried this (status mostly unverified)

- **Coffunity** (2017): crowd-photographed bags through a contest. It had no described business model, and its current status is unknown ([Perfect Daily Grind](https://perfectdailygrind.com/2017/03/coffunity-can-this-app-change-how-we-compare-roasted-coffee/)).
- **Beanhunter:** finds cafés, not bags. Subscription model, weak ratings.
- **Beanconqueror:** open-source brew journal, not a bean database.
- **Siip:** scans a bag and matches it to your palate. Subscription, US-based.
