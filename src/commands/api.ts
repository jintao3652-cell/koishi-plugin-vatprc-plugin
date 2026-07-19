import axios, { AxiosInstance } from 'axios'
import { ApiResponse } from '../types'

export class VatprcApiClient {
  private client: AxiosInstance
  private cache = new Map<string, { data: any, timestamp: number }>()
  private cacheDuration: number = 60000 // 1分钟

  constructor(baseURL: string = 'https://uniapi.vatprc.net/', cacheDuration: number = 60000) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Koishi-VATPRC-Plugin/1.0.0'
      }
    })
    this.cacheDuration = cacheDuration
  }

  private async request<T>(method: string, url: string, params?: any): Promise<ApiResponse<T>> {
    const cacheKey = `${method}:${url}:${JSON.stringify(params)}`
    
    // 检查缓存
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return { data: cached.data }
    }

    try {
      const response = await this.client.request({
        method,
        url,
        params
      })
      
      // 缓存结果
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      })
      
      return { data: response.data }
    } catch (error: any) {
      if (error.response) {
        return {
          error: {
            code: error.response.data?.error_code || 'UNKNOWN_ERROR',
            message: error.response.data?.message || error.message
          }
        }
      }
      return {
        error: {
          code: 'NETWORK_ERROR',
          message: error.message
        }
      }
    }
  }

  async getActiveFlights() {
    return this.request<any[]>('GET', '/api/flights/active')
  }

  async getFlightByCallsign(callsign: string) {
    return this.request<any>('GET', `/api/flights/by-callsign/${callsign}`)
  }

  async getFlightWarnings(callsign: string) {
    return this.request<any[]>('GET', `/api/flights/by-callsign/${callsign}/warnings`)
  }

  async getFlightRoute(callsign: string) {
    return this.request<any[]>('GET', `/api/flights/by-callsign/${callsign}/route`)
  }

  async getEvents() {
    return this.request<any[]>('GET', '/api/events')
  }

  async getPastEvents(until?: string) {
    return this.request<any[]>('GET', '/api/events/past', { until })
  }

  async getEvent(eventId: string) {
    return this.request<any>('GET', `/api/events/${eventId}`)
  }

  async getEventControllers(eventId: string) {
    return this.request<any[]>('GET', `/api/events/${eventId}/controllers`)
  }

  async getEventSlots(eventId: string) {
    return this.request<any[]>('GET', `/api/events/${eventId}/slots`)
  }

  async getEventSlot(eventId: string, slotId: string) {
    return this.request<any>('GET', `/api/events/${eventId}/slots/${slotId}`)
  }

  async getNotams() {
    return this.request<any[]>('GET', '/api/notams')
  }

  async getOnlineStatus() {
    return this.request<any>('GET', '/api/compat/online-status')
  }

  async getMetar(icao: string) {
    return this.request<any>('GET', `/api/compat/euroscope/metar/${icao}`)
  }

  async getVatsimEvents() {
    return this.request<any>('GET', '/api/compat/homepage/events/vatsim')
  }

  async getTrackAudioVersion() {
    return this.request<any>('GET', '/api/compat/trackaudio/mandatory_version')
  }

  async getEventAirspaces(eventId: string) {
    return this.request<any[]>('GET', `/api/events/${eventId}/airspaces`)
  }

  async getEventAirspace(eventId: string, airspaceId: string) {
    return this.request<any>('GET', `/api/events/${eventId}/airspaces/${airspaceId}`)
  }

  async getPreferredRoutes() {
    return this.request<any[]>('GET', '/api/navdata/preferred-routes')
  }

  async getPreferredRoute(id: string) {
    return this.request<any>('GET', `/api/navdata/preferred-routes/${id}`)
  }

  clearCache() {
    this.cache.clear()
  }
}