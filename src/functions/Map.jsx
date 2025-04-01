import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";

function Map() {
  const mapRef = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [currentGuide, setCurrentGuide] = useState(null);
  const markersRef = useRef([]);
  const routeControlRef = useRef(null);
  const markerInstancesRef = useRef({});

  // Function to fetch location name
  const getLocationName = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      if (data.address) {
        const { town, city, village, municipality, state, country } = data.address;
        const locationName = town || city || village || municipality || "Unknown Location";
        return `${locationName}, ${municipality || ""}, ${state || ""} ${country || ""}`.trim();
      }
      return "Unknown Location";
    } catch (error) {
      console.error("Error fetching location name:", error);
      return "Unknown Location";
    }
  };

  // Create route between two points
  const createRoute = (fromLat, fromLng, toLat, toLng, name) => {
    if (routeControlRef.current) {
      mapRef.current.removeControl(routeControlRef.current);
    }

    const routeControl = L.Routing.control({
      waypoints: [
        L.latLng(fromLat, fromLng),
        L.latLng(toLat, toLng),
      ],
      routeWhileDragging: true,
      show: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
    }).addTo(mapRef.current);

    routeControlRef.current = routeControl;

    routeControl.on("routesfound", (e) => {
      const route = e.routes[0];
      setCurrentGuide({
        name,
        distance: (route.summary.totalDistance / 1000).toFixed(1) + " km",
        time: Math.round(route.summary.totalTime / 60) + " min",
      });
    });

    routeControl.on('routingerror', (e) => {
      console.error('Routing error:', e.error);
      alert('Could not calculate route to this location');
    });
  };

  // Handle marker deletion
  const handleDeleteMarker = (markerToDelete) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the marker at ${markerToDelete.name}?`
    );
    
    if (!confirmDelete) return;

    // Remove from markers array
    const updatedMarkers = markers.filter(marker => 
      !(marker.lat === markerToDelete.lat && marker.lng === markerToDelete.lng)
    );
    setMarkers(updatedMarkers);
    localStorage.setItem("userLocations", JSON.stringify(updatedMarkers));

    // Remove from map
    const markerKey = `${markerToDelete.lat},${markerToDelete.lng}`;
    if (markerInstancesRef.current[markerKey]) {
      mapRef.current.removeLayer(markerInstancesRef.current[markerKey]);
      delete markerInstancesRef.current[markerKey];
    }

    // Remove from markersRef
    markersRef.current = markersRef.current.filter(marker => 
      !(marker.lat === markerToDelete.lat && marker.lng === markerToDelete.lng)
    );
  };

  // Load saved markers
  useEffect(() => {
    try {
      const savedLocations = JSON.parse(localStorage.getItem("userLocations"));
      if (Array.isArray(savedLocations)) {
        setMarkers(savedLocations);
      }
    } catch (error) {
      console.error("Error parsing localStorage data:", error);
      localStorage.removeItem("userLocations");
    }
  }, []);

  // Initialize map and get user location
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map("map").setView([10.3157, 123.8854], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          mapRef.current.setView([latitude, longitude], 13);
          setUserLocation({ lat: latitude, lng: longitude });
          L.marker([latitude, longitude])
            .addTo(mapRef.current)
            .bindPopup("You are here!")
            .openPopup();
        },
        (error) => console.error("Error getting location:", error)
      );
    }
  }, []);

  // Handle marker clicks and show route + guide
  useEffect(() => {
    if (mapRef.current && userLocation) {
      // Clear existing markers
      markersRef.current.forEach(marker => {
        const markerKey = `${marker.lat},${marker.lng}`;
        if (markerInstancesRef.current[markerKey]) {
          mapRef.current.removeLayer(markerInstancesRef.current[markerKey]);
        }
      });
      markersRef.current = [];
      markerInstancesRef.current = {};

      // Add new markers
      markers.forEach(({ lat, lng, name }) => {
        const markerKey = `${lat},${lng}`;
        if (!markerInstancesRef.current[markerKey]) {
          const markerInstance = L.marker([lat, lng])
            .addTo(mapRef.current)
            .bindPopup(`<b>${name}</b><br>(${lat.toFixed(6)}, ${lng.toFixed(6)})`);

          markerInstance.on("click", () => {
            if (userLocation) {
              createRoute(userLocation.lat, userLocation.lng, lat, lng, name);
            }
          });

          markerInstancesRef.current[markerKey] = markerInstance;
          markersRef.current.push({ lat, lng });
        }
      });
    }
  }, [markers, userLocation]);

  // Handle map clicks to add new markers
  useEffect(() => {
    if (mapRef.current) {
      const handleMapClick = async (e) => {
        const { lat, lng } = e.latlng;

        if (markers.some((marker) => marker.lat === lat && marker.lng === lng)) {
          alert("This marker already exists!");
          return;
        }

        const confirmSave = window.confirm(
          `Do you want to save this marker at (${lat.toFixed(6)}, ${lng.toFixed(6)})?`
        );

        if (confirmSave) {
          const locationName = await getLocationName(lat, lng);
          const newMarker = { lat, lng, name: locationName };
          const updatedMarkers = [...markers, newMarker];

          setMarkers(updatedMarkers);
          localStorage.setItem("userLocations", JSON.stringify(updatedMarkers));

          const markerKey = `${lat},${lng}`;
          const markerInstance = L.marker([lat, lng])
            .addTo(mapRef.current)
            .bindPopup(`<b>${locationName}</b><br>(${lat.toFixed(6)}, ${lng.toFixed(6)})`)
            .openPopup();

          markerInstance.on("click", () => {
            if (userLocation) {
              createRoute(userLocation.lat, userLocation.lng, lat, lng, locationName);
            }
          });

          markerInstancesRef.current[markerKey] = markerInstance;
          markersRef.current.push({ lat, lng });
        }
      };

      mapRef.current.on("click", handleMapClick);
      return () => mapRef.current.off("click", handleMapClick);
    }
  }, [markers]);

  return (
    <>
      <div id="map" style={{ height: "400px", width: "100%" }}></div>
      
      <div style={{ display: "flex", marginTop: "20px" }}>
        <div style={{ flex: 1 }}>
          <h2>Saved Locations:</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {markers.map((marker, index) => (
              <li 
                key={index} 
                style={{ 
                  padding: "8px", 
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: currentGuide?.name === marker.name ? "#f0f8ff" : "transparent"
                }}
              >
                <div 
                  style={{ cursor: "pointer", flex: 1 }}
                  onClick={() => {
                    if (userLocation) {
                      createRoute(userLocation.lat, userLocation.lng, marker.lat, marker.lng, marker.name);
                    } else {
                      alert("Please wait for your location to be detected");
                    }
                  }}
                >
                  <b>{marker.name}</b> (Lat: {marker.lat.toFixed(4)}, Lng: {marker.lng.toFixed(4)})
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMarker(marker);
                  }}
                  style={{
                    background: "#ff4444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    cursor: "pointer",
                    marginLeft: "10px"
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>

        {currentGuide && (
          <div style={{ flex: 1, padding: "0 20px" }}>
            <h2>Route Guide</h2>
            <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "5px" }}>
              <h3>{currentGuide.name}</h3>
              <p><strong>Distance:</strong> {currentGuide.distance}</p>
              <p><strong>Estimated Time:</strong> {currentGuide.time}</p>
              <p style={{ marginTop: "10px", fontStyle: "italic" }}>
                The route is shown on the map above.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Map;