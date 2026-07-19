import { Context } from 'koishi'
import { VatprcApiClient } from '../api'
import { Utils } from '../utils'

export function registerWeatherCommands(ctx: Context, api: VatprcApiClient) {
  // METAR 查询
  ctx.command('vatprc.metar <icao>', '查询机场METAR')
    .alias('vatprc.天气')
    .action(async ({ session }, icao) => {
      if (!icao) {
        return '请输入机场ICAO代码，例如: vatprc.metar ZBAA'
      }
      
      const airport = Utils.parseIcao(icao)
      if (airport.length !== 4) {
        return '请输入有效的4位ICAO机场代码'
      }
      
      await session.send(`正在查询 ${airport} 的METAR...`)
      
      try {
        const result = await api.getMetar(airport)
        
        if (result.error) {
          // 尝试使用备用方式获取
          const backupResult = await api.getMetar('metar.php')
          if (backupResult.error) {
            return `查询失败: ${result.error.message}`
          }
          
          // 这里需要根据实际的返回格式解析
          const metarData = backupResult.data
          return `🌤️ ${airport} METAR:\n${JSON.stringify(metarData, null, 2)}`
        }
        
        // 解析 METAR 数据
        const metar = result.data
        let message = `🌤️ ${airport} 气象信息:\n`
        message += '='.repeat(40) + '\n'
        
        if (typeof metar === 'string') {
          // 如果是纯文本 METAR
          message += metar
        } else if (metar && typeof metar === 'object') {
          // 如果是结构化数据
          if (metar.raw) message += `RAW: ${metar.raw}\n`
          if (metar.wind) message += `风: ${metar.wind}\n`
          if (metar.visibility) message += `能见度: ${metar.visibility}\n`
          if (metar.clouds) message += `云: ${metar.clouds}\n`
          if (metar.temperature) message += `温度: ${metar.temperature}°C\n`
          if (metar.dewpoint) message += `露点: ${metar.dewpoint}°C\n`
          if (metar.qnh) message += `QNH: ${metar.qnh} hPa\n`
          if (metar.time) message += `时间: ${metar.time}\n`
        } else {
          message += '气象信息格式未知\n'
          message += JSON.stringify(metar, null, 2)
        }
        
        return message
      } catch (error: any) {
        return `查询失败: ${error.message}`
      }
    })

  // 批量查询 METAR
  ctx.command('vatprc.metars <airports>', '批量查询机场METAR')
    .action(async ({ session }, airports) => {
      if (!airports) {
        return '请输入机场ICAO代码列表，用空格分隔，例如: vatprc.metars ZBAA ZSSS ZGGG'
      }
      
      const airportList = airports.split(/\s+/).map(Utils.parseIcao).filter(a => a.length === 4)
      
      if (airportList.length === 0) {
        return '请输入有效的ICAO机场代码'
      }
      
      if (airportList.length > 5) {
        return '一次最多查询5个机场'
      }
      
      await session.send(`正在查询 ${airportList.join(', ')} 的METAR...`)
      
      const results = await Promise.all(
        airportList.map(async (icao) => {
          try {
            const result = await api.getMetar(icao)
            return { icao, result }
          } catch (error) {
            return { icao, error: error.message }
          }
        })
      )
      
      let message = '🌤️ 机场气象信息:\n'
      message += '='.repeat(50) + '\n'
      
      results.forEach(({ icao, result, error }) => {
        message += `\n${icao}:\n`
        
        if (error) {
          message += `   查询失败: ${error}\n`
        } else if (result?.error) {
          message += `   查询失败: ${result.error.message}\n`
        } else {
          const metar = result?.data
          if (typeof metar === 'string') {
            const lines = metar.split('\n')
            message += `   ${lines[0] || '无数据'}\n`
          } else if (metar?.raw) {
            message += `   ${metar.raw}\n`
          } else {
            message += '   无数据\n'
          }
        }
      })
      
      return message
    })
}