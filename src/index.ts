import { Context, Schema } from 'koishi'
import { VatprcApiClient } from './api'
import { FlightScreenshot } from './screenshot'
import { registerFlightCommands } from './commands/flights'
import { registerEventCommands } from './commands/events'
import { registerNotamCommands } from './commands/notams'
import { registerWeatherCommands } from './commands/weather'
import { registerSectorCommands } from './commands/sectors'
import { registerCompatCommands } from './commands/compat'
import { registerFlightPageCommands } from './flightpage'

// 插件配置
export interface Config {
  apiBaseUrl: string
  cacheDuration: number
  maxResults: number
  enableScreenshot: boolean
  screenshotTimeout: number
}

// 配置架构
export const Config: Schema<Config> = Schema.object({
  apiBaseUrl: Schema.string()
    .default('https://uniapi.vatprc.net/')
    .description('VATPRC UniAPI 基础地址'),
  
  cacheDuration: Schema.number()
    .default(60000)
    .min(1000)
    .max(300000)
    .description('API 缓存时间（毫秒）'),
  
  maxResults: Schema.number()
    .default(20)
    .min(1)
    .max(100)
    .description('最大返回结果数'),
  
  enableScreenshot: Schema.boolean()
    .default(true)
    .description('启用航班页面截图功能（需要 Puppeteer）'),
  
  screenshotTimeout: Schema.number()
    .default(30000)
    .min(5000)
    .max(120000)
    .description('截图超时时间（毫秒）'),
})

// 插件应用函数
export function apply(ctx: Context, config: Config) {
  // 初始化 API 客户端
  const api = new VatprcApiClient(config.apiBaseUrl, config.cacheDuration)
  
  // 初始化截图工具
  let screenshot: FlightScreenshot | null = null
  
  if (config.enableScreenshot) {
    try {
      screenshot = new FlightScreenshot(ctx)
      
      // 异步初始化 Puppeteer
      screenshot.initialize().catch(error => {
        ctx.logger.error('截图工具初始化失败:', error)
        screenshot = null
      })
      
    } catch (error) {
      ctx.logger.warn('截图功能初始化失败，相关功能将不可用:', error)
    }
  }
  
  // 注册帮助命令
  ctx.command('vatprc', 'VATPRC 功能菜单')
    .action(async ({ session }) => {
      const message = 
        '✈️ VATPRC UniAPI 插件功能\n' +
        '='.repeat(30) + '\n\n' +
        '📊 航班相关:\n' +
        '  vatprc.flights - 活跃航班列表\n' +
        '  vatprc.flight <呼号> - 查询航班\n' +
        '  vatprc.check <起降> - 检查航路\n\n' +
        '🖼️ 航班页面（截图）:\n' +
        '  vatprc.flightpage <航班ID> - 航班页面截图\n' +
        '  vatprc.flightinfo <航班ID> - 航班页面信息\n' +
        '  vatprc.batchflight <多个航班> - 批量查询\n\n' +
        '🎉 活动相关:\n' +
        '  vatprc.events - 活动列表\n' +
        '  vatprc.event <ID> - 活动详情\n' +
        '  vatprc.slots <ID> - 活动席位\n' +
        '  vatprc.events.past - 过去活动\n\n' +
        '📢 航行通告:\n' +
        '  vatprc.notams - NOTAM 列表\n' +
        '  vatprc.notam <机场> - 机场NOTAM\n\n' +
        '🌤️ 气象信息:\n' +
        '  vatprc.metar <机场> - METAR\n' +
        '  vatprc.metars <多个机场> - 批量查询\n\n' +
        '🗺️ 扇区空域:\n' +
        '  vatprc.sectors - 扇区信息\n' +
        '  vatprc.airspace <活动> <空域> - 空域详情\n' +
        '  vatprc.airspaces <活动> - 活动空域\n\n' +
        '🌐 系统信息:\n' +
        '  vatprc.status - 服务器状态\n' +
        '  vatprc.vatsim - VATSIM活动\n' +
        '  vatprc.trackaudio - TrackAudio版本\n' +
        '  vatprc.routes - 建议航路\n\n' +
        '💡 提示:\n' +
        '  • 所有命令支持 -h 查看帮助\n' +
        (screenshot ? '  • ✅ 截图功能已启用\n' : '  • ⚠️ 截图功能未启用\n')
      
      return message
    })

  // 注册所有命令模块
  registerFlightCommands(ctx, api)
  registerEventCommands(ctx, api)
  registerNotamCommands(ctx, api)
  registerWeatherCommands(ctx, api)
  registerSectorCommands(ctx, api)
  registerCompatCommands(ctx, api)
  
  // 注册航班页面命令（如果截图工具可用）
  if (screenshot) {
    registerFlightPageCommands(ctx, screenshot)
  } else if (config.enableScreenshot) {
    ctx.logger.warn('截图功能配置已启用，但初始化失败')
  }

  // 定时清理缓存
  ctx.setInterval(() => {
    api.clearCache()
  }, 5 * 60 * 1000) // 每5分钟清理一次缓存

  // 插件关闭时清理资源
  ctx.on('dispose', async () => {
    if (screenshot) {
      await screenshot.close().catch(error => {
        ctx.logger.error('截图工具关闭失败:', error)
      })
    }
  })

  // 插件就绪日志
  ctx.on('ready', () => {
    ctx.logger.info('VATPRC UniAPI 插件已加载')
    if (screenshot) {
      ctx.logger.info('航班页面截图功能已启用')
    }
  })
}

// 插件元数据
export const name = 'vatprc-uniapi'
export const inject = []
export const reusable = true