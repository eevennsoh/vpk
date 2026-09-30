// Artifact build hook for /awake. The Artifacts viewer's connect-src CSP blocks Open-Meteo,
// so the build embeds an hourly forecast for the preset cities and weather requests fall
// back to the forecast hour matching the current time. City search still needs the network.
import { invokeInBanner } from "../artifact-runtime.mjs";

// The `current` fields useCurrentWeather requests, fetched hourly for the embedded forecast.
export const WEATHER_FIELDS = ["temperature_2m", "apparent_temperature", "relative_humidity_2m", "weather_code", "is_day"];
// Open-Meteo's maximum forecast range; the fallback covers this long after each build.
const FORECAST_DAYS = 16;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Wraps fetch so a failed Open-Meteo forecast request is answered from the embedded
 * forecast, shaped like Open-Meteo's `current` block. Live requests are always tried first,
 * and hours outside the forecast still fail rather than show stale values.
 * Self-contained: serialized into the bundle banner.
 */
export function installForecastFallback(forecast, scope = globalThis) {
	const hourMs = 60 * 60 * 1000;
	const nativeFetch = scope.fetch.bind(scope);
	const forecastCurrent = (url) => {
		const series = forecast.locations[`${url.searchParams.get("latitude")},${url.searchParams.get("longitude")}`];
		const hour = Math.floor((Date.now() - forecast.start) / hourMs);
		if (!series || hour < 0 || hour >= forecast.hours) return null;
		const current = { time: new Date(forecast.start + hour * hourMs).toISOString().slice(0, 16) };
		for (const field of forecast.fields) current[field] = series[field][hour];
		return current;
	};
	scope.fetch = async (input, init) => {
		let url;
		try {
			url = new URL(typeof input === "string" ? input : input.url ?? String(input));
		} catch {
			return nativeFetch(input, init);
		}
		if (url.origin !== "https://api.open-meteo.com" || url.pathname !== "/v1/forecast") return nativeFetch(input, init);
		try {
			return await nativeFetch(input, init);
		} catch (error) {
			const current = init?.signal?.aborted ? null : forecastCurrent(url);
			if (!current) throw error;
			return new Response(JSON.stringify({ current }), { headers: { "Content-Type": "application/json" } });
		}
	};
}

/**
 * Fetches the hourly forecast for every city in one multi-location request. Series are
 * keyed by the "latitude,longitude" strings useCurrentWeather puts in its request URL.
 */
async function fetchWeatherForecast(cities, fetchOk) {
	const url = new URL("https://api.open-meteo.com/v1/forecast");
	url.searchParams.set("latitude", cities.map((city) => city.latitude.toString()).join(","));
	url.searchParams.set("longitude", cities.map((city) => city.longitude.toString()).join(","));
	url.searchParams.set("hourly", WEATHER_FIELDS.join(","));
	url.searchParams.set("forecast_days", String(FORECAST_DAYS));
	url.searchParams.set("timezone", "GMT");
	const body = await (await fetchOk(url)).json();
	const results = Array.isArray(body) ? body : [body];
	const times = results[0].hourly.time;
	const locations = Object.fromEntries(cities.map((city, index) => [
		`${city.latitude},${city.longitude}`,
		Object.fromEntries(WEATHER_FIELDS.map((field) => [field, results[index].hourly[field]])),
	]));
	return { fields: WEATHER_FIELDS, hours: times.length, locations, start: Date.parse(`${times[0]}Z`) };
}

export async function prepare({ fetchOk, loadSourceModule }) {
	const { PRESET_CITIES } = await loadSourceModule(`export { PRESET_CITIES } from "@/components/arts/awake/preset-cities";`);
	const forecast = await fetchWeatherForecast(PRESET_CITIES, fetchOk);
	const forecastEnd = new Date(forecast.start + forecast.hours * HOUR_MS).toISOString().slice(0, 16);
	return {
		banner: invokeInBanner(installForecastFallback, forecast),
		summary: `Embedded weather forecast: ${Object.keys(forecast.locations).length} cities, hourly until ${forecastEnd} UTC (rebuild before then)`,
	};
}
