// components/map/MapView.tsx - Leaflet Map with Check-in Markers + Thailand Regions
'use client'

import { useEffect, useState, useCallback } from 'react'
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

export interface TechnicianLocation {
  id: number
  firstName: string
  lastName: string
  phone?: string
  technicianType?: string
  province?: string
  district?: string
  subDistrict?: string
  avatarPath?: string
  responsibleProvinces?: string[]
}

interface MapViewProps {
  checkins: MapCheckin[]
  technicianLocations?: TechnicianLocation[]
}

// Thailand province centroid coordinates
const PROVINCE_COORDS: Record<string, [number, number]> = {
  'กรุงเทพมหานคร': [13.7563, 100.5018], 'กระบี่': [8.0863, 98.9063], 'กาญจนบุรี': [14.0023, 99.5328],
  'กาฬสินธุ์': [16.4315, 103.5059], 'กำแพงเพชร': [16.4827, 99.5226], 'ขอนแก่น': [16.4419, 102.8360],
  'จันทบุรี': [12.6105, 102.1039], 'ฉะเชิงเทรา': [13.6904, 101.0779], 'ชลบุรี': [13.3611, 100.9847],
  'ชัยนาท': [15.1851, 100.1251], 'ชัยภูมิ': [15.8068, 101.9223], 'ชุมพร': [10.4930, 99.1800],
  'เชียงราย': [19.9105, 99.8406], 'เชียงใหม่': [18.7883, 98.9853], 'ตรัง': [7.5591, 99.6114],
  'ตราด': [12.2428, 102.5176], 'ตาก': [16.8798, 99.1257], 'นครนายก': [14.2069, 101.2132],
  'นครปฐม': [13.8199, 100.0624], 'นครพนม': [17.3923, 104.7691], 'นครราชสีมา': [14.9799, 102.0978],
  'นครศรีธรรมราช': [8.4320, 99.9631], 'นครสวรรค์': [15.7047, 100.1371], 'นนทบุรี': [13.8591, 100.5159],
  'นราธิวาส': [6.4255, 101.8253], 'น่าน': [18.7836, 100.7783], 'บึงกาฬ': [18.3609, 103.6462],
  'บุรีรัมย์': [14.9951, 103.1116], 'ปทุมธานี': [14.0208, 100.5250], 'ประจวบคีรีขันธ์': [11.7997, 99.7979],
  'ปราจีนบุรี': [14.0519, 101.3713], 'ปัตตานี': [6.8695, 101.2530], 'พระนครศรีอยุธยา': [14.3692, 100.5877],
  'พะเยา': [19.1664, 99.9013], 'พระแสง': [8.7726, 99.0965], 'พังงา': [8.4509, 98.5259],
  'พัทลุง': [7.6167, 100.0742], 'พิจิตร': [16.4428, 100.3487], 'พิษณุโลก': [16.8211, 100.2659],
  'เพชรบุรี': [13.1119, 99.9390], 'เพชรบูรณ์': [16.4189, 101.1591], 'แพร่': [18.1445, 100.1403],
  'ภูเก็ต': [7.9519, 98.3381], 'มหาสารคาม': [16.1851, 103.3025], 'มุกดาหาร': [16.5437, 104.7234],
  'แม่ฮ่องสอน': [19.2985, 97.9654], 'ยโสธร': [15.7924, 104.1456], 'ยะลา': [6.5413, 101.2803],
  'ร้อยเอ็ด': [16.0538, 103.6520], 'ระนอง': [9.9527, 98.6087], 'ระยอง': [12.6843, 101.2816],
  'ราชบุรี': [13.5282, 99.8134], 'ลพบุรี': [14.7995, 100.6534], 'ลำปาง': [18.2888, 99.4928],
  'ลำพูน': [18.5744, 99.0087], 'เลย': [17.4860, 101.7223], 'ศรีสะเกษ': [15.1186, 104.3220],
  'สกลนคร': [17.1555, 104.1348], 'สงขลา': [7.1897, 100.5950], 'สตูล': [6.6238, 100.0677],
  'สมุทรปราการ': [13.5991, 100.5998], 'สมุทรสงคราม': [13.4098, 100.0024], 'สมุทรสาคร': [13.5478, 100.2795],
  'สระแก้ว': [13.8239, 102.0641], 'สระบุรี': [14.5289, 100.9101], 'สิงห์บุรี': [14.8936, 100.3969],
  'สุโขทัย': [17.0062, 99.8265], 'สุพรรณบุรี': [14.4744, 100.1177], 'สุราษฎร์ธานี': [9.1382, 99.3217],
  'สุรินทร์': [14.8830, 103.4937], 'หนองคาย': [17.8782, 102.7415], 'หนองบัวลำภู': [17.2218, 102.4261],
  'อ่างทอง': [14.5896, 100.4549], 'อำนาจเจริญ': [15.8654, 104.6257], 'อุดรธานี': [17.4138, 102.7871],
  'อุตรดิตถ์': [17.6204, 100.0993], 'อุทัยธานี': [15.3835, 100.0245], 'อุบลราชธานี': [15.2284, 104.8563],
}

// Bounds covering Thailand (SW corner to NE corner)
const THAILAND_BOUNDS: [[number, number], [number, number]] = [
  [5.5, 97.3],   // Southwest - southern tip
  [20.5, 105.7], // Northeast - northern tip
]

// maxBounds: slightly padded so Thailand always stays in view, no scrolling to far areas
const THAILAND_MAX_BOUNDS: [[number, number], [number, number]] = [
  [4.0, 95.5],   // SW with padding
  [21.5, 107.5], // NE with padding
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

// Insource = teal, Outsource = purple
const TECH_COLORS = {
  INSOURCE:  { grad0: '#5eead4', grad1: '#0d9488', text: '#0d9488' },
  OUTSOURCE: { grad0: '#d8b4fe', grad1: '#7c3aed', text: '#7c3aed' },
}

function createTechnicianHomeIcon(initials: string, avatarUrl?: string | null, techType?: string): L.DivIcon {
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || ''
  const colors = techType === 'OUTSOURCE' ? TECH_COLORS.OUTSOURCE : TECH_COLORS.INSOURCE
  const gradId = `pin-tech-${techType === 'OUTSOURCE' ? 'out' : 'in'}`

  // SVG pin shape — no innerContent, avatar/initials overlaid as HTML
  const svgPin = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="36" viewBox="0 0 38 52" style="display:block;">
    <defs>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${colors.grad0};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${colors.grad1};stop-opacity:1" />
      </linearGradient>
      <filter id="shadow-th" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
    </defs>
    <path d="M19 0C8.51 0 0 8.51 0 19c0 14.25 19 33 19 33s19-18.75 19-33C38 8.51 29.49 0 19 0z"
          fill="url(#${gradId})" filter="url(#shadow-th)" />
    <circle cx="19" cy="18" r="16" fill="white" opacity="0.9"/>
    ${!avatarUrl ? `<text x="19" y="18" text-anchor="middle" dominant-baseline="central"
        font-size="11" font-weight="700" fill="${colors.text}"
        font-family="Arial,Helvetica,sans-serif">${initials}</text>` : ''}
  </svg>`

  // Avatar image overlaid with absolute positioning (avoids foreignObject browser issues)
  const avatarHtml = avatarUrl
    ? `<img src="${apiBase}${avatarUrl}"
          style="position:absolute;top:2px;left:3px;width:20px;height:20px;
                 border-radius:50%;object-fit:cover;pointer-events:none;"
          onerror="this.style.display='none'" />`
    : ''

  const html = `<div style="position:relative;width:26px;height:36px;">${svgPin}${avatarHtml}</div>`

  return L.divIcon({
    className: 'custom-marker',
    html,
    iconSize: [26, 36],
    iconAnchor: [13, 36],
    popupAnchor: [0, -34],
  })
}

function createPinIcon(status: string, initials: string, avatarUrl?: string | null): L.DivIcon {
  const color = statusColorMap[status] || statusColorMap['PENDING']
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || ''

  // SVG pin shape — initials stay in SVG, avatar overlaid as HTML <img>
  const svgPin = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="52" viewBox="0 0 38 52" style="display:block;">
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
    ${!avatarUrl ? `<text x="19" y="18" text-anchor="middle" dominant-baseline="central"
        font-size="14" font-weight="700" fill="${color.hex}"
        font-family="Arial,Helvetica,sans-serif">${initials}</text>` : ''}
  </svg>`

  const avatarHtml = avatarUrl
    ? `<img src="${apiBase}${avatarUrl}"
          style="position:absolute;top:2px;left:3px;width:32px;height:32px;
                 border-radius:50%;object-fit:cover;pointer-events:none;"
          onerror="this.style.display='none'" />`
    : ''

  const html = `<div style="position:relative;width:38px;height:52px;">${svgPin}${avatarHtml}</div>`

  return L.divIcon({
    className: 'custom-marker',
    html,
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

// Region legend — collapsible on mobile, always-open on desktop
function RegionLegend() {
  const [open, setOpen] = useState(false)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  return (
    <div style={{
      position: 'absolute',
      bottom: '12px',
      right: '10px',
      zIndex: 1000,
    }}>
      {/* Toggle button — visible only on mobile */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: isMobile ? 'flex' : 'none',
          alignItems: 'center',
          gap: '5px',
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '5px 10px',
          fontSize: '11px',
          fontWeight: 700,
          color: '#334155',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          marginBottom: open ? '6px' : '0',
        }}
      >
        <span style={{
          width: '10px', height: '10px', borderRadius: '2px',
          background: 'linear-gradient(135deg,#86efac,#6366f1)',
          display: 'inline-block',
        }} />
        ภูมิภาค {open ? '▲' : '▼'}
      </button>

      {/* Legend body */}
      <div style={{
        display: isMobile ? (open ? 'block' : 'none') : 'block',
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '8px',
        padding: isMobile ? '7px 10px' : '10px 14px',
        fontSize: isMobile ? '11px' : '12px',
        lineHeight: '1.7',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        border: '1px solid #e2e8f0',
      }}>
        {!isMobile && (
          <div style={{ fontWeight: 700, marginBottom: '4px', color: '#334155' }}>ภูมิภาค</div>
        )}
        {Object.values(regionColors).map((r) => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              width: isMobile ? '10px' : '13px',
              height: isMobile ? '10px' : '13px',
              borderRadius: '2px',
              backgroundColor: r.fill,
              border: '1px solid #cbd5e1',
              display: 'inline-block',
              flexShrink: 0,
            }} />
            <span style={{ color: '#475569' }}>{r.labelTh}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MapView({ checkins, technicianLocations = [] }: MapViewProps) {
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
        maxBounds={THAILAND_MAX_BOUNDS}
        maxBoundsViscosity={1.0}
        minZoom={5}
        maxZoom={16}
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

        {/* Check-in markers */}
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
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>
                    {c.storeCode} {c.storeName}
                  </div>
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

        {/* Technician home location markers */}
        {technicianLocations.map((tech) => {
          // Use tech.province first; fall back to responsibleProvinces[0] for outsource techs
          const displayProvince = tech.province ||
            (tech.responsibleProvinces && tech.responsibleProvinces.length > 0 ? tech.responsibleProvinces[0] : null)
          const coords = displayProvince ? PROVINCE_COORDS[displayProvince] : null
          if (!coords) return null
          const usingFallback = !tech.province && !!displayProvince
          const initials = `${tech.firstName?.[0] || ''}${tech.lastName?.[0] || ''}`.toUpperCase()
          const isOutsource = tech.technicianType === 'OUTSOURCE'
          const pinColor = isOutsource ? '#7c3aed' : '#0d9488'
          // Slight jitter to avoid exact overlap when multiple techs in same province
          const jitter = (tech.id % 20) * 0.015 - 0.15
          const pos: [number, number] = [coords[0] + jitter, coords[1] + jitter]
          return (
            <Marker
              key={`tech-${tech.id}`}
              position={pos}
              icon={createTechnicianHomeIcon(initials, tech.avatarPath, tech.technicianType)}
            >
              <Tooltip direction="top" offset={[0, -34]} opacity={0.95}>
                <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                  <strong>{tech.firstName} {tech.lastName}</strong>
                  {isOutsource && <span style={{ color: '#a78bfa', marginLeft: '4px', fontSize: '10px' }}>(Outsource)</span>}
                  <br />
                  {displayProvince}{tech.district ? ` • ${tech.district}` : ''}
                  {usingFallback && <span style={{ color: '#9ca3af' }}> (พื้นที่รับผิดชอบ)</span>}
                </div>
              </Tooltip>
              <Popup>
                <div style={{
                  minWidth: '200px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  borderLeft: `4px solid ${pinColor}`,
                  paddingLeft: '12px',
                }}>
                  <div style={{ marginBottom: '6px' }}>
                    <span style={{
                      backgroundColor: pinColor,
                      color: 'white',
                      padding: '2px 10px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}>
                      {isOutsource ? 'ช่าง Outsource' : 'ช่างเทคนิค'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                    {tech.firstName} {tech.lastName}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {tech.phone && (
                        <tr>
                          <td style={{ color: '#888', paddingRight: '8px', paddingBottom: '3px', whiteSpace: 'nowrap' }}>โทร</td>
                          <td style={{ paddingBottom: '3px' }}>{tech.phone}</td>
                        </tr>
                      )}
                      {displayProvince && (
                        <tr>
                          <td style={{ color: '#888', paddingRight: '8px', paddingBottom: '3px', whiteSpace: 'nowrap' }}>
                            {usingFallback ? 'พื้นที่รับผิดชอบ' : 'ที่อยู่'}
                          </td>
                          <td style={{ paddingBottom: '3px' }}>
                            {tech.province
                              ? [tech.subDistrict, tech.district, tech.province].filter(Boolean).join(', ')
                              : displayProvince}
                          </td>
                        </tr>
                      )}
                      {tech.technicianType && (
                        <tr>
                          <td style={{ color: '#888', paddingRight: '8px', paddingBottom: '3px', whiteSpace: 'nowrap' }}>ประเภท</td>
                          <td style={{ paddingBottom: '3px' }}>{tech.technicianType === 'INSOURCE' ? 'In-house' : 'Outsource'}</td>
                        </tr>
                      )}
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
