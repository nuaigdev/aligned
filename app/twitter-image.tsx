import { ImageResponse } from 'next/og'
import { OgImage, ogImageSize } from './og-content'

export const alt = 'Aligned — client ticketing platform by NuAIg'
export const size = ogImageSize
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(<OgImage />, size)
}
