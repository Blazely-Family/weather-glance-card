# Weather Glance Card

At-a-glance weather for Home Assistant wall panels: forecast outlook with
high/low, current temperature and feels like, humidity and wind, over a UV bar
shaded to the day's forecast maximum.

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
forecast:
  icon: sensor.home_mdi_icon_{d}
  high: sensor.home_temp_max_{d}
  low: sensor.home_temp_min_{d}
  low_fallback: sensor.home_now_temp_later  # optional: overnight low once today's has gone
  text: sensor.home_short_text_{d}
temperature: sensor.outdoor_temperature
feels_like: sensor.outdoor_feels_like
humidity: sensor.outdoor_humidity
wind: sensor.wind_speed                    # attributes `gust` and `bearing` if present
uv:
  entity: sensor.uv_index                  # UV now
  max: sensor.home_uv_max_index_{d}        # forecast maximum (shading and MAX marker)
  start: sensor.home_uv_start_time_{d}     # protection window, timestamps
  end: sensor.home_uv_end_time_{d}
```

It takes the full width and three grid rows by default. Tapping a column opens
its entity; tapping the UV bar opens the UV sensor.
