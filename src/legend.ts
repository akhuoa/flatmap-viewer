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

export type FlatmapLegendEntry = {
    prompt: string
    colour: string
    style: 'circle' | 'exoid' | 'hexagon' |'rounded-square' | 'square' | 'star'
    border?: string
}

export const FLATMAP_LEGEND: FlatmapLegendEntry[] = [
    {
        prompt: 'Tissue region',
        colour: '#FA00C0',
        style: 'circle'
    },
    {
        prompt: 'Brain nuclei',
        colour: '#EA431C',
        style: 'circle'
    },
    {
        prompt: 'Ganglia',
        colour: '#A5F160',
        style: 'circle'
    },
    {
        prompt: 'Gaglionated nerve plexus',
        colour: '#EAED59',
        style: 'exoid'
    },
    {
        prompt: 'Featured dataset marker',
        colour: '#FFFF09',
        style: 'star',
        border: 'black'
    }
]

//==============================================================================
//==============================================================================
