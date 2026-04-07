import { Context } from 'koishi'
import { VatprcApiClient } from './api'
import { Utils } from './utils'

export function registerEventCommands(ctx: Context, api: VatprcApiClient) {
  // 活动列表
  ctx.command('vatprc.events', '查询活动列表')
    .option('type', '-t <type:string> 活动类型')
    .option('limit', '-l <limit:number> 显示数量', { fallback: 5 })
    .action(async ({ options, session }) => {
      await session.send('正在查询活动列表...')
      
      const result = await api.getEvents()
      if (result.error) {
        return `查询失败: ${result.error.message}`
      }
      
      let events = result.data || []
      
      // 按类型过滤
      if (options.type) {
        events = events.filter(event => 
          event.type?.toLowerCase().includes(options.type.toLowerCase()) ||
          event.name?.toLowerCase().includes(options.type.toLowerCase())
        )
      }
      
      if (events.length === 0) {
        return '当前没有活动'
      }
      
      // 按开始时间排序
      events.sort((a, b) => {
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0
        return timeA - timeB
      })
      
      const displayEvents = events.slice(0, options.limit)
      let message = '🎉 近期活动:\n'
      message += '='.repeat(40) + '\n'
      
      displayEvents.forEach((event, index) => {
        message += `${index + 1}. ${event.name || '未命名活动'}\n`
        message += `   ID: ${event.id}\n`
        
        if (event.startTime) {
          message += `   开始: ${Utils.formatTime(event.startTime)}`
          if (event.endTime) {
            message += ` (${Utils.formatDuration(event.startTime, event.endTime)})\n`
          } else {
            message += '\n'
          }
        }
        
        if (event.type) {
          message += `   类型: ${event.type}\n`
        }
        
        if (event.description) {
          const desc = Utils.truncate(event.description, 50)
          message += `   简介: ${desc}\n`
        }
        
        message += `   详情: vatprc.event ${event.id}\n`
      })
      
      if (events.length > options.limit) {
        message += `\n还有 ${events.length - options.limit} 个活动未显示`
      }
      
      return message
    })

  // 活动详情
  ctx.command('vatprc.event <id>', '查询活动详情')
    .alias('vatprc.活动')
    .action(async ({ session }, eventId) => {
      if (!eventId) {
        return '请输入活动ID，例如: vatprc.event A123'
      }
      
      await session.send(`正在查询活动 ${eventId}...`)
      
      const [eventResult, slotsResult, controllersResult, airspacesResult] = await Promise.all([
        api.getEvent(eventId),
        api.getEventSlots(eventId),
        api.getEventControllers(eventId),
        api.getEventAirspaces(eventId)
      ])
      
      if (eventResult.error) {
        return `查询失败: ${eventResult.error.message}`
      }
      
      const event = eventResult.data
      if (!event) {
        return `未找到活动 ${eventId}`
      }
      
      // 构建活动信息
      let message = Utils.createMessageCard(`活动: ${event.name || '未命名'}`, [
        { name: '活动ID', value: event.id },
        { name: '类型', value: event.type || '未知' },
        { name: '开始时间', value: event.startTime ? Utils.formatTime(event.startTime) : '未知' },
        { name: '结束时间', value: event.endTime ? Utils.formatTime(event.endTime) : '未知' },
        { name: '持续时间', value: event.startTime && event.endTime ? 
          Utils.formatDuration(event.startTime, event.endTime) : '未知' }
      ])
      
      // 活动描述
      if (event.description) {
        message += '\n📝 活动描述:\n'
        message += Utils.truncate(event.description, 300) + '\n'
      }
      
      // 席位信息
      if (slotsResult.data && slotsResult.data.length > 0) {
        message += '\n🪑 活动席位:\n'
        const slots = slotsResult.data
        const available = slots.filter(s => s.status === 'AVAILABLE').length
        const booked = slots.filter(s => s.status === 'BOOKED').length
        
        message += `总计: ${slots.length} 个席位 | `
        message += `可用: ${available} | 已预订: ${booked}\n`
        
        // 显示前5个席位
        slots.slice(0, 5).forEach(slot => {
          message += `   ${slot.position} (${slot.status})`
          if (slot.startTime) {
            message += ` ${Utils.formatTime(slot.startTime)}`
          }
          message += '\n'
        })
        
        if (slots.length > 5) {
          message += `   ... 还有 ${slots.length - 5} 个席位\n`
        }
      }
      
      // 管制员信息
      if (controllersResult.data && controllersResult.data.length > 0) {
        message += '\n👮 管制席位:\n'
        controllersResult.data.slice(0, 5).forEach(controller => {
          message += `   ${controller.position || '未知席位'}`
          if (controller.frequency) message += ` @ ${controller.frequency}`
          message += '\n'
        })
        
        if (controllersResult.data.length > 5) {
          message += `   ... 还有 ${controllersResult.data.length - 5} 个管制席位\n`
        }
      }
      
      // 空域信息
      if (airspacesResult.data && airspacesResult.data.length > 0) {
        message += '\n🗺️ 活动空域:\n'
        airspacesResult.data.slice(0, 3).forEach(airspace => {
          message += `   ${airspace.name || '未命名空域'}`
          if (airspace.level) message += ` (${airspace.level})`
          message += '\n'
        })
        
        if (airspacesResult.data.length > 3) {
          message += `   ... 还有 ${airspacesResult.data.length - 3} 个空域\n`
        }
      }
      
      return message
    })

  // 活动席位查询
  ctx.command('vatprc.slots <eventId>', '查询活动席位')
    .option('position', '-p <position:string> 过滤席位')
    .option('status', '-s <status:string> 状态过滤')
    .action(async ({ session, options }, eventId) => {
      if (!eventId) {
        return '请输入活动ID，例如: vatprc.slots A123'
      }
      
      await session.send(`正在查询活动 ${eventId} 的席位...`)
      
      const result = await api.getEventSlots(eventId)
      if (result.error) {
        return `查询失败: ${result.error.message}`
      }
      
      let slots = result.data || []
      if (slots.length === 0) {
        return `活动 ${eventId} 没有席位信息`
      }
      
      // 过滤
      if (options.position) {
        slots = slots.filter(slot => 
          slot.position?.toLowerCase().includes(options.position.toLowerCase())
        )
      }
      
      if (options.status) {
        slots = slots.filter(slot => 
          slot.status?.toLowerCase() === options.status.toLowerCase()
        )
      }
      
      if (slots.length === 0) {
        return '没有找到匹配的席位'
      }
      
      let message = `🪑 活动 ${eventId} 席位列表 (${slots.length} 个):\n`
      message += '='.repeat(50) + '\n'
      
      slots.forEach((slot, index) => {
        message += `${index + 1}. ${slot.position || '未知席位'}\n`
        message += `   状态: ${slot.status || '未知'}\n`
        
        if (slot.startTime && slot.endTime) {
          message += `   时间: ${Utils.formatTime(slot.startTime)} - ${Utils.formatTime(slot.endTime)}\n`
        }
        
        if (slot.bookedBy?.name) {
          message += `   预订者: ${slot.bookedBy.name}`
          if (slot.bookedBy.cid) message += ` (CID: ${slot.bookedBy.cid})`
          message += '\n'
        }
        
        message += '\n'
      })
      
      return message
    })

  // 过去的活动
  ctx.command('vatprc.events.past', '查询过去的活动')
    .option('days', '-d <days:number> 过去几天内的活动', { fallback: 7 })
    .action(async ({ options, session }) => {
      const until = new Date()
      until.setDate(until.getDate() - options.days)
      
      await session.send(`正在查询过去 ${options.days} 天的活动...`)
      
      const result = await api.getPastEvents(until.toISOString())
      if (result.error) {
        return `查询失败: ${result.error.message}`
      }
      
      const events = result.data || []
      if (events.length === 0) {
        return `过去 ${options.days} 天内没有活动`
      }
      
      let message = `📅 过去 ${options.days} 天内的活动 (${events.length} 个):\n`
      message += '='.repeat(40) + '\n'
      
      events.slice(0, 10).forEach((event, index) => {
        message += `${index + 1}. ${event.name || '未命名活动'}\n`
        message += `   ID: ${event.id}\n`
        
        if (event.startTime) {
          message += `   时间: ${Utils.formatTime(event.startTime)}\n`
        }
        
        if (event.type) {
          message += `   类型: ${event.type}\n`
        }
        
        message += '\n'
      })
      
      if (events.length > 10) {
        message += `... 还有 ${events.length - 10} 个活动未显示\n`
      }
      
      return message
    })
}
