# MMM-InterestRates

MagicMirror module that displays a configured list of interest rate series from the St. Louis Fed FRED API.

All FRED API requests are executed in `node_helper.js` so the frontend rendering stays responsive. The module fetches data at startup and refreshes hourly by default.

## Features

- Fetches one or more FRED `series_id` values you configure.
- Uses node helper networking only (no browser-side API fetches).
- Updates immediately at startup, then on a fixed interval (default 1 hour).
- Applies trend colors from the most recent movement:
	- Red when the latest value increased.
	- Green when the latest value decreased.
- Handles partial failures per series without breaking the whole module.

## Installation

1. Change to your MagicMirror modules directory.
2. Clone this repository as `MMM-InterestRates`.
3. Add the module config to your `config/config.js`.
4. Restart MagicMirror.

## Configuration

Add this block in `config/config.js`:

```js
{
	module: "MMM-InterestRates",
	position: "top_right",
	config: {
		apiKey: "YOUR_FRED_API_KEY",
		updateInterval: 60 * 60 * 1000,
		decimals: 2,
		showTrendDelta: true,
		showLastUpdated: true,
		title: "Interest Rates",
		rates: [
			{ seriesId: "DFF", label: "Fed Funds Effective" },
			{ seriesId: "SOFR", label: "SOFR" },
			{ seriesId: "DGS10", label: "10Y Treasury" }
		]
	}
}
```

### Config options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | `""` | Required FRED API key. |
| `updateInterval` | `number` | `3600000` | Refresh interval in milliseconds. |
| `rates` | `array` | Sample list | List of rates to display. Each item should include `seriesId` and optional `label`. |
| `decimals` | `number` | `2` | Number of decimal places when rendering values and deltas. |
| `showTrendDelta` | `boolean` | `true` | Show signed change between latest and previous value. |
| `showLastUpdated` | `boolean` | `true` | Show timestamp of last successful fetch. |
| `title` | `string` | `"Interest Rates"` | Optional title above the rate list. |
| `animationSpeed` | `number` | `1000` | DOM update animation speed in milliseconds. |

## Trend logic

Trend is calculated per series from the two newest valid numeric observations returned by FRED.

- Latest minus previous > 0: `up` (rendered red)
- Latest minus previous < 0: `down` (rendered green)
- Equal values: `flat` (neutral)
- Missing previous numeric point: `unknown` (neutral)

## Notes

- FRED observations may contain non-numeric values (like `"."`); these are skipped.
- If one series fails, successful series are still displayed.
- If `apiKey` is missing or `rates` is empty, the module displays a clear error message.
