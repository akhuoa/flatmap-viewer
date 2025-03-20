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

import { v4 as uuidv4 } from 'uuid'

//==============================================================================

export type NewPaneOptions = {
    hidden?: boolean
    scale?: number
}

//==============================================================================

type Direction = 'horizontal' | 'vertical'

//==============================================================================

class WidthHeight
{
    readonly height: number
    readonly width: number

    constructor(element: HTMLElement)
    {
        const rect = element.getBoundingClientRect()
        this.height = rect.height
        this.width = rect.width
    }
}

// Based on https://phuoc.ng/collection/html-dom/create-resizable-split-views/
// with MIT licence

class Resizer
{
    #boundMouseMoveHandler
    #boundMouseUpHandler
    #direction: Direction
    #element: HTMLElement
    #parent: HTMLElement
    #parentSize: WidthHeight
    #prevSibling: HTMLElement
    #prevSiblingSize: WidthHeight
    #nextSibling: HTMLElement
    #nextSiblingSize: WidthHeight
    #startX: number = 0
    #startY: number = 0

    constructor(pane: HTMLElement, direction: Direction)
    //==================================================
    {
        this.#direction = direction
        this.#element = document.createElement('div')
        this.#element.setAttribute('class', 'resizer')
        this.#element.setAttribute('data-direction', this.#direction)
        pane.before(this.#element)

        this.#parent = pane.parentElement! as HTMLElement
        this.#prevSibling = this.#element.previousElementSibling! as HTMLElement
        this.#nextSibling = this.#element.nextElementSibling! as HTMLElement

        this.#element.addEventListener('mousedown', this.#mouseDownHandler.bind(this))
    }

    remove()
    //======
    {
        this.#element.remove()
    }

    #mouseDownHandler(e)
    //==================
    {
        this.#startX = e.clientX
        this.#startY = e.clientY
        this.#parentSize = new WidthHeight(this.#parent)
        this.#prevSiblingSize = new WidthHeight(this.#prevSibling)
        this.#nextSiblingSize = new WidthHeight(this.#nextSibling)

        this.#boundMouseMoveHandler = this.#mouseMoveHandler.bind(this)
        this.#boundMouseUpHandler = this.#mouseUpHandler.bind(this)

        document.addEventListener('mousemove', this.#boundMouseMoveHandler)
        document.addEventListener('mouseup', this.#boundMouseUpHandler)
    }

    #mouseMoveHandler(e)
    //==================
    {
        const dx = e.clientX - this.#startX
        const dy = e.clientY - this.#startY
        switch (this.#direction) {
            case 'vertical':
                this.#prevSibling.style.height = `${((this.#prevSiblingSize.height + dy) * 100) / this.#parentSize.height}%`
                this.#nextSibling.style.height = `${((this.#nextSiblingSize.height - dy) * 100) / this.#parentSize.height}%`
                break;
            case 'horizontal':
            default:
                this.#prevSibling.style.width = `${((this.#prevSiblingSize.width + dx) * 100) / this.#parentSize.width}%`
                this.#nextSibling.style.width = `${((this.#nextSiblingSize.width - dx) * 100) / this.#parentSize.width}%`
                break;
        }

        const cursor = (this.#direction === 'horizontal') ? 'col-resize' : 'row-resize'
        this.#element.style.cursor = cursor
        document.body.style.cursor = cursor

        this.#prevSibling.style.userSelect = 'none'
        this.#prevSibling.style.pointerEvents = 'none'

        this.#nextSibling.style.userSelect = 'none'
        this.#nextSibling.style.pointerEvents = 'none'
    }

    #mouseUpHandler()
    //===============
    {
        this.#element.style.removeProperty('cursor')
        document.body.style.removeProperty('cursor')

        this.#prevSibling.style.removeProperty('user-select')
        this.#prevSibling.style.removeProperty('pointer-events')

        this.#nextSibling.style.removeProperty('user-select')
        this.#nextSibling.style.removeProperty('pointer-events')

        document.removeEventListener('mousemove', this.#boundMouseMoveHandler)
        document.removeEventListener('mouseup', this.#boundMouseUpHandler)
    }
}

//==============================================================================

class PaneSet
{
    #container: HTMLElement
    #direction: Direction
    #hiddenPanes: Map<string, [string, number]> = new Map()
    #id: string
    #nextPaneNumber: number = 1
    // The following arrays are kept in parallel
    #paneElements: HTMLElement[] = []
    #paneIds: string[] = []
    #paneSizes: number[] = []
    #resizersByPane: Map<string, Resizer> = new Map()

    constructor(direction: Direction, container: HTMLElement)
    {
        this.#direction = direction
        this.#container = container
        if (this.#container.id !== '') {
            this.#id = this.#container.id
        } else {
            this.#id = `${direction}-${uuidv4()}`
        }
        this.#container.style.display = 'flex'
        if (direction === 'vertical') {
            this.#container.style['flex-direction'] = 'column'
        }
    }

    get lastPane(): HTMLElement
    //=========================
    {
        return this.#paneElements.slice(-1)[0]
    }

    get paneElements(): HTMLElement[]
    //===============================
    {
        return this.#paneElements
    }

    get size(): number
    //================
    {
        return this.#paneElements.length
    }

    addPane(options: NewPaneOptions={}): HTMLElement
    //==============================================
    {
        const pane = document.createElement('div')
        pane.id = `${this.#id}-${this.#nextPaneNumber}`
        this.#nextPaneNumber += 1
        pane.setAttribute('class', 'flatmap-viewer-pane')
        if (this.#direction === 'horizontal') {
            pane.style.width = '100%'
        } else {
            pane.style.height = '100%'
        }
        this.#container.append(pane)
        const scale = this.#paneIds.length/(Math.max(options.scale || 1.0, 0.01) + this.#paneIds.length)
        this.#paneSizes = this.#paneSizes.map(size => scale*size)
        this.#paneSizes.push(1.0 - scale)
        this.#paneElements.push(pane)
        this.#paneIds.push(pane.id)
        this.#setSizes()
        if (this.size > 1) {
            this.#addResizeBar(pane)
        }
        return pane
    }

    getPane(paneId: string): HTMLElement|null
    //=======================================
    {
        const paneIndex = this.#paneIds.indexOf(paneId)
        if (paneIndex >= 0) {
            this.#paneElements[paneIndex]
        }
        return null
    }

    showPane(paneId: string, show: boolean=true)
    //==========================================
    {
        const paneIndex = this.#paneIds.indexOf(paneId)
        if (paneIndex >= 0) {
            const pane = this.#paneElements[paneIndex]
            if (show && pane.style.display === 'none') {
                const displaySize = this.#hiddenPanes.get(paneId)
                if (displaySize !== undefined) {
                    pane.style.display = displaySize[0]
                    const scale = (1.0 - displaySize[1])
                    this.#paneSizes = this.#paneSizes.map(size => scale*size)
                    this.#paneSizes[paneIndex] = displaySize[1]
                    this.#setSizes()
                    if (paneIndex == 0) {
                        this.#addResizeBar(this.#paneElements[paneIndex+1])
                    } else {
                        this.#addResizeBar(pane)
                    }
                }
            } else if (!show && pane.style.display !== 'none') {
                const paneSize = this.#paneSizes[paneIndex]
                this.#hiddenPanes.set(paneId, [pane.style.display, paneSize])
                const scale = 1.0/(1.0 - paneSize)
                // Set hidden pane's size to 0 and redistribute its size
                this.#paneSizes[paneIndex] = 0
                this.#paneSizes = this.#paneSizes.map(size => scale*size)
                this.#setSizes()
                pane.style.display = 'none'
                if (paneIndex == 0) {
                    this.#removeResizeBar(this.#paneElements[paneIndex+1])
                } else {
                    this.#removeResizeBar(pane)
                }
            }
        }
    }

    removePane(paneId: string)
    //========================
    {
        if (this.#paneIds.length > 1) {
            const paneIndex = this.#paneIds.indexOf(paneId)
            if (paneIndex >= 0) {
                const paneElement = this.#paneElements[paneIndex]
                if (paneIndex == 0) {
                    this.#removeResizeBar(this.#paneElements[paneIndex+1])
                } else {
                    this.#removeResizeBar(paneElement)
                }
                paneElement.remove()
                const scale = 1.0 - this.#paneSizes[paneIndex]
                this.#paneSizes.splice(paneIndex, 1)
                this.#paneSizes = this.#paneSizes.map(size => size/scale)
                this.#paneElements.splice(paneIndex, 1)
                this.#paneIds.splice(paneIndex, 1)
                this.#setSizes()
            }
        }
    }

    #setSizes()
    //=========
    {
        if (this.#direction === 'horizontal') {
            this.#paneElements.forEach((element, index) => element.style.width = `${100*this.#paneSizes[index]}%`)
        } else {
            this.#paneElements.forEach((element, index) => element.style.height = `${100*this.#paneSizes[index]}%`)
        }
    }

    #addResizeBar(pane: HTMLElement)
    //==============================
    {
        this.#resizersByPane.set(pane.id, new Resizer(pane, this.#direction))
    }

    #removeResizeBar(pane: HTMLElement)
    //=================================
    {
        const resizer = this.#resizersByPane.get(pane.id)
        if (resizer) {
            resizer.remove()
            this.#resizersByPane.delete(pane.id)
        }
    }
}

//==============================================================================

export class HorizontalPanes extends PaneSet
{
    constructor(container: HTMLElement)
    {
        super('horizontal', container)
    }
}

//==============================================================================

export class VerticalPanes extends PaneSet
{
    constructor(container: HTMLElement)
    {
        super('vertical', container)
    }
}

//==============================================================================
