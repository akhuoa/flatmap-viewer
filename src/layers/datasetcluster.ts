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

import {DatasetTerms} from '../flatmap-types'
import {ANATOMICAL_ROOT, MapTermGraph} from '../knowledge'
import {DiGraph} from '../knowledge/graphs'

//==============================================================================

export type DatasetCluster = {
    term: string
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
    #mapTermGraph: MapTermGraph
    #clustersByTerm: Map<string, DatasetCluster>
    #maxDepth: number

    constructor(dataset: DatasetTerms, mapTermGraph: MapTermGraph)
    {
        this.#datasetId = dataset.id
        this.#mapTermGraph = mapTermGraph
        this.#maxDepth = mapTermGraph.maxDepth

        const datasetTerms = new Array(...dataset.terms)
        const mapTerms = new Set(this.#validatedTerms(datasetTerms))
        this.#connectedTermGraph = mapTermGraph.connectedTermGraph([...mapTerms.values()])
        this.#clustersByTerm = new Map(this.#connectedTermGraph.nodes().map(term => {
            const d = mapTermGraph.depth(term)
            const zoomRange = this.#depthToZoomRange(d)
            return [ term, {
                datasetId: this.#datasetId,
                term,
                minZoom: zoomRange[0],
                maxZoom: zoomRange[1]
            }]
        }))
        for (const terminal of this.#connectedTermGraph.nodes()
                                                       .filter(term => term !== ANATOMICAL_ROOT
                                                            && this.#connectedTermGraph.degree(term) == 1)) {
            const cluster = this.#clustersByTerm.get(terminal)
            cluster.maxZoom = MAX_MARKER_ZOOM
            this.#setZoomFromParents(cluster)
        }
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

    #depthToZoomRange(depth: number): [number, number]
    //================================================
    {
        const zoom = MIN_MARKER_ZOOM
                   + Math.floor((MAX_MARKER_ZOOM - MIN_MARKER_ZOOM)*depth/this.#maxDepth)
        return (zoom < 0)         ? [0, 1]
             : (zoom >= MAX_MARKER_ZOOM) ? [MAX_MARKER_ZOOM, MAX_MARKER_ZOOM]
             :                      [zoom, zoom+1]
    }

    #setZoomFromParents(cluster: DatasetCluster)
    //==========================================
    {
        if (cluster.term === ANATOMICAL_ROOT) {
            cluster.minZoom = 0
            return
        }
        for (const parent of this.#connectedTermGraph.parents(cluster.term)) {
            const parentCluster = this.#clustersByTerm.get(parent)
            if (parentCluster.maxZoom < cluster.minZoom) {
                parentCluster.maxZoom = cluster.minZoom
            }
            this.#setZoomFromParents(parentCluster)
        }
    }

    #substituteTerm(term: string): string|null
    //========================================
    {
        const parents = this.#mapTermGraph.sparcTermGraph.parents(term)
        if (parents.length == 0
         || parents[0] === ANATOMICAL_ROOT) {
            return null
        }
        const maxDepth = -1
        let furthestParent = null
        for (const parent of parents) {
            const depth = this.#mapTermGraph.depth(parent)
            if (depth > maxDepth) {
                furthestParent = parent
            }
        }
        return furthestParent
                ? furthestParent
                : this.#substituteTerm(parents[0])
    }

    #validatedTerms(terms: string[]): string[]
    //========================================
    {
        const mapTerms = []
        for (let term of terms) {
            term = term.trim()
            if (term === '') {
                continue
            } else if (this.#mapTermGraph.hasTerm(term)) {
                mapTerms.push(term)
            } else {
                const substitute = this.#substituteTerm(term)
                if (substitute === null) {
                    console.error(`No feature for ${term} on map; can't find substitute`)
                } else {
                    console.log(`No feature for ${term} on map; substituting ${substitute}`)
                    mapTerms.push(substitute)
                }
            }
        }
        return mapTerms
    }
}

//==============================================================================
