# Weather Glance Card

At-a-glance weather for Home Assistant wall panels: forecast outlook with
high/low, current temperature and feels like, optional humidity, wind and extra
entity columns (pollen levels, air quality, anything), over a UV bar shaded to
the day's forecast maximum.

The UV row is a nested [bar-lines-card](https://github.com/Blazely-Family/bar-lines-card),
so bars look the same everywhere. **Install bar-lines-card as well**; without
it the card shows a note where the UV bar would be.

## Install

HACS → custom repositories → add this repository's URL as a **Dashboard**
repository, then download it. HACS registers the dashboard resource. Do the same for
bar-lines-card.

## Config

Daily forecast sensors are named with `{d}`, the day index (0 today, 1
tomorrow), as the Bureau of Meteorology integration names them. When today's
high is gone for the evening the outlook shows tomorrow's, marked "Tmrw"; the
UV maximum and window do the same, marked "TMRW".

```yaml
type: custom:weather-glance-card
entity: weather.home                       # opened when the outlook is tapped
tap_action:                                # optional: one HA tap action for the whole card, UV bar included
  action: navigate                         # none, navigate, more-info or fire-dom-event
  navigation_path: /dashboard/weather
forecast:
  icon: sensor.home_mdi_icon_{d}
  high: sensor.home_temp_max_{d}
  low: sensor.home_temp_min_{d}
  low_fallback: sensor.home_now_temp_later  # optional: overnight low once today's has gone
  text: sensor.home_short_text_{d}
temperature: sensor.outdoor_temperature
feels_like: sensor.outdoor_feels_like
humidity: sensor.outdoor_humidity          # optional: leave out to drop the column
wind: sensor.wind_speed                    # optional; attributes `gust` and `bearing` if present
extra:                                     # optional: more columns, one per entity
  - entity: input_text.grass_pollen
    name: Grass                            # default: the entity's name
    icon: mdi:grass                        # default: the entity's icon
    max_age: 24                            # optional: grey the value once unchanged this many hours
    updated_attribute: updated             # optional: attribute with the reading's time (default: last changed)
    colors:                                # optional: icon colour per state, HA colour name or CSS colour
      Low: green
      Moderate: amber
      High: deep-orange
      Extreme: red
    tap_action:                            # optional: this column's own tap action; default is the card's
      action: fire-dom-event               # e.g. open a list-popup summary, anchored to this column
      list_popup: { entity: sensor.example_list }
uv:
  entity: sensor.uv_index                  # UV now
  max: sensor.home_uv_max_index_{d}        # forecast maximum (shading and MAX marker)
  start: sensor.home_uv_start_time_{d}     # protection window, timestamps
  end: sensor.home_uv_end_time_{d}
```

Every column is optional. Leave out `forecast` or `temperature` to drop those
columns, and `uv` to drop the bar and its divider, e.g. for a row of pollen or
air-quality columns on its own.

Columns share the width, so every column added or dropped resizes the rest.
An extra column shows the state as Home Assistant formats it. A colour name
uses Home Assistant's own colour variable, the same names tile cards take
(`green`, `amber`, `deep-orange`, `success`, `error`, ...): `green` becomes
`var(--green-color)`, so the theme decides the exact shade.

It takes the full width and three grid rows by default. Without a `tap_action`,
tapping a column opens its entity and tapping the UV bar opens the UV sensor.
With one, a tap anywhere on the card runs it, unless an extra column has its own.
