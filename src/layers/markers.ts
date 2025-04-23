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
import {GeoJSONSource} from 'maplibre-gl'

//==============================================================================

import {FlatMap} from '../flatmap'
import {FlatMapFeatureAnnotation, FlatMapMarkerOptions} from '../flatmap-types'
import type {GeoJSONId} from '../flatmap-types'
import {UserInteractions} from '../interactions'
import {UNCLUSTERED_MARKER, MULTISCALE_MARKER} from '../markers'
import {PropertiesType} from '../types'

//==============================================================================

type MarkerProperties = {
    featureId: GeoJSONId
    hidden?: boolean
    'icon-image': string
    label?: string
    models: string
    hyperlinks?: object
}

interface MarkerPoint
{
    type: string
    id: number
    properties: MarkerProperties
    geometry: GeoJSON.Point
}

//==============================================================================

export class MarkerLayer
{
    #featureIndexById: Map<number, number> = new Map()
    #featureToMarkerPoint: Map<number, MarkerPoint> = new Map()
    #id: string
    #map: MapLibreMap
    #maxZoom: number
    #points: GeoJSON.FeatureCollection = {
       type: 'FeatureCollection',
       features: []
    }
    #source: string
    #ui: UserInteractions

    constructor(flatmap: FlatMap, ui: UserInteractions, layerId: string)
    {
        this.#map = flatmap.map!
        this.#ui = ui
        this.#maxZoom = Math.ceil(this.#map.getMaxZoom())
        this.#id = `${layerId}-markers-layer`
        this.#source = `${layerId}-markers-source`

        this.#map.addSource(this.#source, {
            type: 'geojson',
            data: this.#points
        })
        this.#map.addLayer({
            id: this.#id,
            type: 'symbol',
            source: this.#source,
            layout: {
                'icon-image': ['get','icon-image'],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-offset': [0, -17],
                'icon-size': 0.8,
            },
            paint: {
                'icon-opacity': ['case', ['boolean', ['get', 'hidden'], false], 0, 1],
                'text-opacity': ['case', ['boolean', ['get', 'hidden'], false], 0, 1]
            }
        })
    }

    get id()
    //======
    {
        return this.#id
    }

    #showPoints()
    //===========
    {
        const source = this.#map.getSource(this.#source) as GeoJSONSource
        source.setData(this.#points)
    }

    addMarker(annotation: FlatMapFeatureAnnotation, options: FlatMapMarkerOptions): GeoJSONId|null
    //============================================================================================
    {
        const markerPosition = this.#ui.markerPosition(annotation)
        if (markerPosition === null
         || annotation.centreline
         || annotation.kind === 'zoom-point') {
                return null
            }
        const featureId = +annotation.featureId
        const markerId = this.#ui.nextMarkerId()
        const markerPoint: MarkerPoint = {
            type: 'Feature',
            id: markerId,
            properties: {
                featureId,
                'icon-image': (options.kind === 'multiscale') ? MULTISCALE_MARKER : UNCLUSTERED_MARKER,
                label: annotation.label,
                models: annotation.models,
                hyperlinks: annotation.hyperlinks
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
        this.#featureToMarkerPoint.set(featureId, markerPoint)
        this.#featureIndexById.set(featureId, this.#points.features.length)
        this.#points.features.push(markerPoint as GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>)
        this.#showPoints()
        return markerId
    }

    clearMarkers()
    //============
    {
        this.#featureIndexById.clear()
        this.#points.features.length = 0
        this.#showPoints()
    }

    removeMarker(markerId: number)
    //=============================
    {
        if (this.#featureIndexById.has(markerId)) {
            const featureIndex = this.#featureIndexById.get(markerId)
            this.#featureIndexById.delete(markerId)
            this.#points.features.splice(featureIndex, 0)
            this.#showPoints()
        }
    }

    removeFeatureState(featureId: GeoJSONId, key: string)
    //===================================================
    {
        if (key === 'hidden') {
            if (this.#featureToMarkerPoint.has(+featureId)) {
                const markerPoint = this.#featureToMarkerPoint.get(+featureId)
                if (markerPoint && 'hidden' in markerPoint.properties) {
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
                if (markerPoint) {
                    markerPoint.properties.hidden = !!state.hidden
                    this.#showPoints()
                }
            }
        }
    }
}

//==============================================================================
