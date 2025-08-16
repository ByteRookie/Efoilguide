# Online Efoil Guide

A community‑maintained directory of eFoil spots. The site loads all location data from [`data/locations.csv`](data/locations.csv) and renders it in a filterable table and map.

## Add a location
1. Fork this repository.
2. Add a new line to `data/locations.csv` using the existing headers:  
   `id,name,city,addr,lat,lng,water,season,skill,launch,parking,amenities,pros,cons,pop,best,gear,tips,law`
   * `skill` uses `|` to separate levels (e.g. `B|I|A`).
   * Wrap text that contains commas in double quotes.
   * Cite rules or facts with `{{Citation: "text" SourceName: "Name" SourceURL: "URL"}}`.

### Citation format

Citations let readers verify information about a spot. They can appear in any field that describes regulations, amenities, or other factual claims.

**Basic citation**

```
{{Citation: "Local rule description" SourceName: "Authority Name" SourceURL: "https://example.org/rules"}}
```

**Multiple sources in one citation**

```
{{Citation: "Hydrofoils permitted year-round" SourceName: "City Parks Dept,State Marine Board" SourceURL: "https://city.gov/foils,https://state.gov/marine"}}
```

**Multiple citations in a field**

Fields can contain more than one citation by placing them sequentially:

```
"Launch from the south ramp {{Citation: \"Ramp map\" SourceName: \"Harbor Authority\" SourceURL: \"https://harbor.example\"}} {{Citation: \"Check tide charts\" SourceName: \"NOAA\" SourceURL: \"https://tides.example\"}}"
```

**Example `locations.csv` row**

```
42,Sample Bay,Sampletown,"123 Harbor Rd",47.60,-122.33,flat,Summer,"B|I","South ramp","Lot A","Restrooms","Calm water","Crowded on weekends",Medium,"June","Wing 5.0","Bring extra batteries {{Citation: \"Battery rules\" SourceName: \"Port Authority\" SourceURL: \"https://port.example/rules\"}}","Wear a leash {{Citation: \"Safety advisory\" SourceName: \"State Parks\" SourceURL: \"https://parks.example/safety\"}}"
```

3. Commit your changes and open a pull request describing the new spot.

The guide is published via GitHub Pages. After your pull request is merged, the new location will appear on [the live site](https://byterookie.github.io/Efoilguide/).

## Local development
No build step is required. Open `index.html` in a browser or serve the folder with any static file server.

## License

This project is released under an all rights reserved license; see the [LICENSE](LICENSE) for details.
