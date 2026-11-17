import { showAppAlert } from './appDialogs';
import {hide, show, showAll} from "./Filter.js";
import {allMarkers, blueMarkers, greenMarkers, yellowMarkers, draw} from "./Content1.js";
import {Point,checkInside} from "./PolygonBuilder.js";

// function to update displayed points based on the area of the polygon drawn
function updateMarkers(e) {
    // gets a collection of all points drawn. Look at https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md#getall-featurecollection for more.
    const data = draw.getAll();
    const answer = document.getElementById('filter-by-area');
    if (data.features.length > 0) {
        let polygon = [];
        // these 3 nested for loops are what's required to access inside of a point array of type [long, lat] where long and lat are doubles.
        for (const feature of data.features){
            // get the coordinates of this feature.
            let drawnPoly = feature.geometry.coordinates;
            for (const points of drawnPoly){
                // get the array of points from the coordinates.
                for (const point of points){
                    // get each individual point inside the array of coordinates.
                    // create a Point object using the coordinates of long,lat from point var and push to polygon array.
                    polygon.push(new Point(point[0], point[1]))
                    console.log("Long,Lat of polygon point:");
                    console.log(point[0]);
                    console.log(point[1]);
                    // problem is the first point shows up twice (also at the end) because of how mapbox draw works. Need to remove it at end.
                }
            }
            // pop last item here
            polygon.pop();
            // get number of points inside of the drawn polygon.
            let n = polygon.length;

            // now check every river marker's coordinates to see if it lands inside the drawn shape.
            for (let i = 0; i < blueMarkers.length; i++) {
                // each item in allMarkers contains that point's long,lat as an array on index 1
                var long_lat = blueMarkers[i][2];
                console.log("polygon filtering: ",long_lat)
                // create a Point object from current long,lat of the marker at this index.
                let p = new Point (long_lat[0], long_lat[1]);
                let rivers = document.getElementsByClassName("blue-marker");
                if (checkInside(polygon, n, p)) {
                    // make sure we don't go out of bounds
                    if (rivers.length > i) {
                        rivers[i].style.visibility = "visible";
                    }
                }
                else {
                    if (rivers.length > i) {
                    // point is outside
                        rivers[i].style.visibility = "hidden";
                    }
                }
            }

            // now check every watershed's marker's coordinates to see if it lands inside the drawn shape.
            for (let i = 0; i < greenMarkers.length; i++) {
                // each item in allMarkers contains that point's long,lat as an array on index 1
                var long_lat = greenMarkers[i][2];
                console.log("polygon filtering: ",long_lat)
                // create a Point object from current long,lat of the marker at this index.
                let p = new Point (long_lat[0], long_lat[1]);
                let watersheds = document.getElementsByClassName("green-marker");
                if (checkInside(polygon, n, p)) {
                    if (watersheds.length > i) {
                        watersheds[i].style.visibility = "visible";
                    }
                }
                else {
                    if (watersheds.length > i) {
                    // point is outside
                        watersheds[i].style.visibility = "hidden";
                    }
                }
            }

            // now check every place marker's coordinates to see if it lands inside the drawn shape.
            for (let i = 0; i < yellowMarkers.length; i++) {
                // each item in allMarkers contains that point's long,lat as an array on index 1
                var long_lat = yellowMarkers[i][2];
                console.log("polygon filtering: ",long_lat)
                // create a Point object from current long,lat of the marker at this index.
                let p = new Point (long_lat[0], long_lat[1]);
                let places = document.getElementsByClassName("yellow-marker");

                if (checkInside(polygon, n, p)) {
                    if (places.length > i) {
                        places[i].style.visibility = "visible";
                    }
                }
                else {
                    if (places.length > i) {
                    // point is outside
                        places[i].style.visibility = "hidden";
                    }
                }
            }
        }
    } 
    else {
        answer.innerHTML = '';
        if (e.type !== 'draw.delete')
        showAppAlert('Click the map to draw a polygon.');
        showAll();
    }
}

export default updateMarkers;