import { ImageResponse } from 'next/og'
import { OgImage, ogImageSize } from './og-content'

export const alt = 'NuAIg Assist — client ticketing platform'
export const size = ogImageSize
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(<OgImage />, size)
}
