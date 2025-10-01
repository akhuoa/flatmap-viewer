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

import {FlatMap} from '../flatmap'
import {DatasetTerms} from '../flatmap-types'
import {ANATOMICAL_ROOT, MapTermGraph} from '../knowledge'
import {DiGraph} from '../knowledge/graphs'

//==============================================================================

export type DatasetCluster = {
    markerTerm: string
    datasetId: string
    minZoom: number
    maxZoom: number
}

//==============================================================================

export const MIN_MARKER_ZOOM =  2
export const MAX_MARKER_ZOOM = 12

//==============================================================================

export class DatasetClusterSet
{
    #connectedTermGraph: DiGraph
    #datasetId: string
    #flatmap: FlatMap
    #mapTermGraph: MapTermGraph
    #markerTerms: Set<string>
    #descendents: Map<string, Set<string>> = new Map()
    #clustersByTerm: Map<string, DatasetCluster> = new Map()
    #maxDepth: number

    constructor(dataset: DatasetTerms, flatmap: FlatMap)
    {
        this.#datasetId = dataset.id
        this.#flatmap = flatmap
        this.#mapTermGraph = flatmap.mapTermGraph
        this.#maxDepth = this.#mapTermGraph.maxDepth

        const datasetTerms = new Array(...dataset.terms)
        const markerTermMap = this.#validatedMarkerTerms(datasetTerms)  // marker term ==> { dataset terms }
        this.#markerTerms = new Set(markerTermMap.keys())
        this.#connectedTermGraph = this.#mapTermGraph.connectedTermGraph([...this.#markerTerms.values()])
        for (const markerTerm of this.#connectedTermGraph.nodes()) {
            if (markerTermMap.has(markerTerm)) {
                this.#connectedTermGraph.setNodeAttribute(markerTerm, 'terms', markerTermMap.get(markerTerm))
            } else {
                this.#connectedTermGraph.setNodeAttribute(markerTerm, 'terms', new Set([markerTerm]))
            }
        }
        this.#clustersByTerm = new Map(this.#connectedTermGraph.nodes().map(markerTerm => {
            const d = this.#mapTermGraph.depth(markerTerm)
            const zoomRange = this.#depthToZoomRange(d)
            return [ markerTerm, {
                datasetId: this.#datasetId,
                markerTerm: markerTerm,
                minZoom: zoomRange[0],
                maxZoom: zoomRange[1]
            }]
        }))
        for (const markerTerm of this.#connectedTermGraph.nodes()
                                                       .filter(term => term !== ANATOMICAL_ROOT
                                                            && this.#connectedTermGraph.degree(term) == 1)) {
            const cluster = this.#clustersByTerm.get(markerTerm)!
            cluster.maxZoom = MAX_MARKER_ZOOM
            this.#setZoomFromParents(cluster, markerTerm)
        }
        this.#setMinZoomFromRoot(ANATOMICAL_ROOT)
    }

    get id(): string
    //==============
    {
        return this.#datasetId
    }

    get clusters(): DatasetCluster[]
    //==============================
    {
        return [...this.#clustersByTerm.values()]
    }

    get markerTerms(): string[]
    //=========================
    {
        return [...this.#markerTerms.values()]
    }

    get descendents(): Map<string, Set<string>>
    //=========================================
    {
        return this.#descendents
    }

    #depthToZoomRange(depth: number): [number, number]
    //================================================
    {
        const zoom = MIN_MARKER_ZOOM
                   + Math.floor((MAX_MARKER_ZOOM - MIN_MARKER_ZOOM)*depth/this.#maxDepth)
        return (zoom < 0)         ? [0, 1]
             : (zoom >= MAX_MARKER_ZOOM) ? [MAX_MARKER_ZOOM, MAX_MARKER_ZOOM]
             :                      [zoom, zoom+1]
    }

    #setMinZoomFromRoot(term: string)
    //=================================
    {
        if (!this.#flatmap.hasAnatomicalIdentifier(term)) {
            this.#clustersByTerm.delete(term)
            for (const child of this.#connectedTermGraph.children(term)) {
                const cluster = this.#clustersByTerm.get(child)
                cluster.minZoom = 0
                this.#setMinZoomFromRoot(child)
           }
        }
    }

    #setZoomFromParents(cluster: DatasetCluster, markerTerm: string)
    //==============================================================
    {
        let datasetTerms: Set<string> = this.#descendents.get(cluster.markerTerm)
        if (datasetTerms === undefined) {
            datasetTerms = new Set()
        }
        if (this.#connectedTermGraph.hasNodeAttribute(markerTerm, 'terms')) {
            datasetTerms = datasetTerms.union(this.#connectedTermGraph.getNodeAttribute(markerTerm, 'terms'))
            this.#descendents.set(cluster.markerTerm, datasetTerms)
        }
        if (cluster.markerTerm === ANATOMICAL_ROOT) {
            cluster.minZoom = 0
            return
        }
        for (const parent of this.#connectedTermGraph.parents(cluster.markerTerm)) {
            const parentCluster = this.#clustersByTerm.get(parent)!
            if (parentCluster.maxZoom < cluster.minZoom) {
                parentCluster.maxZoom = cluster.minZoom
            }
            this.#setZoomFromParents(parentCluster, markerTerm)
        }
    }

    #substituteTerm(term: string): string|null
    //========================================
    {
        const parents = this.#mapTermGraph.parents(term)
        if (parents.length == 0
         || parents[0] === ANATOMICAL_ROOT) {
            return null
        }
        const maxDepth = -1
        let furthestParent: string|null = null
        for (const parent of parents) {
            if (this.#flatmap.hasAnatomicalIdentifier(parent)) {
                const depth = this.#mapTermGraph.depth(parent)
                if (depth > maxDepth) {
                    furthestParent = parent
                }
            }
        }
        return furthestParent
                ? furthestParent
                : this.#substituteTerm(parents[0])
    }

    #validatedMarkerTerms(terms: string[]): Map<string, Set<string>>
    //==============================================================
    {
        const markerTerms: Map<string, Set<string>> = new Map()
        function addMarkerTerm(markerTerm: string, datasetTerm: string)
        {
            let datasetTerms = markerTerms.get(markerTerm)
            if (datasetTerms === undefined) {
                datasetTerms = new Set()
                markerTerms.set(markerTerm, datasetTerms)
            }
            datasetTerms.add(datasetTerm)
        }
        for (let term of terms) {
            term = term.trim()
            if (term === '') {
                continue
            } else if (this.#flatmap.hasAnatomicalIdentifier(term)) {
                addMarkerTerm(term, term)
            } else {
                const substitute = this.#substituteTerm(term)
                if (substitute) {
                    addMarkerTerm(substitute, term)
                }
            }
        }
        return markerTerms
    }
}

//==============================================================================
