---
title: HowTo Guide
group: Documents
category: Guides
---
## A simple application

This example will display the most recent human female map from the SPARC
map server into a HTML `<div>` element. The `pathsDisabled` option is set
at load time to hide all neuron paths that are usually displayed.

1.  Include the `flatmap-viewer` NPM package in a web application.

2.  Declare a `<div>` element as part of a web page:

    ```html
    <div id="map-container"></div>
    ```

3.  Give the element a size and border:

    ```css
    #map-container {
        border: 3px solid green;
        height: 100%;
        width: 100%;
    }
    ```

4.  Use code such as this to load and display a map
    into the `<div>` element:

    ```typescript
    import {MapViewer} from '@abi-software/flatmap-viewer'

    // Use production SPARC maps

    const MAP_SERVER = 'https://mapcore-demo.org/current/flatmap/v3/'

    // Create a viewer for the map server

    const viewer = new MapViewer(MAP_SERVER)

    // Optionally get a list of all maps on the server

    const mapList = await viewer.allMaps()
    console.log(mapList)

    // Load the most recent human female map into the `map-container`
    // with all paths hidden. The provided callbacke will log all events
    // from the viewer to the console.

    const map = await viewer.loadMap({
        taxon: 'NCBITaxon:9606',
        biologicalSex: 'PATO:0000383'
    }, (type, data) => {
        console.log(type, data)
    }, {
      container: 'map-container',
      pathsDisabled: true
    })
    ```
