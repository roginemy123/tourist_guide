import { useState, useEffect } from "react";

function SaveUserLocations(){
    let [map, setMap] = useState(() => {
        return localStorage.getItem("userLocations");
    });
    
    return (map);
}

export default SaveUserLocations;