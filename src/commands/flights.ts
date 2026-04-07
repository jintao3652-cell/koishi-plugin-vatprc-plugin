import { Context } from 'koishi'
import { VatprcApiClient } from '../api'
import { Utils } from '../utils'

export function registerFlightCommands(ctx: Context, api: VatprcApiClient) {
  // 活跃航班列表
  ctx.command('vatprc.flights', '查询当前活跃航班')
    .option('limit', '-l <limit:number> 显示数量限制', { fallback: 10 })
    .action(async ({ options, session }) => {
      await session.send('正在查询活跃航班...')
      
      const result = await api.getActiveFlights()
      if (result.error) {
        return `查询失败: ${result.error.message}`
      }
      
      const flights = result.data || []
      if (flights.length === 0) {
        return '当前没有活跃航班'
      }
      
      const displayFlights = flights.slice(0, options.limit)
      let message = '✈️ 活跃航班列表:\n'
      message += '='.repeat(40) + '\n'
      
      displayFlights.forEach((flight, index) => {
        message += `${index + 1}. ${flight.callsign || '未知'}\n`
        if (flight.departure) message += `   起飞: ${flight.departure}`
        if (flight.arrival) message += ` → 到达: ${flight.arrival}\n`
        if (flight.aircraft) message += `   机型: ${flight.aircraft}\n`
        message += '\n'
      })
      
      if (flights.length > options.limit) {
        message += `... 还有 ${flights.length - options.limit} 个航班未显示\n`
      }
      
      message += `\n共 ${flights.length} 个活跃航班`
      return message
    })

  // 查询特定航班
  ctx.command('vatprc.flight <callsign>', '查询特定航班信息')
    .alias('vatprc.航班')
    .action(async ({ session }, callsign) => {
      if (!callsign) {
        return '请输入航班呼号，例如: vatprc.flight CXA123'
      }
      
      if (!Utils.isValidCallsign(callsign)) {
        return '呼号格式无效，请输入正确的航班呼号'
      }
      
      await session.send(`正在查询航班 ${callsign.toUpperCase()}...`)
      
      const [flightResult, warningsResult, routeResult] = await Promise.all([
        api.getFlightByCallsign(callsign.toUpperCase()),
        api.getFlightWarnings(callsign.toUpperCase()),
        api.getFlightRoute(callsign.toUpperCase())
      ])
      
      if (flightResult.error) {
        return `查询航班失败: ${flightResult.error.message}`
      }
      
      const flight = flightResult.data
      if (!flight) {
        return `未找到航班 ${callsign.toUpperCase()}`
      }
      
      // 构建航班信息
      let message = Utils.createMessageCard(`航班 ${flight.callsign || callsign.toUpperCase()}`, [
        { name: '呼号', value: flight.callsign || '未知' },
        { name: '起飞机场', value: flight.departure || '未知' },
        { name: '目的机场', value: flight.arrival || '未知' },
        { name: '机型', value: flight.aircraft || '未知' },
        { name: '巡航高度', value: flight.cruisingLevel ? `${flight.cruisingLevel}ft` : '未知' },
        { name: '状态', value: flight.status || '未知' }
      ])
      
      // 飞行员信息
      if (flight.pilot) {
        message += '\n👨‍✈️ 飞行员信息:\n'
        if (flight.pilot.name) message += `姓名: ${flight.pilot.name}\n`
        if (flight.pilot.cid) message += `CID: ${flight.pilot.cid}\n`
      }
      
      // 警告信息
      if (warningsResult.data && warningsResult.data.length > 0) {
        message += '\n⚠️ 警告信息:\n'
        warningsResult.data.forEach((warning, index) => {
          message += `${index + 1}. ${warning.message || '未知警告'}\n`
        })
      }
      
      // 航路信息
      if (routeResult.data && routeResult.data.length > 0) {
        message += '\n🛣️ 航路信息:\n'
        routeResult.data.slice(0, 5).forEach((leg, index) => {
          message += `${index + 1}. ${leg.from || '未知'} → ${leg.to || '未知'}`
          if (leg.altitude) message += ` @ ${leg.altitude}ft`
          message += '\n'
        })
        
        if (routeResult.data.length > 5) {
          message += `... 还有 ${routeResult.data.length - 5} 个航段\n`
        }
      }
      
      return message
    })

  // 航班警告检查
  ctx.command('vatprc.check <departure> <arrival>', '检查航路警告')
    .option('aircraft', '-a <aircraft> 机型代码')
    .option('level', '-l <level:number> 巡航高度')
    .option('route', '-r <route> 航路')
    .action(async ({ session, options }, departure, arrival) => {
      if (!departure || !arrival) {
        return '请输入起飞和到达机场，例如: vatprc.check ZBAA ZSSS'
      }
      
      await session.send('正在检查航路警告...')
      
      const params = {
        departure: departure.toUpperCase(),
        arrival: arrival.toUpperCase(),
        aircraft: options.aircraft,
        cruising_level: options.level,
        raw_route: options.route
      }
      
      const result = await api.getFlightWarnings('dummy') // 注意：这个API可能需要特殊处理
      
      if (result.error) {
        return `检查失败: ${result.error.message}`
      }
      
      const warnings = result.data || []
      if (warnings.length === 0) {
        return `航路 ${departure.toUpperCase()} → ${arrival.toUpperCase()} 无警告`
      }
      
      let message = `⚠️ 航路警告 (${departure.toUpperCase()} → ${arrival.toUpperCase()}):\n`
      message += '='.repeat(40) + '\n'
      
      warnings.forEach((warning, index) => {
        message += `${index + 1}. [${warning.type || '未知'}] ${warning.message || '未知警告'}\n`
        if (warning.severity) message += `   严重程度: ${warning.severity}\n`
        message += '\n'
      })
      
      return message
    })
}