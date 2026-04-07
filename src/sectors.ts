import { Context } from 'koishi'
import { VatprcApiClient } from './api'
import { Utils } from './utils'

export function registerSectorCommands(ctx: Context, api: VatprcApiClient) {
  // 鎵囧尯鏉冮檺鏌ヨ锛堝熀纭€淇℃伅鐗堬級
  ctx.command('vatprc.sectors', '鏌ヨ鎵囧尯淇℃伅')
    .option('search', '-s <search:string> 鎼滅储鎵囧尯')
    .action(async ({ session, options }) => {
      await session.send('姝ｅ湪鏌ヨ鎵囧尯淇℃伅...')
      
      // 娉ㄦ剰锛氬師濮婣PI闇€瑕佽璇侊紝杩欓噷鎴戜滑鎻愪緵涓€涓熀纭€鐨勪俊鎭増
      let message = '馃椇锔?鎵囧尯淇℃伅绯荤粺\n' +
                     '='.repeat(30) + '\n' +
                     '鎵囧尯鏉冮檺鏌ヨ闇€瑕佺敤鎴风櫥褰曡璇乗n' +
                     '鐩墠鍙敤鐨勫叕寮€鎵囧尯淇℃伅鍔熻兘鏈夐檺\n\n' +
                     '鍙皾璇曟煡璇㈢壒瀹氱┖鍩?\n' +
                     '鈥?vatprc.airspace <娲诲姩ID> <绌哄煙ID>\n' +
                     '鈥?vatprc.events 鏌ョ湅娲诲姩绌哄煙\n'
      
      if (options.search) {
        message += `\n鎼滅储 "${options.search}" 鐨勭浉鍏崇┖鍩?\n`
        // 杩欓噷鍙互娣诲姞绌哄煙鎼滅储閫昏緫
      }
      
      return message
    })

  // 绌哄煙鏌ヨ
  ctx.command('vatprc.airspace <eventId> <airspaceId>', '鏌ヨ娲诲姩绌哄煙')
    .action(async ({ session }, eventId, airspaceId) => {
      if (!eventId || !airspaceId) {
        return '璇疯緭鍏ユ椿鍔↖D鍜岀┖鍩烮D锛屼緥濡? vatprc.airspace A123 AS456'
      }
      
      await session.send(`姝ｅ湪鏌ヨ娲诲姩 ${eventId} 鐨勭┖鍩?${airspaceId}...`)
      
      const result = await api.getEventAirspace(eventId, airspaceId)
      if (result.error) {
        return `鏌ヨ澶辫触: ${result.error.message}`
      }
      
      const airspace = result.data
      if (!airspace) {
        return `鏈壘鍒扮┖鍩?${airspaceId}`
      }
      
      let message = Utils.createMessageCard(`绌哄煙: ${airspace.name || airspaceId}`, [
        { name: '绌哄煙ID', value: airspace.id || airspaceId },
        { name: '娲诲姩ID', value: eventId },
        { name: '绫诲瀷', value: airspace.type || '鏈煡' },
        { name: '绛夌骇', value: airspace.level || '鏈煡' },
        { name: '棰戠巼', value: airspace.frequency || '鏈煡' }
      ])
      
      if (airspace.description) {
        message += `\n馃摑 鎻忚堪: ${Utils.truncate(airspace.description, 200)}\n`
      }
      
      if (airspace.coordinates) {
        message += `\n馃搷 鍧愭爣: ${JSON.stringify(airspace.coordinates)}\n`
      }
      
      return message
    })

  // 娲诲姩绌哄煙鍒楄〃
  ctx.command('vatprc.airspaces <eventId>', '查询活动所有空域')
    .action(async ({ session }, eventId) => {
      if (!eventId) {
        return '璇疯緭鍏ユ椿鍔↖D锛屼緥濡? vatprc.airspaces A123'
      }
      
      await session.send(`姝ｅ湪鏌ヨ娲诲姩 ${eventId} 鐨勭┖鍩?..`)
      
      const result = await api.getEventAirspaces(eventId)
      if (result.error) {
        return `鏌ヨ澶辫触: ${result.error.message}`
      }
      
      const airspaces = result.data || []
      if (airspaces.length === 0) {
        return `娲诲姩 ${eventId} 娌℃湁绌哄煙淇℃伅`
      }
      
      let message = `馃椇锔?娲诲姩 ${eventId} 绌哄煙鍒楄〃 (${airspaces.length} 涓?:\n`
      message += '='.repeat(50) + '\n'
      
      airspaces.forEach((airspace, index) => {
        message += `${index + 1}. ${airspace.name || '未知空域'}\n`
        message += `   ID: ${airspace.id}\n`
        
        if (airspace.type) {
          message += `   绫诲瀷: ${airspace.type}\n`
        }
        
        if (airspace.level) {
          message += `   绛夌骇: ${airspace.level}\n`
        }
        
        if (airspace.frequency) {
          message += `   棰戠巼: ${airspace.frequency}\n`
        }
        
        message += `   璇︽儏: vatprc.airspace ${eventId} ${airspace.id}\n`
      })
      
      return message
    })
}

