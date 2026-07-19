import { Context } from 'koishi'
import { VatprcApiClient } from '../api'

export function registerCompatCommands(ctx: Context, api: VatprcApiClient) {
  // 在线状态
  ctx.command('vatprc.status', '查询服务器状态')
    .alias('vatprc.状态')
    .action(async ({ session }) => {
      await session.send('正在查询服务器状态...')
      
      const result = await api.getOnlineStatus()
      if (result.error) {
        return `查询失败: ${result.error.message}`
      }
      
      const status = result.data
      let message = '🟢 VATPRC 服务器状态\n'
      message += '='.repeat(30) + '\n'
      
      if (status && typeof status === 'object') {
        Object.entries(status).forEach(([key, value]) => {
          message += `${key}: ${JSON.stringify(value)}\n`
        })
      } else if (status) {
        message += status
      } else {
        message += '服务器在线\n'
      }
      
      return message
    })

  // VATSIM 活动
  ctx.command('vatprc.vatsim', '查询VATSIM活动')
    .action(async ({ session }) => {
      await session.send('正在查询VATSIM活动...')
      
      const result = await api.getVatsimEvents()
      if (result.error) {
        return `查询失败: ${result.error.message}`
      }
      
      const events = result.data
      let message = '🌐 VATSIM 网络活动\n'
      message += '='.repeat(40) + '\n'
      
      if (Array.isArray(events)) {
        events.slice(0, 5).forEach((event, index) => {
          message += `${index + 1}. ${event.title || '未命名活动'}\n`
          if (event.start) message += `   开始: ${event.start}\n`
          if (event.airports) message += `   机场: ${event.airports}\n`
          message += '\n'
        })
        
        if (events.length > 5) {
          message += `... 还有 ${events.length - 5} 个活动\n`
        }
      } else if (events) {
        message += JSON.stringify(events, null, 2)
      } else {
        message += '暂无活动信息'
      }
      
      return message
    })

  // TrackAudio 版本
  ctx.command('vatprc.trackaudio', '查询TrackAudio版本')
    .action(async ({ session }) => {
      const result = await api.getTrackAudioVersion()
      if (result.error) {
        return `查询失败: ${result.error.message}`
      }
      
      const version = result.data
      return `🎧 TrackAudio 强制版本: ${JSON.stringify(version)}`
    })

  // 建议航路
  ctx.command('vatprc.routes', '查询建议航路')
    .option('search', '-s <search:string> 搜索关键词')
    .action(async ({ session, options }) => {
      await session.send('正在查询建议航路...')
      
      const result = await api.getPreferredRoutes()
      if (result.error) {
        return `查询失败: ${result.error.message}`
      }
      
      let routes = result.data || []
      
      if (options.search) {
        const search = options.search.toUpperCase()
        routes = routes.filter(route => 
          route.departure?.includes(search) ||
          route.arrival?.includes(search) ||
          route.route?.includes(search)
        )
      }
      
      if (routes.length === 0) {
        return '没有找到建议航路'
      }
      
      let message = '🛣️ 建议航路\n'
      message += '='.repeat(50) + '\n'
      
      routes.slice(0, 10).forEach((route, index) => {
        message += `${index + 1}. ${route.departure || '未知'} → ${route.arrival || '未知'}\n`
        
        if (route.route) {
          message += `   航路: ${route.route}\n`
        }
        
        if (route.level) {
          message += `   高度层: ${route.level}\n`
        }
        
        if (route.remarks) {
          message += `   备注: ${route.remarks}\n`
        }
        
        message += '\n'
      })
      
      if (routes.length > 10) {
        message += `... 还有 ${routes.length - 10} 条建议航路\n`
      }
      
      return message
    })
}