import { Context, Logger } from 'koishi'

export interface ScreenshotOptions {
  width: number
  height: number
  quality: number
  delay: number
  fullPage?: boolean
}

export interface FlightPageData {
  callsign?: string
  departure?: string
  arrival?: string
  aircraft?: string
  status?: string
  pilotName?: string
  pilotCid?: string
  pilotRating?: string
  connectTime?: string
  flightTime?: string
  network?: string
}

type PuppeteerModule = typeof import('puppeteer')

export class FlightScreenshot {
  private ctx: Context
  private logger: Logger
  private puppeteer: PuppeteerModule | null = null
  private browser: import('puppeteer').Browser | null = null
  private initialized = false
  private available = false
  private defaultTimeout = 30000

  constructor(ctx: Context) {
    this.ctx = ctx
    this.logger = ctx.logger('vatprc:screenshot')
  }

  async initialize() {
    if (this.initialized) return
    this.initialized = true

    try {
      this.puppeteer = await import('puppeteer')
      this.browser = await this.puppeteer.launch({
        headless: 'new' as any,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      this.available = true
    } catch (error) {
      this.available = false
      this.logger.warn('Screenshot feature unavailable (puppeteer init failed).', error)
      throw error
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  async getFlightDataFromPage(flightId: string): Promise<FlightPageData | null> {
    const page = await this.openPage(flightId)
    if (!page) return null

    try {
      const text = await page.evaluate(() => document.body?.innerText || '')
      const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)

      const data: FlightPageData = {
        callsign: this.extractFromLines(lines, ['Callsign', 'Callsign/Flight', 'Flight']),
        departure: this.extractFromLines(lines, ['Departure', 'Dep']),
        arrival: this.extractFromLines(lines, ['Arrival', 'Arr']),
        aircraft: this.extractFromLines(lines, ['Aircraft', 'Type']),
        status: this.extractFromLines(lines, ['Status']),
        pilotName: this.extractFromLines(lines, ['Pilot', 'Pilot Name', 'Name']),
        pilotCid: this.extractFromLines(lines, ['CID']),
        pilotRating: this.extractFromLines(lines, ['Rating']),
        connectTime: this.extractFromLines(lines, ['Connected', 'Connect Time']),
        flightTime: this.extractFromLines(lines, ['Flight Time']),
        network: this.extractFromLines(lines, ['Network']),
      }

      return Object.keys(data).some(key => data[key as keyof FlightPageData])
        ? data
        : { callsign: flightId }
    } catch (error) {
      this.logger.warn('Failed to parse flight page data.', error)
      return null
    } finally {
      await page.close()
    }
  }

  async getFlightScreenshot(
    flightId: string,
    options: ScreenshotOptions,
  ): Promise<Buffer | null> {
    const page = await this.openPage(flightId, options)
    if (!page) return null

    try {
      if (options.delay) {
        await page.waitForTimeout(options.delay)
      }

      const buffer = await page.screenshot({
        type: 'jpeg',
        quality: options.quality,
        fullPage: options.fullPage ?? false,
      })

      return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as any)
    } catch (error) {
      this.logger.warn('Failed to capture flight screenshot.', error)
      return null
    } finally {
      await page.close()
    }
  }

  private async openPage(
    flightId: string,
    options?: ScreenshotOptions,
  ): Promise<import('puppeteer').Page | null> {
    try {
      await this.ensureInitialized()
      if (!this.browser) return null

      const page = await this.browser.newPage()
      const width = options?.width ?? 1200
      const height = options?.height ?? 800
      await page.setViewport({ width, height })
      await page.goto(`https://www.vatprc.net/flights/${flightId}`, {
        waitUntil: 'networkidle2',
        timeout: this.defaultTimeout,
      })
      return page
    } catch (error) {
      this.logger.warn('Failed to open flight page.', error)
      return null
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize()
    }
    if (!this.available || !this.browser) {
      throw new Error('Screenshot feature is unavailable.')
    }
  }

  private extractFromLines(lines: string[], labels: string[]): string | undefined {
    for (const label of labels) {
      const prefix = label.toLowerCase()
      for (const line of lines) {
        const lower = line.toLowerCase()
        if (lower === prefix) continue
        if (lower.startsWith(prefix)) {
          const value = line.slice(label.length).replace(/^[:\s-]+/, '').trim()
          if (value) return value
        }
      }
    }
    return undefined
  }
}
