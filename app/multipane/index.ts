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
import { SvgMap, SvgViewer } from '../../src/svgviewer'
import { MapIdentifier } from '../../src/viewer'

//==============================================================================

import {HorizontalPanes, VerticalPanes} from './paneset'

//==============================================================================

export class PaneManager
{
    #activeBottom: boolean = false
    #bottomPane: HTMLElement
    #bottomMapId: string
    #mapsByPane: Map<string, FlatMap> = new Map()
    #mapsContainer: HTMLElement
    #mapPanes: HorizontalPanes
    #maxPanes: number
    #verticalPanes: VerticalPanes|null = null

    constructor(containerId: string, maxPanes: number=1)
    {
        const containerElement = document.getElementById(containerId)!
        this.#maxPanes = maxPanes
        this.#verticalPanes = new VerticalPanes(containerElement)
        this.#mapsContainer = this.#verticalPanes.addPane()
        this.#bottomPane = this.#verticalPanes.addPane({scale: 0.4})
        this.#mapPanes = new HorizontalPanes(this.#mapsContainer)
        this.#mapPanes.addPane()
        if (this.#verticalPanes) {
            this.#verticalPanes.showPane(this.#mapsContainer.id, false)
        }
    }

    closeMaps()
    //=========
    {
        for (const [paneId, flatmap] of this.#mapsByPane.entries()) {
            if (paneId !== this.#bottomPane.id) {
                flatmap.close()
                this.#mapPanes.removePane(paneId)
                this.#mapsByPane.delete(paneId)
            }
        }
    }

    #closePane(paneId: string)
    //========================
    {
        if (this.#mapsByPane.size > 1) {
            this.#mapsByPane.delete(paneId)
            if (paneId === this.#bottomPane.id) {
                this.#verticalPanes!.showPane(this.#bottomPane.id, false)
                this.#activeBottom = false
            } else {
                if (this.#mapPanes.size > 1) {
                    this.#mapPanes.removePane(paneId)
                } else if (this.#verticalPanes) {
                    this.#verticalPanes.showPane(this.#mapsContainer.id, false)
                }
            }
        }
        if (this.#mapsByPane.size <= 1) {
            for (const flatmap of this.#mapsByPane.values()) {
                flatmap.removeCloseControl()
            }
        }
    }

    async #closePaneCallback(eventType: string, data: Record<string, any>)
    //====================================================================
    {
        if (eventType === 'close-pane') {
            this.#closePane(data.container)
            return true
        }
    }

    async loadMap(viewer: MapViewer, mapId: MapIdentifier, callback: FlatMapCallback,
                  options: FlatMapOptions={}, newPane: boolean=false): Promise<FlatMap|SvgMap|null>
    //=============================================================================================
    {
        // Don't load an already open map
        const map = await viewer.findMap(mapId)
        if (map === null) {
            throw new Error(`Unknown map: ${JSON.stringify(mapId)}`)
        }
        const mapUuid = map.uuid || map.id
        for (const flatmap of this.#mapsByPane.values()) {
            if (mapUuid === flatmap.uuid) {
                return flatmap
            }
        }
        const mapIndex = (await viewer.mapServer.mapIndex(mapUuid))!
        let mapPaneId: string = ''
        if (this.#maxPanes <= 1) {
            mapPaneId = this.#mapPanes.lastPane.id
        } else if ((mapIndex['map-kinds'] || []).includes('control')) {
            if (!this.#activeBottom) {
                this.#verticalPanes!.showPane(this.#bottomPane.id, true)
                this.#activeBottom = true
            }
            mapPaneId = this.#bottomPane.id
            options.addCloseControl = (this.#mapPanes.size > 0)
        } else if (this.#mapPanes.size >= this.#maxPanes) {
            mapPaneId = this.#mapPanes.lastPane.id
        } else {
            if (this.#verticalPanes) {
                this.#verticalPanes.showPane(this.#mapsContainer.id, true)
            }
            if (!this.#activeBottom) {
                this.#verticalPanes!.showPane(this.#bottomPane.id, false)
            }
            // We want to reuse panes if possible...
            if (newPane || this.#mapPanes.size === 0) {
                mapPaneId = this.#mapPanes.addPane().id
            } else {
                mapPaneId = this.#mapPanes.lastPane.id
            }
            options.addCloseControl = this.#activeBottom || (this.#mapPanes.size > 1)
        }
        if (this.#mapsByPane.has(mapPaneId)) {
            this.#mapsByPane.get(mapPaneId)!.close()
        }

        // Make sure all existing maps have a close control if the new map is getting one
        if (options.addCloseControl) {
            for (const flatmap of this.#mapsByPane.values()) {
                flatmap.addCloseControl()
            }
        }
        // Don't clutter the screen with controls if a multipane viewer
        options.allControls = (this.#maxPanes <= 1)

        // Use a pane's saved BG colour
        const background = localStorage.getItem(`${map.id}-background`)
        if (background) {
            options.background = background
        }

        options.container = mapPaneId

/*
 *      if (mapId === this.#bottomMapId) {
 *          const svgViewer = new SvgViewer(viewer.mapServerUrl)
 *          const flatmap = await svgViewer.loadMap(mapId, callback, options)
 *          return flatmap
 *      }
 */
        const flatmap = await viewer.loadMap(mapId, callback, options)
        if (flatmap) {
            this.#mapsByPane.set(mapPaneId, flatmap)

            // We get a control change event when the BG colour is changed
            flatmap.addCallback(async (eventType, data) => {
                if (eventType === 'change'
                 && data.type === 'control'
                 && data.control === 'background') {
                    localStorage.setItem(`${map.id}-background`, data.value)
                    return true
                }
            })

            flatmap.addCallback(this.#closePaneCallback.bind(this))
        }
        return flatmap
    }
}

//==============================================================================
