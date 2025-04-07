/*==============================================================================

Flatmap viewer and annotation tool

Copyright (c) 2019 - 2025 David Brooks

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

==============================================================================*/

import {Map as MapLibreMap} from 'maplibre-gl'
import {DataDrivenPropertyValueSpecification, GeoJSONSource} from 'maplibre-gl'

//==============================================================================

import {FlatMap} from '../flatmap'
import {DatasetTerms} from '../flatmap-types'
import type {GeoJSONId} from '../flatmap-types'
import {UserInteractions} from '../interactions'
import {MapTermGraph} from '../knowledge'
import {CLUSTERED_MARKER_ID} from '../markers'
import {PropertiesType} from '../types'

import {DatasetClusterSet, MAX_MARKER_ZOOM} from './datasetcluster'

//==============================================================================

export const ANATOMICAL_MARKERS_LAYER = 'anatomical-markers-layer'
const ANATOMICAL_MARKERS_SOURCE = 'anatomical-markers-source'

//==============================================================================

type Term = string | number | Term[]

//==============================================================================

function zoomCountText(maxZoom: number)
{
    const expr: Term[] = ['step', ['zoom']]
    for (let z = 0; z <= maxZoom; z += 1) {
        if (z > 0) {
            expr.push(z)
        }
        expr.push(['to-string', ['at', z, ['get', 'zoom-count']]])
    }
    return expr as DataDrivenPropertyValueSpecification<string>
}

//==============================================================================

type MarkerProperties = {
    featureId: GeoJSONId
    hidden?: boolean
    label: string
    models: string
    'zoom-count': number[]
}

interface MarkerPoint
{
    type: string
    id: number
    properties: MarkerProperties
    geometry: GeoJSON.Point
}

//==============================================================================

export class ClusteredAnatomicalMarkerLayer
{
    #datasetFeatureIds: Map<string, Set<number>> = new Map()
    #featureToMarkerPoint: Map<number, MarkerPoint> = new Map()
    #featureToTerm: Map<number, string> = new Map()
    #flatmap: FlatMap
    #map: MapLibreMap
    #mapTermGraph: MapTermGraph
    #clustersByDataset: Map<string, DatasetClusterSet> = new Map()
    #datasetsByZoomTerm: Map<string, Set<string>[]> = new Map()
    #maxZoom: number
    #points: GeoJSON.FeatureCollection = {
       type: 'FeatureCollection',
       features: []
    }
    #ui: UserInteractions

    constructor(flatmap: FlatMap, ui: UserInteractions)
    {
        this.#ui = ui
        this.#flatmap = flatmap
        this.#map = flatmap.map
        this.#maxZoom = Math.ceil(this.#map.getMaxZoom())
        this.#mapTermGraph = flatmap.mapTermGraph

        this.#map.addSource(ANATOMICAL_MARKERS_SOURCE, {
            type: 'geojson',
            data: this.#points
        })
        this.#map.addLayer({
            id: ANATOMICAL_MARKERS_LAYER,
            type: 'symbol',
            source: ANATOMICAL_MARKERS_SOURCE,
            filter: ['let', 'index', ['min', ['floor', ['zoom']], this.#maxZoom-1],
                        ['>', ['at', ['var', 'index'], ['get', 'zoom-count']], 0]
                    ],
            layout: {
                'icon-image': CLUSTERED_MARKER_ID,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-offset': [0, -17],
                'icon-size': 0.8,
                'text-field': zoomCountText(this.#maxZoom),
                'text-size': 10,
                'text-offset': [0, -1.93],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
            },
            paint: {
                'icon-opacity': ['case', ['boolean', ['get', 'hidden'], false], 0, 1],
                'text-opacity': ['case', ['boolean', ['get', 'hidden'], false], 0, 1]
            }
        })
    }

    datasetFeatureIds(): Map<string, Set<number>>
    //===========================================
    {
        return this.#datasetFeatureIds
    }

    datasetIds(term: string, zoomLevel: number): string[]
    //===================================================
    {
        const zoomDatasets = this.#datasetsByZoomTerm.get(term)
        if (zoomDatasets) {
            return [...zoomDatasets[Math.floor(zoomLevel)]]
        }
        return []
    }

    #showPoints()
    //===========
    {
        const source = this.#map.getSource(ANATOMICAL_MARKERS_SOURCE) as GeoJSONSource
        source.setData(this.#points)
    }

    #update()
    //=======
    {
        const markerPoints: MarkerPoint[] = []
        this.#featureToTerm.clear()
        this.#datasetsByZoomTerm.forEach((zoomDatasets, term) => {
            const zoomCount = zoomDatasets.map(ds => ds.size)
            for (const featureId of this.#flatmap.modelFeatureIds(term)) {
                const annotation = this.#flatmap.annotation(featureId)
                if (annotation.centreline
                 || !('markerPosition' in annotation) && !annotation.geometry.includes('Polygon')) {
                    continue;
                }
                const markerId = this.#ui.nextMarkerId()
                const markerPosition = this.#ui.markerPosition(annotation)
                const markerPoint = {
                    type: 'Feature',
                    id: markerId,
                    properties: {
                        featureId,
                        label: annotation.label,
                        models: term,
                        'zoom-count': zoomCount
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: markerPosition
                    } as GeoJSON.Point
                }
                const markerState = this.#ui.getFeatureState(featureId)
                if (markerState && 'hidden' in markerState) {
                    markerPoint.properties['hidden'] = markerState.hidden
                }
                markerPoints.push(markerPoint)
                this.#featureToTerm.set(+featureId, term)

            }
        })
        this.#points.features = (markerPoints as GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[])
        this.#showPoints()
    }

    addDatasetMarkers(datasets: DatasetTerms[])
    //=========================================
    {
        for (const dataset of datasets) {
            if (dataset.terms.length) {
                const clusteredSet = new DatasetClusterSet(dataset, this.#mapTermGraph)
                this.#clustersByDataset.set(dataset.id, clusteredSet)
                for (const cluster of clusteredSet.clusters) {
                    let zoomDatasets = this.#datasetsByZoomTerm.get(cluster.term)
                    if (!zoomDatasets) {
                        zoomDatasets = []
                        for (let n = 0; n <= MAX_MARKER_ZOOM; n +=1) {
                            zoomDatasets[n] = new Set<string>()
                        }
                        this.#datasetsByZoomTerm.set(cluster.term, zoomDatasets)
                    }
                    for (let zoom = cluster.minZoom; zoom < cluster.maxZoom; zoom += 1) {
                        zoomDatasets[zoom].add(cluster.datasetId)
                    }
                    if (cluster.maxZoom === MAX_MARKER_ZOOM) {
                        zoomDatasets[MAX_MARKER_ZOOM].add(cluster.datasetId)
                        let datasetFeatureIds = this.#datasetFeatureIds.get(cluster.datasetId)
                        if (!datasetFeatureIds) {
                            datasetFeatureIds = new Set()
                            this.#datasetFeatureIds.set(cluster.datasetId, datasetFeatureIds)
                        }
                        for (const featureId of this.#flatmap.modelFeatureIds(cluster.term)) {
                            datasetFeatureIds.add(+featureId)
                        }
                    }
                }
            }
        }
        this.#update()
    }

    clearDatasetMarkers()
    //===================
    {
        this.#clustersByDataset.clear()
        this.#datasetFeatureIds.clear()
        this.#datasetsByZoomTerm.clear()
        this.#update()
    }

    removeDatasetMarker(datasetId: string)
    //====================================
    {
        if (this.#clustersByDataset.has(datasetId)) {
            this.#clustersByDataset.delete(datasetId)
        }
        if (this.#datasetFeatureIds.has(datasetId)) {
            this.#datasetFeatureIds.delete(datasetId)
        }
        this.#datasetsByZoomTerm.forEach((zoomDatasets, _) => {
            zoomDatasets.forEach(datasetIds => {
                datasetIds.delete(datasetId)
            })
        })
        this.#update()
    }

    removeFeatureState(featureId: GeoJSONId, key: string)
    //===================================================
    {
        if (key === 'hidden') {
            if (this.#featureToMarkerPoint.has(+featureId)) {
                const markerPoint = this.#featureToMarkerPoint.get(+featureId)
                if ('hidden' in markerPoint.properties) {
                    delete markerPoint.properties.hidden
                    this.#showPoints()
                }
            }
        }
    }

    setFeatureState(featureId: GeoJSONId, state: PropertiesType)
    //==========================================================
    {
        if ('hidden' in state) {
            if (this.#featureToMarkerPoint.has(+featureId)) {
                const markerPoint = this.#featureToMarkerPoint.get(+featureId)
                markerPoint.properties.hidden = !!state.hidden
                this.#showPoints()
            }
        }
    }
}

//==============================================================================
