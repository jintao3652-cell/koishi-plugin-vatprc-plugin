import { Context } from 'koishi'
import { VatprcApiClient } from '../api'
import { Utils } from '../utils'

export function registerSectorCommands(ctx: Context, api: VatprcApiClient) {
  // 扇区权限查询（基础信息版）
  ctx.command('vatprc.sectors', '查询扇区信息')
    .option('search', '-s <search:string> 搜索扇区')
    .action(async ({ session, options }) => {
      await session.send('正在查询扇区信息...')
      
      // 注意：原始API需要认证，这里我们提供一个基础的信息版
      let message = '🗺️ 扇区信息系统\n' +
                     '='.repeat(30) + '\n' +
                     '扇区权限查询需要用户登录认证\n' +
                     '目前可用的公开扇区信息功能有限\n\n' +
                     '可尝试查询特定空域:\n' +
                     '• vatprc.airspace <活动ID> <空域ID>\n' +
                     '• vatprc.events 查看活动空域\n'
      
      if (options.search) {
        message += `\n搜索 "${options.search}" 的相关空域:\n`
        // 这里可以添加空域搜索逻辑
      }
      
      return message
    })

  // 空域查询
  ctx.command('vatprc.airspace <eventId> <airspaceId>', '查询活动空域')
    .action(async ({ session }, eventId, airspaceId) => {
      if (!eventId || !airspaceId) {
        return '请输入活动ID和空域ID，例如: vatprc.airspace A123 AS456'
      }
      
      await session.send(`正在查询活动 ${eventId} 的空域 ${airspaceId}...`)
      
      const result = await api.getEventAirspace(eventId, airspaceId)
      if (result.error) {
        return `查询失败: ${result.error.message}`
      }
      
      const airspace = result.data
      if (!airspace) {
        return `未找到空域 ${airspaceId}`
      }
      
      let message = Utils.createMessageCard(`空域: ${airspace.name || airspaceId}`, [
        { name: '空域ID', value: airspace.id || airspaceId },
        { name: '活动ID', value: eventId },
        { name: '类型', value: airspace.type || '未知' },
        { name: '等级', value: airspace.level || '未知' },
        { name: '频率', value: airspace.frequency || '未知' }
      ])
      
      if (airspace.description) {
        message += `\n📝 描述: ${Utils.truncate(airspace.description, 200)}\n`
      }
      
      if (airspace.coordinates) {
        message += `\n📍 坐标: ${JSON.stringify(airspace.coordinates)}\n`
      }
      
      return message
    })

  // 活动空域列表
  ctx.command('vatprc.airspaces <eventId>', '查询活动所有空域')
    .action(async ({ session }, eventId) => {
      if (!eventId) {
        return '请输入活动ID，例如: vatprc.airspaces A123'
      }
      
      await session.send(`正在查询活动 ${eventId} 的空域...`)
      
      const result = await api.getEventAirspaces(eventId)
      if (result.error) {
        return `查询失败: ${result.error.message}`
      }
      
      const airspaces = result.data || []
      if (airspaces.length === 0) {
        return `活动 ${eventId} 没有空域信息`
      }
      
      let message = `🗺️ 活动 ${eventId} 空域列表 (${airspaces.length} 个):\n`
      message += '='.repeat(50) + '\n'
      
      airspaces.forEach((airspace, index) => {
        message += `${index + 1}. ${airspace.name || '未命名空域'}\n`
        message += `   ID: ${airspace.id}\n`
        
        if (airspace.type) {
          message += `   类型: ${airspace.type}\n`
        }
        
        if (airspace.level) {
          message += `   等级: ${airspace.level}\n`
        }
        
        if (airspace.frequency) {
          message += `   频率: ${airspace.frequency}\n`
        }
        
        message += `   详情: vatprc.airspace ${eventId} ${airspace.id}\n`
      })
      
      return message
    })
}