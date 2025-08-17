#!/usr/bin/env bash
set -euo pipefail
OUT="data/postal-codes.json"
TMP=$(mktemp -d)
# fetch list of country zip archives
curl -sL https://api.github.com/repos/zauberware/postal-codes-json-xml-csv/contents/data?ref=master \
  | jq -r '.[].download_url' | grep '\.zip$' > "$TMP/urls.txt"
# start empty object
printf '{}' > "$OUT"
# download each archive and merge
while read -r url; do
  fname="$TMP/$(basename "$url")"
  echo "Downloading $url"
  curl -sL "$url" -o "$fname"
  unzip -p "$fname" '*.json' \
    | jq -r '.[] | {(.zipcode): [(.latitude|tonumber), (.longitude|tonumber)]}' \
    | jq -s 'add' > "$TMP/part.json"
  jq -s '.[0] * .[1]' "$OUT" "$TMP/part.json" > "$TMP/merged.json"
  mv "$TMP/merged.json" "$OUT"
done < "$TMP/urls.txt"
rm -r "$TMP"
echo "Saved postal codes to $OUT"
