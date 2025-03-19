/*==============================================================================

Flatmap viewer and annotation tool

Copyright (c) 2019 - 2025  David Brooks

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

import maplibregl from 'maplibre-gl'

//==============================================================================

// The type of the ``id`` field in our GeoJSON features
export type GeoJSONId = number

//==============================================================================

export type MapFeatureIdentifier = maplibregl.FeatureIdentifier & {
    flightPath?: boolean
    layer?: {
        id: string
    }
}

export type MapFeature = MapFeatureIdentifier & {
    children?: GeoJSONId[]
    properties?: {
        featureId?: GeoJSONId
        kind?: string
    }
}

export type MapRenderedFeature = maplibregl.MapGeoJSONFeature & {
    properties?: {
        featureId?: GeoJSONId
    }
}

//==============================================================================

// Lng, Lat coordinates
export type MapExtent = [number, number, number, number]

//==============================================================================

// Flatmap types as received from server...

export interface FlatMapServerIndex
{
    created: string
    creator: string
    id: string
    name: string
    source: string
    uri: string
    version: number

    // Optional fields:
    biologicalSex?: string
    describes?: string
    'git-status'?: object
    sckan?: object
    taxon?: string
    uuid?: string
}

//==============================================================================
//==============================================================================

export interface SckanConnectivity
{
    'knowledge-source'?: string
    npo?: {
        release: string
    }
}

//==============================================================================

export type HistoricalMapLayer = string | {id: string, description: string}

export interface FlatMapIndex
{
    authoring?: boolean
    biologicalSex?: string
    bounds: MapExtent
    connectivity?: SckanConnectivity
    'git-status'?: object
    id: string
    layers?: HistoricalMapLayer[]
    'image-layers'?: boolean
    'max-zoom'?: number
    'min-zoom'?: number
    source: string
    style: string
    taxon?: string
    uuid?: string
    version: number
}

//==============================================================================

export interface PathModelsType
{
    id: string
    paths: string[]
}

export type PathDetailsType = {
    lines: GeoJSONId[]                                 // line GeoJSON ids
    nerves?: GeoJSONId[]                               // nerve cuff GeoJSON ids
    nodes?: GeoJSONId[]                                // node GeoJSON ids
    models?: string
    centrelines?: string[]
    pathType?: string
    systemCount?: number
}

export interface FlatMapPathways
{
    models?: PathModelsType[]                       // model --> paths with model
    'node-paths': Record<GeoJSONId, string[]>       // node --> associated paths
    paths: Record<string, PathDetailsType>          // path --> path details
    'type-paths': Record<string, string[]>          // type --> paths with type
}

//==============================================================================

export interface FlatMapImageLayer
{
    id: string
    options: {
        background?: boolean
        'detail-layer'?: boolean
        'max-zoom'?: number
        'min-zoom'?: number
    }
}

export interface FlatMapLayer
{
    extent?: MapExtent
    description?: string
    'detail-layer'?: boolean
    enabled?: boolean
    id: string
    'image-layers'?: FlatMapImageLayer[]
    'max-zoom'?: number
    'min-zoom'?: number
}

//==============================================================================

export type FlatMapCallback = (type: string, ...args: unknown[]) => undefined|boolean

export interface FlatMapLayerOptions
{
    authoring?: boolean
    coloured?: boolean
    outlined?: boolean
    sckan?: string
}

export interface FlatMapOptions
{
    annotator?: boolean
    background?: string
    container?: string
    debug?: boolean
    flightPaths?: boolean
    fullscreenControl?: boolean
    layerOptions?: FlatMapLayerOptions
    minimap?: boolean | {
        position?: string
        width?: number | string
    }
    maxZoom?: number
    minZoom?: number
    navigationControl?: boolean
    showId?: boolean
    showLngLat?: boolean
    showPosition?: boolean
    standalone?: boolean
    tooltipDelay?: number
    tooltips?: boolean
}

//==============================================================================

export interface FlatMapMetadata
{
    'biological-sex'?: string
    connectivity?: object
    created: string
    creator: string
    describes: string
    id: string
    'git-status'?: object
    name: string
    settings: object
    source: string
    taxon?: string
    uuid?: string
    version: number
}

//==============================================================================
//==============================================================================

export interface FlatMapFeatureAnnotation
{
    alert?: string
    'anatomical-nodes'?: string[]
    bounds?: string
    centreline?: boolean
    centroid?: Point2D
    children?: GeoJSONId[]
    colour?: string
    coordinates?: Point2D[]
    featureId?: GeoJSONId
    geometry?: string
    hyperlink?: string
    hyperlinks?: {
        description?: string
        flatmap?: string
        pmr?: string
    }
    id?: string
    kind?: string
    label?: string
    lineLength?: number
    lineString?:  GeoJSON.Feature<GeoJSON.LineString>
    markerPosition?: Point2D
    models?: string
    name?: string
    'path-ids'?: string[]
    pathEndPosition?: number[]
    pathStartPosition?: number[]
    source?: string
    type?: string
}

export type FlatMapAnnotations = Record<number, FlatMapFeatureAnnotation>

//==============================================================================

export type Point2D = [number, number]

export type FlatMapFeatureGeometry = GeoJSON.LineString | GeoJSON.Point | GeoJSON.Polygon

//==============================================================================
//==============================================================================

/**
 * Modes for drawing annotations on the map.
 *
 * See https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md
 * for details.
 */
export interface AnnotationDrawMode
{
    mode: string
    options?: object
}

export interface AnnotationEvent
{
    type: string
    feature: AnnotatedFeature
}

export interface AnnotatedFeature
{
    id: GeoJSONId
    action?: string
    geometry: FlatMapFeatureGeometry
    properties?: object
    type?: string
}

//==============================================================================
//==============================================================================

export interface FlatMapFeature
{
    id: string
    geometry?: FlatMapFeatureGeometry
    layer?: maplibregl.StyleSpecification & {
        id: string
    }
    source: string
    sourceLayer?: string
    type?: string
    properties?: FlatMapFeatureAnnotation
    state?: Record<string, string|number|boolean>
    children: GeoJSONId[]
}

//==============================================================================
//==============================================================================

export type FlatMapMarkerOptions = maplibregl.MarkerOptions & {
    className?: string
    colour?: string
    element?: string
    location?: number
}

//==============================================================================

export type FlatMapPopUpOptions = maplibregl.PopupOptions & {
    annotationFeatureGeometry?: boolean
    positionAtLastClick?: boolean
    preserveSelection?: boolean
}

//==============================================================================
//==============================================================================

export interface Dataset
{
    id: string
    terms: string[]
}

//==============================================================================

export type FeatureZoomOptions = {
    zoomIn?: boolean
}

//==============================================================================
