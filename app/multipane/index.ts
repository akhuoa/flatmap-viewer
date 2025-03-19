/******************************************************************************

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

******************************************************************************/

import { FlatMap, FlatMapOptions, MapViewer } from '../../lib'

import { FlatMapCallback } from '../../src/flatmap-types'
import { MapIdentifier } from '../../src/viewer'

//==============================================================================

const VIEWER_BOTTOM_PANE = 'flatmap-viewer-bottom'

//==============================================================================

export class PaneManager
{
    #activeBottom: boolean = false
    #activePanes: number = 0
    #bottomMapId: string
    #bottomPane: HTMLElement|null = null
    #container: string
    #containerElement: HTMLElement|null = null
    #lastPaneUsed: string
    #mapsByContainer: Map<string, FlatMap> = new Map()
    #paneNumber: number = 0
    #maxPanes: number

    constructor(container: string, maxPanes: number=1, bottomMapId: string='')
    {
        this.#bottomPane = document.getElementById(VIEWER_BOTTOM_PANE)
        this.#bottomMapId = bottomMapId
        this.#container = container
        this.#containerElement = document.getElementById(container)
        this.#lastPaneUsed = container
        this.#maxPanes = maxPanes
        if (this.#maxPanes > 1) {
            this.#containerElement!.style.display = 'flex'
        }
    }

    closeMaps()
    //=========
    {
        for (const [containerId, flatmap] of this.#mapsByContainer.entries()) {
            if (containerId !== VIEWER_BOTTOM_PANE) {
                flatmap.close()
                if (this.#maxPanes > 1) {
                    const container = document.getElementById(containerId)
                    if (container) {
                        container.remove()
                    }
                }
                this.#mapsByContainer.delete(containerId)
            }
        }
    }

    async #closePaneCallback(eventType: string, data: Record<string, any>)
    //====================================================================
    {
        if (eventType === 'close-pane') {
            const containerId = data.container
            if (this.#mapsByContainer.size > 1) {
                this.#mapsByContainer.delete(containerId)
                if (containerId === VIEWER_BOTTOM_PANE && this.#bottomPane) {
                    this.#bottomPane.style.display = 'none'
                    this.#activeBottom = false
                } else {
                    const container = document.getElementById(containerId)
                    if (container) {
                        container.remove()
                        this.#activePanes -= 1
                    }
                }
            }
            if (this.#activePanes === 0) {
                this.#containerElement!.style.display = 'none'
            }
            if (this.#mapsByContainer.size <= 1) {
                for (const flatmap of this.#mapsByContainer.values()) {
                    flatmap.removeCloseControl()
                }
            }
            return true
        }
    }

    async loadMap(viewer: MapViewer, mapId: MapIdentifier, callback: FlatMapCallback, options: FlatMapOptions={}): Promise<FlatMap>
    //=============================================================================================================================
    {
        // Don't load an already open map
        const map = await viewer.findMap(mapId)
        if (map === null) {
            throw new Error(`Unknown map: ${JSON.stringify(mapId)}`)
        }
        const mapUuid = ('uuid' in map) ? map.uuid : map.id
        for (const flatmap of this.#mapsByContainer.values()) {
            if (mapUuid === flatmap.uuid) {
                return flatmap
            }
        }

        if (this.#maxPanes <= 1) {
            this.#lastPaneUsed = this.#container
        } else if (mapId === this.#bottomMapId && this.#bottomPane) {
            this.#bottomPane.style.display = 'block'
            this.#lastPaneUsed = VIEWER_BOTTOM_PANE
            if (this.#activePanes === 0) {
                this.#containerElement!.style.display = 'none'
            }
            this.#activeBottom = true
            options.addCloseControl = !!this.#activePanes
        } else if (this.#activePanes >= this.#maxPanes) {
            const flatmap = this.#mapsByContainer.get(this.#lastPaneUsed)
            if (flatmap) {
                flatmap.close()
            }
        } else if (this.#containerElement) {
            this.#paneNumber += 1
            this.#lastPaneUsed = `${this.#container}-${this.#paneNumber}`
            const mapPane = document.createElement('div')
            mapPane.id = this.#lastPaneUsed
            mapPane.setAttribute('class', 'flatmap-viewer-pane')
            this.#containerElement.append(mapPane)
            this.#containerElement!.style.display = 'flex'
            this.#activePanes += 1
            options.addCloseControl = this.#activeBottom || (this.#activePanes > 1)
            if (this.#activeBottom && (this.#activePanes === 1)) {
                const bottomMap = this.#mapsByContainer.get(VIEWER_BOTTOM_PANE)
                if (bottomMap) {
                    bottomMap.resize()
                }
            }
        }
        options.container = this.#lastPaneUsed
        if (options.addCloseControl) {
            for (const flatmap of this.#mapsByContainer.values()) {
                flatmap.addCloseControl()
            }
        }
        // Don't clutter the screen with controls if a multipane viewer
        options.allControls = (this.#maxPanes <= 1)

        const flatmap = await viewer.loadMap(mapId, callback, options)
        this.#mapsByContainer.set(this.#lastPaneUsed, flatmap)
        flatmap.addCallback(this.#closePaneCallback.bind(this))

        return flatmap
    }
}

//==============================================================================
