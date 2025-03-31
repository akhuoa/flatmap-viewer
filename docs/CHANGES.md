## FUTURE DEPRECATION

* `FlatMap.provenance` will be removed as it has been replaced by `FlatMap.mapMetadata`.

## 4.0.3

* Return all features corresponding to a clustered dataset marker in event messages (#53).
* maplibre: make sure a map doesn't wrap around the anti-meridian when we have a long narrow viewport.
* Send a single click message, with an array of feature properties, when a pointer click is on several paths (#52).
* functional: View details of a feature by clicking on their zoom marker instead of automatically zooming into them.
* Update `maplibre-gl` to version 5.2.0
* `FlatMap.mapMetadata` has been added as an alias for `FlatMap.provenance`.

## 4.0.2

* Add `hyperlinks.flatmap` to a specify a flatmap associated with the clicked-on feature.
* Only load a map into a pane if `loadMap()` hasn't specified a container.
* General code improvements.

## 4.0.1

* Allow `container` as an option for `loadMap()`, as the container in which to load the map instead of using a pane.

## 4.0.0

`@abi-software/flatmap-viewer@4.0.0` is the map viewer entirely in Typescript. 

Breaking changes are:

* The `MapManager` class has been renamed to `MapViewer`.
* `MapViewer` now requires two parameters, its server URL and options, of type `MapViewerOptions`, with a required `container` field (the id of the map’s HTML container).
* `MapViewer.loadMap()` no longer has a `container` parameter:
  
```
async loadMap(identifier: string, callback: FlatMapCallback, options: FlatMapOptions={}): Promise<FlatMap>
```

A MapViewer can have multiple panes within its container, by setting the `panes` field in the viewer’s options to the maximum number allowed (default is 1 pane). With more than one pane specified, `loadMap()` will create panes within the parent container in which to place maps — when the limit is reached the rightmost pane will be reused. Panes have a close button to allow them to be closed.

There are some (minimal) changes to support the ISAN maps, but essentially this release will be map-viewer going forward.
