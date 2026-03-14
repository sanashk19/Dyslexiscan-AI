import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { DivIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Create custom icon for doctor names
const createDoctorIcon = (isSelected = false, doctorName = '') => {
  return new DivIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${isSelected ? '#3B82F6' : '#10B981'};
        color: white;
        padding: 3px 6px;
        border-radius: 8px;
        font-size: 10px;
        font-weight: bold;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        border: 2px solid white;
        position: relative;
        z-index: 1000;
      ">
        🏥
      </div>
    `,
    iconSize: [60, 20],
    iconAnchor: [30, 10],
    popupAnchor: [0, -10],
  })
}

// Create user location icon
const createUserIcon = () => {
  return new DivIcon({
    className: 'user-marker',
    html: `
      <div style="
        background-color: #3B82F6;
        color: white;
        padding: 4px 8px;
        border-radius: 50%;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.4);
        border: 3px solid white;
        position: relative;
        z-index: 1001;
      ">
        📍
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  })
}

export default function ConsultationMap({ consultants, selectedConsultant, onConsultantClick, center }) {
  const mapRef = useRef()
  const [userLocation, setUserLocation] = useState(null)
  const [directions, setDirections] = useState(null)
  const [isGettingDirections, setIsGettingDirections] = useState(false)

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }
  }, [])

  // Calculate route using OpenRouteService (free alternative to Google Maps Directions API)
  const getDirections = async (start, end) => {
    setIsGettingDirections(true)
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=false&geometries=geojson`
      )
      const data = await response.json()
      if (data.routes && data.routes[0]) {
        setDirections(data.routes[0].geometry.coordinates)
      }
    } catch (error) {
      console.error('Error getting directions:', error)
    } finally {
      setIsGettingDirections(false)
    }
  }

  // Handle getting directions to selected consultant
  const handleGetDirections = () => {
    if (userLocation && selectedConsultant) {
      getDirections(userLocation, selectedConsultant)
    }
  }

  // Open in Google Maps for navigation
  const openInGoogleMaps = () => {
    if (selectedConsultant) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedConsultant.name + ' ' + selectedConsultant.address)}`
      window.open(url, '_blank')
    }
  }

  // Open in Google Maps for directions
  const openDirectionsInGoogleMaps = () => {
    if (userLocation && selectedConsultant) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${selectedConsultant.lat},${selectedConsultant.lng}&travelmode=driving`
      window.open(url, '_blank')
    }
  }

  useEffect(() => {
    if (center && mapRef.current) {
      mapRef.current.setView([center.lat, center.lng], 12)
    }
  }, [center])

  useEffect(() => {
    if (selectedConsultant && mapRef.current) {
      mapRef.current.setView([selectedConsultant.lat, selectedConsultant.lng], 14)
    }
  }, [selectedConsultant])

  const defaultCenter = [15.4909, 73.8278] // Panaji, Goa

  // Convert directions coordinates for Leaflet
  const routeCoordinates = directions ? directions.map(coord => [coord[1], coord[0]]) : []

  return (
    <div className="relative">
      {/* Navigation Controls */}
      <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 space-y-2">
        <div className="text-xs font-semibold text-gray-700 mb-2">Navigation Options</div>
        
        {userLocation && (
          <div className="text-xs text-green-600 mb-2">
            📍 Your location detected
          </div>
        )}
        
        {selectedConsultant && (
          <div className="space-y-2">
            <button
              onClick={handleGetDirections}
              disabled={!userLocation || isGettingDirections}
              className="w-full bg-blue-600 text-white px-3 py-2 rounded text-xs hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isGettingDirections ? 'Getting Route...' : '�️ Show Route'}
            </button>
            
            <button
              onClick={openDirectionsInGoogleMaps}
              disabled={!userLocation}
              className="w-full bg-green-600 text-white px-3 py-2 rounded text-xs hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              🗺️ Google Directions
            </button>
            
            <button
              onClick={openInGoogleMaps}
              className="w-full bg-gray-600 text-white px-3 py-2 rounded text-xs hover:bg-gray-700 transition-colors"
            >
              🌍 Google Maps
            </button>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="h-96 w-full rounded-lg overflow-hidden border border-gray-200">
        <MapContainer
          ref={mapRef}
          center={center ? [center.lat, center.lng] : defaultCenter}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* User Location Marker */}
          {userLocation && (
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={createUserIcon()}
            >
              <Popup>
                <div className="p-2">
                  <h4 className="font-semibold text-sm">Your Current Location</h4>
                  <p className="text-xs text-gray-600">This is your current position</p>
                </div>
              </Popup>
            </Marker>
          )}
          
          {/* Route Line */}
          {routeCoordinates.length > 0 && (
            <Polyline
              positions={routeCoordinates}
              color="#3B82F6"
              weight={4}
              opacity={0.7}
              dashArray="10, 10"
            />
          )}
          
          {/* Doctor Markers */}
          {consultants.map((consultant) => {
            const isSelected = selectedConsultant?.id === consultant.id
            return (
              <Marker
                key={consultant.id}
                position={[consultant.lat, consultant.lng]}
                icon={createDoctorIcon(isSelected, consultant.name)}
                eventHandlers={{
                  click: () => onConsultantClick(consultant),
                }}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-sm">{consultant.name}</h3>
                    <p className="text-xs text-gray-600">{consultant.specialization}</p>
                    <p className="text-xs text-gray-500">{consultant.address}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs">⭐</span>
                      <span className="text-xs">{consultant.rating}</span>
                      {consultant.verified && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">Verified</span>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
