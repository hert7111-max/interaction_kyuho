type RGB = { r: number; g: number; b: number }
export type ScanResult = {
  proportions: { shoulderWidth: number; torsoLength: number; legLength: number }
  colors: { skin: RGB; hair: RGB; top: RGB; bottom: RGB }
  appearance: {
    hair: 'bare' | 'cropped' | 'parted' | 'full' | 'long'
    top: 'sleeveless' | 'short' | 'long'
    pattern: 'plain' | 'band' | 'panel'
    part: number
    topBase?: RGB
    topAccent?: RGB
    bottom: 'shorts' | 'trousers'
    footwear: 'shoes'
    shoeColor: RGB
  }
  samples: Record<'frames' | 'proportions' | 'skin' | 'hair' | 'top', number>
}
export let scanResult: ScanResult | null
