# Online Efoil Guide

The Online Efoil Guide is a community-maintained list of efoil locations. The live guide is available on GitHub Pages:
https://<your-github-username>.github.io/Efoilguide/

## Adding a location

1. Fork this repository and clone it to your machine.
2. Open `data/locations.csv`.
3. Add a new line using the format:
   ```csv
   id,name,image,location,location_source,location_url,address,address_source,address_url,pros,pros_source,pros_url,cons,cons_source,cons_url,rules,rules_source,rules_url
   ```
   - `id` – short identifier using letters and dashes.
   - `name` – location name.
   - `image` – URL of a photo representing the spot.
   - `location` – city/region description.
   - `location_source` and `location_url` – reference for the location description.
   - `address` – street address without commas.
   - `address_source` and `address_url` – reference for the address.
   - `pros` – semicolon-separated list of positives.
   - `pros_source` and `pros_url` – reference for the pros.
   - `cons` – semicolon-separated list of negatives.
   - `cons_source` and `cons_url` – reference for the cons.
   - `rules` – important rules or regulations.
   - `rules_source` and `rules_url` – reference for the rules.
4. Preview `index.html` in a browser to make sure your entry looks right.
5. Commit your changes and open a pull request to have the location added to the guide.

## Development

The site uses plain HTML, CSS and JavaScript. All location data comes from `data/locations.csv`, keeping rules and their sources in a single file that can be easily updated.
