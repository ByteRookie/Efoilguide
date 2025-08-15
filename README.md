# Online Efoil Guide

The Online Efoil Guide is a community-maintained list of efoil locations. The live guide is available on GitHub Pages:
https://<your-github-username>.github.io/Efoilguide/

## Adding a location

1. Fork this repository and clone it to your machine.
2. Open `data/locations.csv`.
3. Add a new line using the format:
   ```csv
   id,name,detail,source,source_url
   ```
   - `id` – short identifier using letters and dashes.
   - `name` – location name.
   - `detail` – rule or note about the location (avoid commas).
   - `source` – short label for the reference.
   - `source_url` – link to the source for that detail.
4. Preview `index.html` in a browser to make sure your entry looks right.
5. Commit your changes and open a pull request to have the location added to the guide.

## Development

The site uses plain HTML, CSS and JavaScript. All location data comes from `data/locations.csv`, keeping rules and their sources in a single file that can be easily updated.
