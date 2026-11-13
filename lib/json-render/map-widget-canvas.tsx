"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

export interface MapWidgetMarker {
	id: string;
	lat: number;
	lng: number;
	title: string;
	description?: string | null;
}

export interface MapWidgetCanvasProps {
	center: { lat: number; lng: number };
	zoom: number;
	markers: MapWidgetMarker[];
	activeMarkerId: string;
	onSelectMarker: (markerId: string) => void;
}

export function MapWidgetCanvas({
	center,
	zoom,
	markers,
	activeMarkerId,
	onSelectMarker,
}: Readonly<MapWidgetCanvasProps>) {
	return (
		<MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom className="h-full w-full">
			<TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
			{markers.map((marker) => {
				const isActive = marker.id === activeMarkerId;
				return (
					<CircleMarker
						key={marker.id}
						center={[marker.lat, marker.lng]}
						radius={isActive ? 9 : 7}
						pathOptions={{
							color: isActive ? "#1d4ed8" : "#2563eb",
							fillColor: isActive ? "#1d4ed8" : "#60a5fa",
							fillOpacity: 0.8,
							weight: 2,
						}}
						eventHandlers={{
							click: () => onSelectMarker(marker.id),
						}}
					>
						<Popup>
							<p className="text-sm font-medium text-text">{marker.title}</p>
							{marker.description ? <p className="text-xs text-text-subtle">{marker.description}</p> : null}
						</Popup>
					</CircleMarker>
				);
			})}
		</MapContainer>
	);
}
