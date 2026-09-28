"""Download the Vera Institute county-level incarceration data and produce the
cleaned, trimmed file the site (dashboard.html) loads in the browser.

Source: https://github.com/vera-institute/incarceration-trends
One row in the source file = one county in one year (jail and prison
population counts and demographics), 1970-2026.

We keep 2000-2019 only: both jail and prison reporting are reliable and
substantially complete in that window (verified against the raw file).
Before 2000, well under half of counties report jail figures in most years.
After 2019, prison figures stop entirely and jail reporting collapses to a
small fraction of counties (2026 has under 600 of 3,075 counties reporting),
which reflects in-progress/partial data rather than a real population drop.

We also drop any row with a null total_jail_pop: that county simply did not
report a jail population figure for that year.
"""

import sys
from pathlib import Path
from urllib.request import urlretrieve

import pandas as pd

RAW_URL = "https://raw.githubusercontent.com/vera-institute/incarceration-trends/main/incarceration_trends_county.csv"
RAW_PATH = Path("data/raw_incarceration_trends_county.csv")
OUT_PATH = Path("data/incarceration_trends.csv")

KEEP_COLUMNS = [
    "year",
    "county_fips",
    "county_name",
    "state_abbr",
    "region",
    "division",
    "urbanicity",
    "total_pop_15to64",
    "male_pop_15to64",
    "female_pop_15to64",
    "black_pop_15to64",
    "white_pop_15to64",
    "latinx_pop_15to64",
    "native_pop_15to64",
    "aapi_pop_15to64",
    "total_jail_pop",
    "male_jail_pop",
    "female_jail_pop",
    "black_jail_pop",
    "white_jail_pop",
    "latinx_jail_pop",
    "native_jail_pop",
    "aapi_jail_pop",
    "total_pretrial_custody",
    "total_jail_admits",
    "jail_rated_capacity",
    "total_prison_pop",
    "total_incarceration",
    "total_incarceration_rate",
    "total_jail_pop_rate",
    "total_prison_pop_rate",
]


def main() -> None:
    if not RAW_PATH.exists():
        print(f"Downloading raw data from {RAW_URL} ...")
        RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
        urlretrieve(RAW_URL, RAW_PATH)
    else:
        print(f"Using cached raw file at {RAW_PATH}")

    df = pd.read_csv(RAW_PATH, low_memory=False)
    n_raw = len(df)

    df = df[(df.year >= 2000) & (df.year <= 2019)]
    n_after_year_filter = len(df)

    df = df[df.total_jail_pop.notna()]
    n_after_null_filter = len(df)

    df = df[KEEP_COLUMNS]

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)

    print(f"raw rows:                 {n_raw:,}")
    print(f"after year filter 2000-19: {n_after_year_filter:,}")
    print(f"after dropping null jail:  {n_after_null_filter:,}")
    print(f"columns kept:              {len(KEEP_COLUMNS)}")
    print(f"distinct years:            {df.year.nunique()}")
    print(f"distinct counties:         {df.county_fips.nunique()}")
    print(f"wrote {OUT_PATH} ({OUT_PATH.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    sys.exit(main())
