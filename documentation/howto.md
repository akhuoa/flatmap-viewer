---
title: HowTo Guide
group: Documents
category: Guides
---
# HowTo

## Using the viewer in a simple application:

```html
<div id="map-container"></div>
```

```css
#map-container {
    height: 100%;
    width: 100%;
}
```

```typescript
import {MapViewer} from '@abi-software/flatmap-viewer'

// Use production SPARC maps
const MAP_SERVER = 'https://mapcore-demo.org/current/flatmap/v3/'

// Create a viewer for the map server
const viewer = new MapViewer(MAP_SERVER)

// Get a list of all maps on the server
const mapList = await viewer.allMaps()

// Load and view the most recent human female map and log all events from the viewer
const map = await viewer.loadMap({
    taxon: 'NCBITaxon:9606',
    biologicalSex: 'PATO:0000383'
}, (type, data) => {
    console.log(type, data)
})

// Disable (hide) all paths on the map
map.enablePaths(map.pathTypes().map(pathType => pathType.type), false)
```
