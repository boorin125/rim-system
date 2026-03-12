// components/map/MapView.tsx - Leaflet Map with Check-in Markers + Thailand Regions
'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, Popup, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { regionColors, getRegion } from './thailand-regions'

interface MapCheckin {
  id: string
  ticketNumber: string
  title: string
  status: string
  latitude: number
  longitude: number
  checkInAt: string
  confirmedAt: string | null
  resolvedAt: string | null
  storeName: string
  storeCode: string
  technicianName: string
  technicianInitials: string
  technicianAvatar?: string | null
}

interface MapViewProps {
  checkins: MapCheckin[]
}

// Bounds covering Thailand (SW corner to NE corner)
const THAILAND_BOUNDS: [[number, number], [number, number]] = [
  [5.5, 97.3],   // Southwest - southern tip
  [20.5, 105.7], // Northeast - northern tip
]

// Colors matching Incident detail page status badges
const statusColorMap: Record<string, { hex: string; text: string }> = {
  OPEN: { hex: '#3b82f6', text: '#60a5fa' },         // blue
  PENDING: { hex: '#3b82f6', text: '#60a5fa' },       // blue
  ASSIGNED: { hex: '#a855f7', text: '#c084fc' },      // purple
  IN_PROGRESS: { hex: '#eab308', text: '#facc15' },   // yellow
  RESOLVED: { hex: '#22c55e', text: '#4ade80' },      // green
  CLOSED: { hex: '#22c55e', text: '#4ade80' },         // green
  OUTSOURCED: { hex: '#06b6d4', text: '#22d3ee' },    // cyan
  CANCELLED: { hex: '#6b7280', text: '#9ca3af' },     // gray
}

const statusLabelMap: Record<string, string> = {
  IN_PROGRESS: 'กำลังดำเนินการ',
  RESOLVED: 'แก้ไขแล้ว',
  CLOSED: 'ปิดงาน',
  ASSIGNED: 'มอบหมายแล้ว',
  OPEN: 'เปิด',
  PENDING: 'รอดำเนินการ',
  OUTSOURCED: 'Outsource',
  CANCELLED: 'ยกเลิก',
}

function createPinIcon(status: string, initials: string, avatarUrl?: string | null): L.DivIcon {
  const color = statusColorMap[status] || statusColorMap['PENDING']
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || ''

  // Inner content: avatar image or initials text
  const innerContent = avatarUrl
    ? `<foreignObject x="3" y="2" width="32" height="32">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:32px;height:32px;border-radius:50%;overflow:hidden;">
          <img src="${apiBase}${avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />
        </div>
      </foreignObject>`
    : `<text x="19" y="18" text-anchor="middle" dominant-baseline="central"
            font-size="14" font-weight="700" fill="${color.hex}"
            font-family="Arial,Helvetica,sans-serif">${initials}</text>`

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="52" viewBox="0 0 38 52">
      <defs>
        <linearGradient id="pin-${status}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color.text};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color.hex};stop-opacity:1" />
        </linearGradient>
        <filter id="shadow-${status}" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)"/>
        </filter>
      </defs>
      <path d="M19 0C8.51 0 0 8.51 0 19c0 14.25 19 33 19 33s19-18.75 19-33C38 8.51 29.49 0 19 0z"
            fill="url(#pin-${status})" filter="url(#shadow-${status})" />
      <circle cx="19" cy="18" r="16" fill="white" opacity="0.9"/>
      ${innerContent}
    </svg>`
  return L.divIcon({
    className: 'custom-marker',
    html: svg,
    iconSize: [38, 52],
    iconAnchor: [19, 52],
    popupAnchor: [0, -48],
  })
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// GeoJSON URL for Thailand province boundaries
const THAILAND_GEOJSON_URL =
  'https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json'

// Style each province feature based on its region
function regionStyle(feature: any) {
  const name = feature?.properties?.name || feature?.properties?.NAME_1 || ''
  const region = getRegion(name)
  const color = regionColors[region] || regionColors['central']
  return {
    fillColor: color.fill,
    fillOpacity: 0.5,
    color: '#94a3b8',    // border color (slate-400)
    weight: 1,
    opacity: 0.6,
  }
}

// Region legend component
function RegionLegend() {
  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      right: '12px',
      zIndex: 1000,
      background: 'rgba(255,255,255,0.92)',
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '12px',
      lineHeight: '1.8',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      border: '1px solid #e2e8f0',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '4px', color: '#334155' }}>ภูมิภาค</div>
      {Object.values(regionColors).map((r) => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            backgroundColor: r.fill,
            border: '1px solid #cbd5e1',
            display: 'inline-block',
            flexShrink: 0,
          }} />
          <span style={{ color: '#475569' }}>{r.labelTh}</span>
        </div>
      ))}
    </div>
  )
}

export default function MapView({ checkins }: MapViewProps) {
  const [geoData, setGeoData] = useState<any>(null)

  useEffect(() => {
    fetch(THAILAND_GEOJSON_URL)
      .then((res) => res.json())
      .then((data) => setGeoData(data))
      .catch((err) => console.error('Failed to load Thailand GeoJSON:', err))
  }, [])

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        bounds={THAILAND_BOUNDS}
        className="h-full w-full rounded-2xl"
        style={{ background: '#f8fafc' }}
      >
        {/* Light theme tiles - CartoDB Positron (white bg, black text) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />
        {/* Thailand labels on top layer */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          pane="overlayPane"
        />

        {/* Thailand regions overlay */}
        {geoData && (
          <GeoJSON
            data={geoData}
            style={regionStyle}
            onEachFeature={(feature, layer) => {
              const name = feature?.properties?.name || feature?.properties?.NAME_1 || ''
              const region = getRegion(name)
              const regionInfo = regionColors[region]
              if (regionInfo) {
                layer.bindTooltip(
                  `<strong>${name}</strong><br/>${regionInfo.labelTh}`,
                  { sticky: true, className: 'region-tooltip' }
                )
              }
            }}
          />
        )}

        {checkins.map((c) => {
          const color = statusColorMap[c.status] || statusColorMap['PENDING']
          return (
            <Marker
              key={c.id}
              position={[c.latitude, c.longitude]}
              icon={createPinIcon(c.status, c.technicianInitials, c.technicianAvatar)}
            >
              <Tooltip direction="top" offset={[0, -48]} opacity={0.95}>
                <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                  <strong>{c.storeCode} {c.storeName}</strong>
                  <br />
                  Check-in: {formatDateTime(c.checkInAt)}
                </div>
              </Tooltip>
              <Popup>
                <div style={{
                  minWidth: '240px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  borderLeft: `4px solid ${color.hex}`,
                  paddingLeft: '12px',
                }}>
                  {/* Status */}
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{
                      backgroundColor: color.hex,
                      color: 'white',
                      padding: '2px 10px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}>
                      {statusLabelMap[c.status] || c.status}
                    </span>
                  </div>
                  {/* Store */}
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>
                    {c.storeCode} {c.storeName}
                  </div>
                  {/* Details table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px' }}>
                    <tbody>
                      <tr>
                        <td style={{ color: '#888', paddingRight: '8px', paddingBottom: '3px', whiteSpace: 'nowrap' }}>Ticket</td>
                        <td style={{ fontWeight: 600, paddingBottom: '3px' }}>{c.ticketNumber}</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#888', paddingRight: '8px', paddingBottom: '3px', whiteSpace: 'nowrap' }}>Title</td>
                        <td style={{ paddingBottom: '3px' }}>{c.title}</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#888', paddingRight: '8px', paddingBottom: '3px', whiteSpace: 'nowrap' }}>Technician</td>
                        <td style={{ paddingBottom: '3px' }}>{c.technicianName}</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#888', paddingRight: '8px', paddingBottom: '3px', whiteSpace: 'nowrap' }}>Check-in</td>
                        <td style={{ paddingBottom: '3px' }}>{formatDateTime(c.checkInAt)}</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#888', paddingRight: '8px', paddingBottom: '3px', whiteSpace: 'nowrap' }}>Resolve</td>
                        <td style={{ paddingBottom: '3px' }}>{c.confirmedAt ? formatDateTime(c.confirmedAt) : '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
      <RegionLegend />
    </div>
  )
}
