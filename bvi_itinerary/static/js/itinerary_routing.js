 
 // Itinerary JSON data
const jsonString = JSON.parse(document.getElementById("map_data").textContent);

// Parse the JSON string
var graphData = JSON.parse(jsonString);

 // Function to fetch JSON data from a local file
 async function fetchJSONFile(filename) {
    const response = await fetch(filename);
    return response.json();
}

// Function to calculate the distance between two coordinates in nautical miles using Haversine formula
function calculateDistance(coord1, coord2) {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = (coord2[0] - coord1[0]) * (Math.PI / 180);
    const dLon = (coord2[1] - coord1[1]) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coord1[0] * (Math.PI / 180)) * Math.cos(coord2[0] * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance.toFixed(2);
}

// Function to initialize the Leaflet Map
function initMap() {
    const map = L.map('map').setView([18.42655509420844, -64.61262353817847], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    let selectedPath = [];
    let selectedNodes = new Set();
    let selectedLine;

    // Always display an arrow on the top right corner of the map
    // at an angle of 135 degrees = 225 degrees - 90 degrees (due to the image being rotated 90 degrees)
    // Scale the arrow image to 75px
    // Add the bold words "WIND" in white on top of the arrow and center it horizontally and vertically
    const arrow = L.control({position: 'topright'});
    arrow.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'arrow');
        div.innerHTML = '<img src="/static/images/arrow.png" style="transform: rotate(135deg); width: 75px; height: 75px;"><div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: bold;">WIND</div>';
        return div;
    };
    arrow.addTo(map);

    
    // Create a directed graph using D3
    const svg = d3.select(map.getPanes().overlayPane).append("svg")
        .attr("width", map.getSize().x)
        .attr("height", map.getSize().y);

    const nodes = Object.keys(graphData).map(nodeName => {
        const node = graphData[nodeName];
        const coords = L.latLng(node.coords[0], node.coords[1]);
        return {
            name: nodeName,
            coords: coords,
            mandatory: node.mandatory,
            next: node.next,
            description: node.description,
            anchorages: node.anchorages
        };
    });

    const links = [];
    nodes.forEach(node => {
        node.next.forEach(nextNodeName => {
            const targetNode = nodes.find(n => n.name === nextNodeName);
            links.push({
                source: node,
                target: targetNode
            });
        });
    });


    function clickNode(d) {

        headNode = selectedPath[selectedPath.length - 1] || "Base";
        nextNodes = graphData[headNode].next || ['Base'];
        //headNode = d.name || "Base";

        // If no nodes selected, allow 'Base' and only 'Base' to be selected first
        if (selectedNodes.size === 0 && d.name !== "Base") {
            console.log('First node must be Base');
            return;
        // Skip if the selected node is not a 'next' possible node
        } else if (selectedNodes.size > 0 && !nextNodes.includes(d.name) && d.name !== "Base" & d.name !== headNode) {
            console.log('Next node must be selected');
            return;
        // Unselect the node if already selected, except for the first node
        } else if (selectedNodes.has(d.name) && (selectedPath.length > 1) && d.name !== "Base") {
            selectedNodes.delete(d.name);
            selectedPath = selectedPath.filter(nodeName => nodeName !== d.name);

            // Set the selected node "d" to the last node in the selected path
            d = nodes.find(n => n.name === headNode);

            console.log('Removed: ', d.name)
        // Unselect the node if it is the last node in the selected path
        } else if (d.name === headNode && selectedPath.length > 1) {
            selectedNodes.delete(d.name);
            selectedPath.pop();
            console.log('Removed last node: ', d.name)
        } else {
            // Only select "next" nodes, except for the first node
            selectedNodes.add(d.name);
            selectedPath.push(d.name);
        }
        
        // Update the nextNodes based on the newly selected node
        nextNodes = graphData[d.name].next || ['Base'];

        // Highlight selected nodes
        //node.attr("class", d => selectedNodes.has(d.name) ? "selected" : (nextNodes.includes(d.name) ? "next-node" : ""));
        //text.attr("class", d => selectedNodes.has(d.name) ? "selected" : (nextNodes.includes(d.name) ? "next-node" : ""));

        console.log("Selected Path:", selectedPath);
        
        // Update nextLinks based on the newly selected node
        svg.selectAll(".next-line").remove();

        if (selectedPath.length > 0 && selectedPath.length < 7) {
            const selectedNode = nodes.find(n => n.name === selectedPath[selectedPath.length - 1]);
            const nextLinks = links.filter(link => link.source === selectedNode && nextNodes.includes(link.target.name));
            
            const nextLink = svg.selectAll(".next-line")
                .data(nextLinks)
                .enter().append("line")
                .attr("class", "next-line");

            nextLink.attr("x1", d => map.latLngToLayerPoint(d.source.coords).x)
                .attr("y1", d => map.latLngToLayerPoint(d.source.coords).y)
                .attr("x2", d => map.latLngToLayerPoint(d.target.coords).x)
                .attr("y2", d => map.latLngToLayerPoint(d.target.coords).y);
        }

        // Draw thick black line between selected nodes
        if (selectedLine) {
            selectedLine.remove();
        }
        if (selectedNodes.size > 1) {
            const selectedCoords = selectedPath.map(nodeName => {
                const selectedNode = nodes.find(n => n.name === nodeName);
                return map.latLngToLayerPoint(selectedNode.coords);
            });
            const lineGenerator = d3.line().curve(d3.curveLinear)
                .x(d => d.x)
                .y(d => d.y);
            selectedLine = svg.append("path")
                .datum(selectedCoords)
                .attr("d", lineGenerator)
                .attr("class", "selected-line");
        }
        
        // Update details section based on the newly selected node
        updateDetails(selectedNodes, graphData);
    }

    function updateMap(graphData, nodes, links, svg, map, selectedPath) {
        // Draw dotted links
        const link = svg.selectAll("line.dotted-line")
            .data(links)
            .enter().append("line")
            .attr("class", "dotted-line");

        // Draw nodes
        const node = svg.selectAll("circle")
            .data(nodes)
            .enter().append("circle")
            .attr("r", 10)
            .attr("fill", d => d.mandatory ? "red" : "blue");

        // Add labels to nodes
        const text = svg.selectAll("text")
            .data(nodes)
            .enter().append("text")
            .text(d => d.name)
            .attr("x", d => map.latLngToLayerPoint(d.coords).x)
            .attr("y", d => map.latLngToLayerPoint(d.coords).y)
            .attr("text-anchor", "middle")
            .attr("dy", -15)
            .style("fill", "black");

        // Add click event to nodes
        node.on("click", clickNode);

        function update() {
            link.attr("x1", d => map.latLngToLayerPoint(d.source.coords).x)
                .attr("y1", d => map.latLngToLayerPoint(d.source.coords).y)
                .attr("x2", d => map.latLngToLayerPoint(d.target.coords).x)
                .attr("y2", d => map.latLngToLayerPoint(d.target.coords).y);

            node.attr("cx", d => map.latLngToLayerPoint(d.coords).x)
                .attr("cy", d => map.latLngToLayerPoint(d.coords).y);

            text.attr("x", d => map.latLngToLayerPoint(d.coords).x)
                .attr("y", d => map.latLngToLayerPoint(d.coords).y);

            if (selectedPath.length > 0 && selectedPath.length < 7) {
                const selectedNode = nodes.find(n => n.name === selectedPath[selectedPath.length - 1]);
                const nextLinks = links.filter(link => link.source === selectedNode && graphData[selectedNode.name].next.includes(link.target.name));

                svg.selectAll("line.next-line").remove();

                const nextLink = svg.selectAll("line.next-line")
                    .data(nextLinks)
                    .enter().append("line")
                    .attr("class", "next-line");

                nextLink.attr("x1", d => map.latLngToLayerPoint(d.source.coords).x)
                    .attr("y1", d => map.latLngToLayerPoint(d.source.coords).y)
                    .attr("x2", d => map.latLngToLayerPoint(d.target.coords).x)
                    .attr("y2", d => map.latLngToLayerPoint(d.target.coords).y);
            }
            
            if (selectedLine) {
                const selectedCoords = selectedPath.map(nodeName => {
                    const selectedNode = nodes.find(n => n.name === nodeName);
                    return map.latLngToLayerPoint(selectedNode.coords);
                });
                const lineGenerator = d3.line().curve(d3.curveLinear)
                    .x(d => d.x)
                    .y(d => d.y);
                selectedLine.attr("d", lineGenerator(selectedCoords));
            }

            // Add event listener for zoomend event
            map.on("zoomend", update);
            map.on("move", update);
        }
        update();
    }

    function updateDetails(selectedNodes, graphData) {
        const detailsDiv = document.getElementById('details');
        detailsDiv.innerHTML = '';
        
        let counter = 1;
        selectedNodes.forEach(nodeName => {

            const node = graphData[nodeName];
            if (!node) return; // Skip if undefined
            if (nodeName === 'Base') return; // Skip if Base (first node

            const anchorages = node.anchorages || [];
            const lastNodeName = selectedPath[selectedPath.indexOf(nodeName) - 1];
            const distance = lastNodeName ? calculateDistance(node.coords, graphData[lastNodeName].coords) : 0;
            const time = distance / 5; // 5 knots

            const detailsHeading1 = document.createElement('h3');
            const detailsHeading2 = document.createElement('h4');
            detailsHeading1.textContent = `Day ${counter} ${nodeName}`;
            detailsHeading2.textContent = `Distance: ~${distance} NM - Sailing Time: ~${time.toFixed(2)} hours`;
            detailsDiv.appendChild(detailsHeading1);
            detailsDiv.appendChild(detailsHeading2);
            
            // Check if node.description is undefined
            if (node.description) {
                const descriptionParagraph = document.createElement('p');
                descriptionParagraph.innerText = `${node.description}`;
                detailsDiv.appendChild(descriptionParagraph);
            }
            
            if (anchorages.length > 0) {
                const anchoragesList = document.createElement('ul');
                anchoragesList.innerHTML = `<b>Anchorages:</b>`;
                anchorages.forEach(anchorage => {
                    const anchorageItem = document.createElement('li');
                    anchorageItem.textContent = anchorage;
                    anchoragesList.appendChild(anchorageItem);
                });
                detailsDiv.appendChild(anchoragesList);
            }

            // Get total distance and time for the entire journey and display it at the top of the details section
            const totalDistance = selectedPath.reduce((total, nodeName, index) => {
                if (index === 0) return total;
                const lastNodeName = selectedPath[index - 1];
                const distance = calculateDistance(graphData[nodeName].coords, graphData[lastNodeName].coords);
                return total + parseFloat(distance);
            }, 0);
            const totalTime = totalDistance / 5;
            const totalHeading = document.createElement('h3');
            totalHeading.textContent = `Total Distance: ${totalDistance.toFixed(2)} NM - Total Sailing Time: ~${totalTime.toFixed(2)} hours`;

            // If the totalHeading is already in the detailsDiv, remove it and add it again at the top
            if (detailsDiv.firstChild.textContent.includes('Total Distance')) {
                detailsDiv.removeChild(detailsDiv.firstChild);
            }          

            detailsDiv.prepend(totalHeading);
            
            counter++;
        });
    }

    updateMap(graphData, nodes, links, svg, map, selectedPath);
}

// Call the initMap function once the Leaflet library is loaded
window.onload = initMap;