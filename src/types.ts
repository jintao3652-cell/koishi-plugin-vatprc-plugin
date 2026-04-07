export interface PluginConfig {
  apiBaseUrl?: string
  cacheDuration?: number
  maxResults?: number
}

export interface Flight {
  callsign: string
  departure?: string
  arrival?: string
  aircraft?: string
  cruisingLevel?: number
  status?: string
  pilot?: {
    name?: string
    cid?: string
  }
}

export interface Event {
  id: string
  name: string
  description?: string
  startTime?: string
  endTime?: string
  type?: string
  bannerImage?: string
}

export interface Notam {
  id: string
  icao?: string
  message: string
  startTime?: string
  endTime?: string
  type?: string
}

export interface WarningMessage {
  type: string
  message: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface EventSlot {
  id: string
  position: string
  startTime: string
  endTime: string
  status: string
  bookedBy?: {
    name?: string
    cid?: string
  }
}

export interface SectorPermission {
  sector: string
  allowed: boolean
  reason?: string
}

export interface ApiResponse<T> {
  data?: T
  error?: {
    code: string
    message: string
  }
}