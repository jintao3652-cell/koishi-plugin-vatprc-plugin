import { Context } from 'koishi'
import { VatprcApiClient } from '../api'
import { Utils } from '../utils'

export function registerNotamCommands(ctx: Context, api: VatprcApiClient) {
  // NOTAM 列表
  ctx.command('vatprc.notams', '查询航行通告(NOTAM)')
    .option('icao', '-i <icao:string> 按机场过滤')
    .option('type', '-t <type:string> 按类型过滤')
    .option('limit', '-l <limit:number> 显示数量', { fallback: 10 })
    .action(async ({ options, session }) => {
      await session.send('正在查询航行通告...')
      
      const result = await api.getNotams()
      if (result.error) {
        return `查询失败: ${result.error.message}`
      }
      
      let notams = result.data || []
      if (notams.length === 0) {
        return '当前没有航行通告'
      }
      
      // 按时间排序（最新的在前）
      notams.sort((a, b) => {
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0
        return timeB - timeA
      })
      
      // 过滤
      if (options.icao) {
        const icao = Utils.parseIcao(options.icao)
        notams = notams.filter(notam => 
          notam.icao?.toUpperCase() === icao ||
          notam.message?.toUpperCase().includes(icao)
        )
      }
      
      if (options.type) {
        notams = notams.filter(notam => 
          notam.type?.toLowerCase().includes(options.type.toLowerCase())
        )
      }
      
      if (notams.length === 0) {
        return '没有找到匹配的航行通告'
      }
      
      const displayNotams = notams.slice(0, options.limit)
      let message = '📢 航行通告(NOTAM):\n'
      message += '='.repeat(50) + '\n'
      
      displayNotams.forEach((notam, index) => {
        message += `${index + 1}. `
        
        if (notam.icao) {
          message += `[${notam.icao}] `
        }
        
        if (notam.type) {
          message += `(${notam.type}) `
        }
        
        if (notam.startTime) {
          message += `${Utils.formatTime(notam.startTime)} `
        }
        
        message += '\n'
        
        if (notam.message) {
          const msg = Utils.truncate(notam.message, 100)
          message += `   ${msg}\n`
        }
        
        message += '\n'
      })
      
      if (notams.length > options.limit) {
        message += `... 还有 ${notams.length - options.limit} 条航行通告未显示\n`
      }
      
      message += `\n共 ${notams.length} 条航行通告`
      
      if (options.icao) {
        message += ` (过滤: ${Utils.parseIcao(options.icao)})`
      }
      
      return message
    })

  // 机场 NOTAM
  ctx.command('vatprc.notam <icao>', '查询机场NOTAM')
    .alias('vatprc.航行通告')
    .action(async ({ session }, icao) => {
      if (!icao) {
        return '请输入机场ICAO代码，例如: vatprc.notam ZBAA'
      }
      
      const airport = Utils.parseIcao(icao)
      if (airport.length !== 4) {
        return '请输入有效的4位ICAO机场代码'
      }
      
      await session.send(`正在查询 ${airport} 的航行通告...`)
      
      const result = await api.getNotams()
      if (result.error) {
        return `查询失败: ${result.error.message}`
      }
      
      const notams = result.data || []
      const airportNotams = notams.filter(notam => 
        notam.icao?.toUpperCase() === airport ||
        notam.message?.toUpperCase().includes(airport)
      )
      
      if (airportNotams.length === 0) {
        return `机场 ${airport} 当前没有航行通告`
      }
      
      // 按开始时间排序
      airportNotams.sort((a, b) => {
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0
        return timeB - timeA
      })
      
      // 分类统计
      const activeNotams = airportNotams.filter(n => {
        if (!n.startTime || !n.endTime) return true
        const now = new Date()
        const start = new Date(n.startTime)
        const end = new Date(n.endTime)
        return now >= start && now <= end
      })
      
      let message = `📢 机场 ${airport} 航行通告:\n`
      message += `有效通告: ${activeNotams.length}/${airportNotams.length}\n`
      message += '='.repeat(50) + '\n'
      
      airportNotams.slice(0, 10).forEach((notam, index) => {
        const isActive = activeNotams.includes(notam)
        message += `${isActive ? '🟢' : '⚪'} ${index + 1}. `
        
        if (notam.type) {
          message += `[${notam.type}] `
        }
        
        if (notam.startTime && notam.endTime) {
          const start = Utils.formatTime(notam.startTime)
          const end = Utils.formatTime(notam.endTime)
          message += `${start} → ${end}\n`
        } else if (notam.startTime) {
          message += `${Utils.formatTime(notam.startTime)}\n`
        } else {
          message += '\n'
        }
        
        if (notam.message) {
          const msg = Utils.truncate(notam.message, 80)
          message += `   ${msg}\n`
        }
        
        message += '\n'
      })
      
      if (airportNotams.length > 10) {
        message += `... 还有 ${airportNotams.length - 10} 条航行通告未显示\n`
      }
      
      return message
    })
}