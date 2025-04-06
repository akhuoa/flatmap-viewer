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
    'dataset-ids': string[]
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
    #datasetFeatures: Map<string, Set<number>> = new Map()
    #featureToMarkerPoint: Map<number, MarkerPoint> = new Map()
    #flatmap: FlatMap
    #map: MapLibreMap
    #mapTermGraph: MapTermGraph
    #clustersByDataset: Map<string, DatasetClusterSet> = new Map()
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

    get datasetFeatures()
    //===================
    {
        return this.#datasetFeatures
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
        const termToMarkerPoints: Map<string, MarkerPoint[]> = new Map()
        for (const datasetClusterSet of this.#clustersByDataset.values()) {
            for (const datasetCluster of datasetClusterSet.clusters) {
                if (!termToMarkerPoints.has(datasetCluster.term)) {
                    const zoomCount = Array(this.#maxZoom + 1).fill(0)
                    const markerPoints: MarkerPoint[] = []
                    for (const featureId of this.#flatmap.modelFeatureIds(datasetCluster.term)) {
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
                                'dataset-ids': [],
                                featureId,
                                label: annotation.label,
                                'models': datasetCluster.term,
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
                        this.#featureToMarkerPoint.set(+featureId, markerPoint)
                        if (datasetCluster.maxZoom === MAX_MARKER_ZOOM) {    // A terminal marker
                            if (!this.#datasetFeatures.has(datasetCluster.datasetId)) {
                                this.#datasetFeatures.set(datasetCluster.datasetId, new Set())
                            }
                            this.#datasetFeatures.get(datasetCluster.datasetId).add(+featureId)
                        }
                        markerPoints.push(markerPoint)
                    }
                    termToMarkerPoints.set(datasetCluster.term, markerPoints)
                }
                const markerPoint = termToMarkerPoints.get(datasetCluster.term)[0]
                if (markerPoint) {
                    // We only need to update these property fields once, as all of the dataset's markers
                    // refer to the same two property variables
                    const zoomCount = markerPoint.properties['zoom-count']
                    for (let zoom = 0; zoom <= this.#maxZoom; zoom += 1) {
                        if (datasetCluster.minZoom <= zoom && zoom < datasetCluster.maxZoom) {
                            zoomCount[zoom] += 1
                        }
                    }
                    markerPoint.properties['dataset-ids'].push(datasetCluster.datasetId)


                } else {
                    // shouldn't get here...
                    console.error(`Can't find marker for ${datasetCluster.term}...`)
                }
            }
        }
        this.#points.features = []
        for (const markerPoints of termToMarkerPoints.values()) {
            this.#points.features.push(...(markerPoints as GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[]))
        }
        this.#showPoints()
    }

    addDatasetMarkers(datasets: DatasetTerms[])
    //=========================================
    {
        for (const dataset of datasets) {
            if (dataset.terms.length) {
                this.#clustersByDataset.set(dataset.id, new DatasetClusterSet(dataset, this.#mapTermGraph))
            }
        }
        this.#update()
    }

    clearDatasetMarkers()
    //===================
    {
        this.#clustersByDataset.clear()
        this.#update()
    }

    removeDatasetMarker(datasetId: string)
    //====================================
    {
        if (this.#clustersByDataset.has(datasetId)) {
            this.#clustersByDataset.delete(datasetId)
        }
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

