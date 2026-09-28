"""Compute the exact numbers and chart data for the report page (index.html)
from the cleaned data/incarceration_trends.csv, so every number and chart on
the report is reproducible from the same file the dashboard uses.

Writes data/report_findings.json, which js/report.js reads to render the
headline numbers, the 9 finding sections, and the methodology stats.
"""

import json
from pathlib import Path

import pandas as pd

IN_PATH = Path("data/incarceration_trends.csv")
RAW_PATH = Path("data/raw_incarceration_trends_county.csv")
OUT_PATH = Path("data/report_findings.json")


def rate(numerator: float, denominator: float) -> float:
    return numerator / denominator * 100000


def main() -> None:
    df = pd.read_csv(IN_PATH)
    y2019 = df[df.year == 2019]
    y2000 = df[df.year == 2000]

    # --- section 1: jail vs prison trend, 2000-2019 ---
    by_year = df.groupby("year")[["total_jail_pop", "total_prison_pop"]].sum(min_count=1)
    jail_change = (by_year.loc[2019, "total_jail_pop"] / by_year.loc[2000, "total_jail_pop"] - 1) * 100
    prison_change = (by_year.loc[2019, "total_prison_pop"] / by_year.loc[2000, "total_prison_pop"] - 1) * 100

    # --- section 2: racial disparity in jail rate, 2019 ---
    races = ["black", "white", "latinx", "native", "aapi"]
    race_labels = {"black": "Black", "white": "White", "latinx": "Latinx", "native": "Native American", "aapi": "AAPI"}
    race_rates_2019 = {
        r: rate(y2019[f"{r}_jail_pop"].sum(), y2019[f"{r}_pop_15to64"].sum()) for r in races
    }

    # --- section 3: black-white ratio trend, 2000-2019 ---
    ratio_by_year = {}
    for yr, g in df.groupby("year"):
        b = rate(g.black_jail_pop.sum(), g.black_pop_15to64.sum())
        w = rate(g.white_jail_pop.sum(), g.white_pop_15to64.sum())
        ratio_by_year[int(yr)] = round(b / w, 2)

    # --- section 4: urbanicity rates, 2019 ---
    urbanicity_order = ["urban", "suburban", "small/mid", "rural"]
    urbanicity_rates = {}
    for u in urbanicity_order:
        sub = y2019[y2019.urbanicity == u]
        urbanicity_rates[u] = rate(sub.total_jail_pop.sum(), sub.total_pop_15to64.sum())

    # --- section 5: region rates, 2019 ---
    region_order = ["Northeast", "Midwest", "West", "South"]
    region_rates = {}
    for r in region_order:
        sub = y2019[y2019.region == r]
        region_rates[r] = rate(sub.total_jail_pop.sum(), sub.total_pop_15to64.sum())

    # --- section 6: pretrial share trend, 2000-2019 ---
    pretrial_share_by_year = {}
    for yr, g in df.groupby("year"):
        pretrial_share_by_year[int(yr)] = round(g.total_pretrial_custody.sum() / g.total_jail_pop.sum() * 100, 1)

    # --- section 7: female share trend, 2000-2019 ---
    female_share_by_year = {}
    for yr, g in df.groupby("year"):
        female_share_by_year[int(yr)] = round(g.female_jail_pop.sum() / g.total_jail_pop.sum() * 100, 1)

    # --- section 8: overcrowding buckets, 2019 ---
    cap = y2019[(y2019.jail_rated_capacity > 0) & (y2019.total_jail_pop > 0)].copy()
    cap["util_pct"] = cap.total_jail_pop / cap.jail_rated_capacity * 100
    buckets = {
        "Under 80%": ((cap.util_pct < 80).sum()),
        "80-100%": (((cap.util_pct >= 80) & (cap.util_pct < 100)).sum()),
        "100-120%": (((cap.util_pct >= 100) & (cap.util_pct < 120)).sum()),
        "Over 120%": ((cap.util_pct >= 120).sum()),
    }
    pct_over_capacity = round((cap.util_pct > 100).sum() / len(cap) * 100, 1)
    avg_utilization = round(cap.util_pct.mean(), 1)
    n_counties_capacity = len(cap)

    # --- section 9: top 10 counties by incarceration rate, 2019 ---
    big = y2019[y2019.total_pop_15to64 >= 50000].copy()
    big["rate"] = big.total_incarceration / big.total_pop_15to64 * 100000
    top10 = big.nlargest(10, "rate")[["county_name", "state_abbr", "rate"]]
    national_rate_2019 = rate(y2019.total_incarceration.sum(), y2019.total_pop_15to64.sum())

    # --- headline numbers ---
    national_jail_pop_2019 = int(y2019.total_jail_pop.sum())
    bw_ratio_2019 = ratio_by_year[2019]
    pretrial_share_2019 = pretrial_share_by_year[2019]
    n_counties = int(df.county_fips.nunique())

    # --- methodology stats ---
    raw_df = pd.read_csv(RAW_PATH, low_memory=False)
    n_raw = len(raw_df)
    n_after_year_filter = len(raw_df[(raw_df.year >= 2000) & (raw_df.year <= 2019)])
    n_after_null_filter = len(df)
    n_dropped_out_of_window = n_raw - n_after_year_filter
    n_dropped_null_jail = n_after_year_filter - n_after_null_filter

    findings = {
        "headline": [
            {"label": "Average daily jail population, 2019", "value": f"{national_jail_pop_2019:,}"},
            {"label": "Black–white jail incarceration rate ratio, 2019", "value": f"{bw_ratio_2019}×"},
            {"label": "Share of jail population awaiting trial, 2019", "value": f"{pretrial_share_2019}%"},
            {"label": "Counties tracked, 2000–2019", "value": f"{n_counties:,}"},
            {"label": "Counties over rated jail capacity, 2019", "value": f"{pct_over_capacity}%"},
        ],
        "sections": [
            {
                "id": "jail-vs-prison",
                "heading": "Local jails grew even as state prisons leveled off",
                "paragraphs": [
                    f"Between 2000 and 2019, the average daily jail population nationwide rose "
                    f"{jail_change:.1f}%, from {int(by_year.loc[2000,'total_jail_pop']):,} to "
                    f"{int(by_year.loc[2019,'total_jail_pop']):,} people. Over the same period, the "
                    f"state and federal prison population grew far more slowly, {prison_change:.1f}%, "
                    f"from {int(by_year.loc[2000,'total_prison_pop']):,} to "
                    f"{int(by_year.loc[2019,'total_prison_pop']):,}.",
                    "The story of incarceration growth in this century is increasingly a story about "
                    "county jails, not state prisons.",
                ],
                "chart": {
                    "type": "line",
                    "labels": [int(y) for y in by_year.index],
                    "datasets": [
                        {"label": "Jail population", "data": [int(v) for v in by_year.total_jail_pop]},
                        {"label": "Prison population", "data": [int(v) for v in by_year.total_prison_pop]},
                    ],
                },
            },
            {
                "id": "racial-gap",
                "heading": "A stark racial gap in who is jailed",
                "paragraphs": [
                    f"In 2019, Black adults were jailed at a rate of "
                    f"{race_rates_2019['black']:.0f} per 100,000, more than three times the White rate "
                    f"of {race_rates_2019['white']:.0f} per 100,000. Native American adults were also "
                    f"jailed at an elevated rate of {race_rates_2019['native']:.0f} per 100,000, while "
                    f"Latinx adults were jailed at the same rate as White adults "
                    f"({race_rates_2019['latinx']:.0f} per 100,000), and AAPI adults were jailed at a "
                    f"much lower rate of {race_rates_2019['aapi']:.0f} per 100,000.",
                    "These rates are per 100,000 adults age 15-64 of each group, not raw counts, so "
                    "they are directly comparable across groups of very different sizes.",
                ],
                "chart": {
                    "type": "bar",
                    "labels": [race_labels[r] for r in races],
                    "datasets": [{"label": "Jail rate per 100,000 adults", "data": [round(race_rates_2019[r]) for r in races]}],
                },
            },
            {
                "id": "narrowing-gap",
                "heading": "The Black-white jail gap has narrowed, but slowly",
                "paragraphs": [
                    f"The ratio between Black and White jail incarceration rates fell from "
                    f"{ratio_by_year[2000]}× in 2000 to {ratio_by_year[2019]}× in 2019. The "
                    f"gap has closed steadily over two decades, but Black adults were still jailed at "
                    f"more than three times the White rate as of the most recent complete year.",
                ],
                "chart": {
                    "type": "line",
                    "labels": list(ratio_by_year.keys()),
                    "datasets": [{"label": "Black:White jail rate ratio", "data": list(ratio_by_year.values())}],
                },
            },
            {
                "id": "rural-rate",
                "heading": "Rural counties jail people at more than double the urban rate",
                "paragraphs": [
                    f"In 2019, rural counties jailed people at a rate of "
                    f"{urbanicity_rates['rural']:.0f} per 100,000 adults, more than double the urban "
                    f"rate of {urbanicity_rates['urban']:.0f} per 100,000. Small and mid-sized counties "
                    f"sat in between at {urbanicity_rates['small/mid']:.0f} per 100,000, while suburban "
                    f"counties had the lowest rate of the four, {urbanicity_rates['suburban']:.0f} per "
                    f"100,000.",
                    "This pattern is well documented in criminal justice research: rural areas tend to "
                    "have fewer pretrial services and diversion alternatives, so jail is used more often "
                    "as a default.",
                ],
                "chart": {
                    "type": "bar",
                    "labels": [u.capitalize() if u != "small/mid" else "Small/mid" for u in urbanicity_order],
                    "datasets": [{"label": "Jail rate per 100,000 adults", "data": [round(urbanicity_rates[u]) for u in urbanicity_order]}],
                },
            },
            {
                "id": "regional-gap",
                "heading": "Geography matters: the South jails at twice the Northeast's rate",
                "paragraphs": [
                    f"In 2019, the South had a jail incarceration rate of {region_rates['South']:.0f} per "
                    f"100,000 adults, roughly double the Northeast's rate of "
                    f"{region_rates['Northeast']:.0f} per 100,000. The West ({region_rates['West']:.0f}) "
                    f"and Midwest ({region_rates['Midwest']:.0f}) fell in between.",
                ],
                "chart": {
                    "type": "bar",
                    "labels": region_order,
                    "datasets": [{"label": "Jail rate per 100,000 adults", "data": [round(region_rates[r]) for r in region_order]}],
                },
            },
            {
                "id": "pretrial-share",
                "heading": "Most people sitting in jail haven't been convicted of anything",
                "paragraphs": [
                    f"The share of the jail population held pretrial, meaning charged but not yet "
                    f"convicted, rose from {pretrial_share_by_year[2000]}% in 2000 to "
                    f"{pretrial_share_by_year[2019]}% in 2019. By the most recent complete year, nearly "
                    f"two out of every three people in jail on a given day were legally presumed "
                    f"innocent.",
                ],
                "chart": {
                    "type": "line",
                    "labels": list(pretrial_share_by_year.keys()),
                    "datasets": [{"label": "Pretrial share of jail population (%)", "data": list(pretrial_share_by_year.values())}],
                },
            },
            {
                "id": "gender-share",
                "heading": "Women are a small but fast-growing share of the jail population",
                "paragraphs": [
                    f"Women made up {female_share_by_year[2000]}% of the jail population in 2000, "
                    f"rising to {female_share_by_year[2019]}% by 2019. Men remain the large majority of "
                    f"people in jail, but the female share has grown in nearly every year of the last "
                    f"two decades.",
                ],
                "chart": {
                    "type": "line",
                    "labels": list(female_share_by_year.keys()),
                    "datasets": [{"label": "Female share of jail population (%)", "data": list(female_share_by_year.values())}],
                },
            },
            {
                "id": "overcrowding",
                "heading": "Nearly a quarter of counties are jailing more people than their jails are built for",
                "paragraphs": [
                    f"Comparing 2019 jail populations to each jail's rated capacity, {pct_over_capacity}% "
                    f"of the {n_counties_capacity:,} counties reporting a rated capacity exceeded it, "
                    f"and the national average utilization was {avg_utilization}% of rated capacity.",
                ],
                "chart": {
                    "type": "bar",
                    "labels": list(buckets.keys()),
                    "datasets": [{"label": "Number of counties", "data": [int(v) for v in buckets.values()]}],
                },
            },
            {
                "id": "outlier-counties",
                "heading": "A handful of counties post incarceration rates far above the national average",
                "paragraphs": [
                    f"The national incarceration rate (jail plus prison) was about "
                    f"{national_rate_2019:.0f} per 100,000 adults in 2019. Among counties with at least "
                    f"50,000 working-age adults, the highest rate was in "
                    f"{top10.iloc[0].county_name}, {top10.iloc[0].state_abbr} at "
                    f"{top10.iloc[0]['rate']:.0f} per 100,000, more than {top10.iloc[0]['rate']/national_rate_2019:.0f} "
                    f"times the national rate.",
                ],
                "chart": {
                    "type": "bar",
                    "labels": [f"{r.county_name}, {r.state_abbr}" for r in top10.itertuples()],
                    "datasets": [{"label": "Incarceration rate per 100,000", "data": [round(v) for v in top10["rate"]]}],
                    "horizontal": True,
                },
            },
        ],
        "methodology": {
            "n_raw": int(n_raw),
            "n_dropped_out_of_window": int(n_dropped_out_of_window),
            "n_dropped_null_jail": int(n_dropped_null_jail),
            "n_final": int(n_after_null_filter),
            "n_counties": n_counties,
            "n_years": int(df.year.nunique()),
        },
    }

    OUT_PATH.write_text(json.dumps(findings, indent=2))
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
