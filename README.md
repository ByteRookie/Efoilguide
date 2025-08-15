# Online Efoil Guide

A community‑maintained directory of eFoil spots. The site loads all location data from [`data/locations.csv`](data/locations.csv) and renders it in a filterable table and map.

## Add a location
1. Fork this repository.
2. Add a new line to `data/locations.csv` using the existing headers:
   `id,gem,name,city,addr,lat,lng,water,season,skill,launch,parking,amenities,pros,cons,pop,best,gear,tips,law`
   * `skill` uses `|` to separate levels (e.g. `B|I|A`).
   * Wrap text that contains commas in double quotes.
   * Cite rules or facts with `{{Citation: "text" SourceName: "Name" SourceURL: "URL"}}`. Multiple citations can appear in any field; they will render as small source bubbles.
3. Commit your changes and open a pull request describing the new spot.

The guide is published via GitHub Pages. After your pull request is merged, the new location will appear on [the live site](https://github.com/). (Replace with the repository's GitHub Pages URL.)

## Local development
No build step is required. Open `index.html` in a browser or serve the folder with any static file server.
