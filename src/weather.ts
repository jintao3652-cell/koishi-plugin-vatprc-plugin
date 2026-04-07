import { Context } from 'koishi'
import { VatprcApiClient } from './api'
import { Utils } from './utils'

export function registerWeatherCommands(ctx: Context, api: VatprcApiClient) {
  // METAR 鏌ヨ
  ctx.command('vatprc.metar <icao>', '鏌ヨ鏈哄満METAR')
    .alias('vatprc.澶╂皵')
    .action(async ({ session }, icao) => {
      if (!icao) {
        return '璇疯緭鍏ユ満鍦篒CAO浠ｇ爜锛屼緥濡? vatprc.metar ZBAA'
      }
      
      const airport = Utils.parseIcao(icao)
      if (airport.length !== 4) {
        return '璇疯緭鍏ユ湁鏁堢殑4浣岻CAO鏈哄満浠ｇ爜'
      }
      
      await session.send(`姝ｅ湪鏌ヨ ${airport} 鐨凪ETAR...`)
      
      try {
        const result = await api.getMetar(airport)
        
        if (result.error) {
          // 灏濊瘯浣跨敤澶囩敤鏂瑰紡鑾峰彇
          const backupResult = await api.getMetar('metar.php')
          if (backupResult.error) {
            return `鏌ヨ澶辫触: ${result.error.message}`
          }
          
          // 杩欓噷闇€瑕佹牴鎹疄闄呯殑杩斿洖鏍煎紡瑙ｆ瀽
          const metarData = backupResult.data
          return `馃尋锔?${airport} METAR:\n${JSON.stringify(metarData, null, 2)}`
        }
        
        // 瑙ｆ瀽 METAR 鏁版嵁
        const metar = result.data
        let message = `馃尋锔?${airport} 姘旇薄淇℃伅:\n`
        message += '='.repeat(40) + '\n'
        
        if (typeof metar === 'string') {
          // 濡傛灉鏄函鏂囨湰 METAR
          message += metar
        } else if (metar && typeof metar === 'object') {
          // 濡傛灉鏄粨鏋勫寲鏁版嵁
          if (metar.raw) message += `RAW: ${metar.raw}\n`
          if (metar.wind) message += `椋? ${metar.wind}\n`
          if (metar.visibility) message += `鑳借搴? ${metar.visibility}\n`
          if (metar.clouds) message += `浜? ${metar.clouds}\n`
          if (metar.temperature) message += `娓╁害: ${metar.temperature}掳C\n`
          if (metar.dewpoint) message += `闇茬偣: ${metar.dewpoint}掳C\n`
          if (metar.qnh) message += `QNH: ${metar.qnh} hPa\n`
          if (metar.time) message += `鏃堕棿: ${metar.time}\n`
        } else {
          message += '姘旇薄淇℃伅鏍煎紡鏈煡\n'
          message += JSON.stringify(metar, null, 2)
        }
        
        return message
      } catch (error: any) {
        return `鏌ヨ澶辫触: ${error.message}`
      }
    })

  // 鎵归噺鏌ヨ METAR
  ctx.command('vatprc.metars <airports>', '鎵归噺鏌ヨ鏈哄満METAR')
    .action(async ({ session }, airports) => {
      if (!airports || typeof airports !== 'string') {
        return '璇疯緭鍏ユ満鍦篒CAO浠ｇ爜鍒楄〃锛岀敤绌烘牸鍒嗛殧锛屼緥濡? vatprc.metars ZBAA ZSSS ZGGG'
      }
      
      const airportList = airports.split(/\s+/).map(Utils.parseIcao).filter(a => a.length === 4)
      
      if (airportList.length === 0) {
        return '璇疯緭鍏ユ湁鏁堢殑ICAO鏈哄満浠ｇ爜'
      }
      
      if (airportList.length > 5) {
        return '一次最多查询 5 个机场'
      }
      
      await session.send(`姝ｅ湪鏌ヨ ${airportList.join(', ')} 鐨凪ETAR...`)
      
      const results = await Promise.all(
        airportList.map(async (icao) => {
          try {
            const result = await api.getMetar(icao)
            return { icao, result }
          } catch (error) {
            return { icao, error: error instanceof Error ? error.message : String(error) }
          }
        })
      )
      
      let message = '馃尋锔?鏈哄満姘旇薄淇℃伅:\n'
      message += '='.repeat(50) + '\n'
      
      results.forEach(({ icao, result, error }) => {
        message += `\n${icao}:\n`
        
        if (error) {
          message += `   鏌ヨ澶辫触: ${error}\n`
        } else if (result?.error) {
          message += `   鏌ヨ澶辫触: ${result.error.message}\n`
        } else {
          const metar = result?.data
          if (typeof metar === 'string') {
            const lines = metar.split('\n')
            message += `   ${lines[0] || '无数据'}\n`
          } else if (metar?.raw) {
            message += `   ${metar.raw}\n`
          } else {
            message += '   鏃犳暟鎹甛n'
          }
        }
      })
      
      return message
    })
}
