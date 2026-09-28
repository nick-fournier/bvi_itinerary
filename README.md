# BVI itinerary

Interactive sailing itinerary planner for the British Virgin Islands, served at
https://bvi.nicholasfournier.com.

It's a static site: `site/index.html` loads `site/data/stops.json` (stops, anchorages and
which stops link to which) and the browser does the routing and distance totals.

## Local development

```bash
python -m http.server -d site     # http://localhost:8000
```

## Deploy

Push to `main`. CI builds `nichfournier/bvi:latest`. Then on razz:
`docker compose pull bvi && docker compose up -d bvi` in `clubhouse-server/razz`.
