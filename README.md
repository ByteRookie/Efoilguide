# Online Efoil Guide

The Online Efoil Guide is a community-maintained list of efoil locations. The live guide is available on GitHub Pages:
https://<your-github-username>.github.io/Efoilguide/

## Adding a location

1. Fork this repository and clone it to your machine.
2. Open `data/locations.csv`.
3. Add a new line using the format:
   ```csv
   id,gem,name,city,addr,lat,lng,water,season,skill,launch,parking,amenities,pros,cons,pop,best,gear,tips,law
   ```
   - `id` – short identifier using letters and dashes.
   - `gem` – `true` if the spot is a hidden gem, otherwise `false`.
   - `skill` – semicolon-separated skill levels (e.g., `B;I;A`).
   - `pros` / `cons` – semicolon-separated lists.
   - Avoid commas in values; use semicolons if needed.
   - To cite a source for any field, append `{{URL}}` to the end of the value.
   - Example: `5 mph limit{{https://www.example.com/rules}}`.
4. Preview `index.html` in a browser to make sure your entry looks right.
5. Commit your changes and open a pull request to have the location added to the guide.

## Development

The site uses plain HTML, CSS and JavaScript. All location data comes from `data/locations.csv`, keeping rules and their sources in a single file that can be easily updated.
